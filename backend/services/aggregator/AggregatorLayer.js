const providerRegistry = require('./ProviderRegistry');
const NodeCache = require('node-cache');
const stringSimilarity = require('string-similarity');

// Cache TTLs
const SEARCH_TTL = 1800;    // 30 min
const DETAILS_TTL = 3600;   // 1 hour
const PAGES_TTL = 86400;    // 24 hours

const readerCache = new NodeCache({ stdTTL: SEARCH_TTL });

/**
 * AggregatorLayer
 * 
 * Manages cross-provider coordination, caching, and normalization.
 * Standardizes identity using the deterministic hashes provided by BaseProvider.
 */
class AggregatorLayer {
    constructor() {
        this.cache = readerCache;
    }

    _normalizeTitle(title) {
        return title.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Resolve a raw URL to a provider and Identity Object.
     */
    resolveUrl(url) {
        if (!url) return null;
        const providers = providerRegistry.getProviders();
        for (const provider of providers) {
            if (url.startsWith(provider.baseUrl)) {
                return provider.wrapManga(url);
            }
        }
        return null;
    }

    /**
     * All-in-one search across all providers, or a specific provider.
     */
    async searchAll(query, targetProvider = null) {
        const cacheKey = `search_v2:${query}:${targetProvider || 'ALL'}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        let providers = providerRegistry.getProviders();
        if (targetProvider) {
            providers = providers.filter(p => p.name === targetProvider);
            if (providers.length === 0) {
                // If it doesn't match, return empty to not crash
                return { query, providersAvailable: [], results: {}, globalResults: [] };
            }
        }

        const searchPromises = providers.map(async (p) => {
            try {
                // Hard timeout for search requests (25 seconds) to allow Playwright-based providers (like Asura) 
                // enough time to spin up Cloudflare checks and resolve without hanging.
                // Since we now use manual targeted search, we can afford a longer timeout.
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Search Timeout')), 25000));

                let results = await Promise.race([p.search(query), timeoutPromise]);
                // If 0 results, retry with a "relaxed" query (e.g. stripping 's and punctuation)
                if ((!results || results.length === 0) && query.match(/['’´`]/)) {
                    let relaxedQuery = query.replace(/['’´`]s\b/gi, '').replace(/['’´`]/g, ' ').replace(/\s+/g, ' ').trim();
                    console.log(`[Aggregator] Relaxed query for ${p.name}: ${relaxedQuery}`);
                    results = await Promise.race([p.search(relaxedQuery), timeoutPromise]);
                }
                return { provider: p.name, success: true, results };
            } catch (err) {
                console.error(`[Aggregator] ${p.name} Search Error:`, err.message);
                return { provider: p.name, success: false, results: [] };
            }
        });

        const responses = await Promise.allSettled(searchPromises);

        let output = { query, providersAvailable: [], results: {}, globalResults: [] };
        let globalMaps = {}; // globalId -> NormalizedManhwa
        const normQuery = this._normalizeTitle(query);

        responses.forEach(({ status, value }) => {
            if (status === 'fulfilled' && value.success && value.results.length > 0) {
                output.providersAvailable.push(value.provider);

                // Sort by similarity to query for each provider
                const sorted = value.results.sort((a, b) => {
                    const simA = stringSimilarity.compareTwoStrings(this._normalizeTitle(a.title), normQuery);
                    const simB = stringSimilarity.compareTwoStrings(this._normalizeTitle(b.title), normQuery);
                    return simB - simA;
                });

                output.results[value.provider] = sorted;

                // Build global normalization map
                sorted.forEach(res => {
                    const normTitle = this._normalizeTitle(res.title);
                    const globalId = normTitle.replace(/\s+/g, '-');

                    if (!globalMaps[globalId]) {
                        globalMaps[globalId] = {
                            id: globalId, // Title-based slug for navigation
                            titles: [res.title],
                            cover: res.cover,
                            providers: {}
                        };
                    }

                    globalMaps[globalId].providers[value.provider] = {
                        id: res.id,    // The deterministic hash
                        url: res.url,
                        title: res.title
                    };
                });
            }
        });

        output.globalResults = Object.values(globalMaps);
        this.cache.set(cacheKey, output);
        return output;
    }

    /**
     * Get details and chapters.
     * @param {string} providerName 
     * @param {string} url - Canonical URL
     */
    async getMangaDetails(providerName, url) {
        const provider = providerRegistry.getProvider(providerName);
        if (!provider) throw new Error(`Provider ${providerName} not found`);

        const manga = provider.wrapManga(url);
        const cacheKey = `details_v2:${manga.id}`;

        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const details = await provider.getMangaDetails(manga);
        this.cache.set(cacheKey, details, DETAILS_TTL);
        return details;
    }

    /**
     * Get image pages.
     * @param {string} providerName 
     * @param {string} url - Canonical Chapter URL
     */
    async getPages(providerName, url) {
        const provider = providerRegistry.getProvider(providerName);
        if (!provider) throw new Error(`Provider ${providerName} not found`);

        const chapter = provider.wrapChapter(url);
        const cacheKey = `pages_v2:${chapter.id}`;

        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const pages = await provider.getPages(chapter);
        this.cache.set(cacheKey, pages, PAGES_TTL);
        return pages;
    }
}

module.exports = new AggregatorLayer();
