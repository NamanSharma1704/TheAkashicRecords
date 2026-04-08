const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * TYPED ERRORS
 * Providers must throw these to ensure consistent error handling across the system.
 */
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}
class ParsingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ParsingError';
        this.status = 422;
    }
}
class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NetworkError';
        this.status = 502;
    }
}
class RateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
        this.status = 429;
    }
}

/**
 * BaseProvider
 * 
 * CORE PRINCIPLES:
 * - URL is the only source of truth.
 * - IDs must be deterministic (hash of canonical URL).
 * - Shared resolver engine for multi-strategy extraction.
 * - Request resilience with exponential backoff.
 */
class BaseProvider {
    constructor() {
        this.name = "BaseProvider";
        this.baseUrl = "";
        this.client = axios.create({
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            }
        });
    }

    /**
     * Centralized request wrapper with retries and exponential backoff.
     */
    async request(url, options = {}, attempts = 2) {
        const normUrl = this.normalizeUrl(url);
        const config = {
            ...options,
            url: normUrl,
            headers: { ...this.client.defaults.headers, ...options.headers, 'Referer': this.baseUrl }
        };

        for (let i = 0; i < attempts; i++) {
            try {
                const res = await this.client.request(config);

                // Map logical errors
                if (res.status === 404) throw new NotFoundError(`Path 404: ${normUrl}`);
                if (res.status === 429) throw new RateLimitError(`Rate limited: ${normUrl}`);

                // Retry triggers for transient server errors
                if (res.status >= 500 || res.status === 403) {
                    if (i === attempts - 1) throw new NetworkError(`HTTP ${res.status}: ${normUrl}`);
                    const delay = 500;
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                return res;
            } catch (err) {
                if (err instanceof NotFoundError || err instanceof RateLimitError || i === attempts - 1) throw err;
                const delay = 500;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    /**
     * Multi-strategy Page Resolver Engine.
     */
    async resolvePages(chapter, strategies) {
        const res = await this.request(chapter.url);
        const html = res.data;
        const $ = cheerio.load(html);
        const context = { chapter, provider: this, client: this.client };

        for (const strategy of strategies) {
            try {
                const strategyName = strategy.name || 'AnonymousStrategy';
                const pages = await strategy.call(this, html, $, context);

                if (Array.isArray(pages) && pages.length > 3) {
                    console.log(`[${this.name}][${strategyName}] SUCCESS (${pages.length} pages)`);
                    return this.normalizeResult(pages);
                }
                console.log(`[${this.name}][${strategyName}] FAIL (insufficient pages)`);
            } catch (e) {
                console.warn(`[${this.name}][${strategy.name || 'unnamed'}] ERROR:`, e.message);
            }
        }

        throw new ParsingError(`All ${strategies.length} strategies failed to extract pages for ${chapter.url}`);
    }

    // --- STANDARD STRATEGIES ---

    async nextDataStrategy(html) {
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
        if (!match) return null;
        const data = this.safeJSONParse(match[1]);
        return this.extractImagesFromJSON(data);
    }

    async apiDiscoveryStrategy(html, $, context) {
        const apiMatch = html.match(/[\"\'](\/api\/chapter\/[^\"\']+)[\"\']/);
        if (!apiMatch) return null;
        try {
            const res = await this.request(apiMatch[1]);
            return this.extractImagesFromJSON(res.data);
        } catch (e) { return null; }
    }

    async preloadStrategy(html, $) {
        const pages = [];
        $('link[rel="preload"][as="image"]').each((_, el) => {
            const href = $(el).attr('href');
            if (this.isValidImage(href)) pages.push(href);
        });
        return pages;
    }

    async astroStrategy(html, $) {
        let best = [];
        $("astro-island").each((_, el) => {
            const props = this.safeJSONParse($(el).attr('props') || '');
            const found = this.extractImagesFromJSON(props);
            if (found.length > best.length) best = found;
        });
        return best;
    }

    async scriptRegexStrategy(html) {
        const regex = /(https?:\/\/[^\s\'\"]+\.(webp|jpg|png|jpeg))/gi;
        const matches = html.match(regex) || [];
        return matches.filter(u => this.isValidImage(u));
    }

    async domStrategy(html, $) {
        const pages = [];
        const selectors = ['#reader', '.reader-area', '.chapter-content', 'main'];
        selectors.forEach(s => {
            $(s).find('img').each((_, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src');
                if (this.isValidImage(src)) pages.push(src);
            });
        });
        return pages;
    }

    // --- SHARED UTILITIES ---

    createId(input) {
        if (!input) return "";
        return crypto.createHash('md5').update(this.normalizeUrl(input)).digest('hex');
    }

    normalizeUrl(url) {
        if (!url) return "";
        let u = url.trim();
        if (u.startsWith('//')) u = 'https:' + u;
        if (!u.startsWith('http') && this.baseUrl) {
            u = `${this.baseUrl.replace(/\/+$/, '')}/${u.replace(/^\/+/, '')}`;
        }
        
        const isQueryBased = u.includes('?manga=') || u.includes('?id=') || u.includes('?chapter=');
        if (isQueryBased) {
            return u.replace(/\/+$/, '').split('#')[0].replace(/\\u002f/g, '/');
        }
        
        return u.replace(/\/+$/, '').split('?')[0].split('#')[0].replace(/\\u002f/g, '/');
    }

    isValidImage(url) {
        if (!url) return false;
        const u = url.toLowerCase();
        // Priority check for chapter storage paths
        if (u.includes('chapters/') || u.includes('asura-images') || u.includes('manga-images')) return true;

        // Final sanity filter
        if (!u.match(/\.(webp|jpg|png|jpeg|bmp)$/i)) return false;
        return !u.match(/(logo|avatar|banner|discord|promo|author|wp-|profile|thumb|sticky|facebook|twitter|instagram|reddit|ads|google)/i);
    }

    extractImagesFromJSON(obj) {
        const urls = [];
        const traverse = (item) => {
            if (!item) return;
            if (typeof item === 'string') {
                if (this.isValidImage(item) && item.startsWith('http')) urls.push(item);
            } else if (Array.isArray(item)) {
                item.forEach(traverse);
            } else if (typeof item === 'object') {
                Object.values(item).forEach(traverse);
            }
        };
        traverse(obj);
        return urls;
    }

    safeJSONParse(str) {
        if (!str) return null;
        try {
            // Unescape common HTML entities
            const cleaned = str.replace(/&quot;/g, '\"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
            return JSON.parse(cleaned);
        } catch (e) { return null; }
    }

    normalizeResult(pages) {
        const unique = this.dedupePreserveOrder(pages);
        return unique.map(u => this.normalizeUrl(u)).filter(u => u && u.startsWith('http'));
    }

    dedupePreserveOrder(arr) {
        return [...new Set(arr)];
    }

    wrapManga(url) {
        const normUrl = this.normalizeUrl(url);
        return { id: this.createId(normUrl), url: normUrl, provider: this.name };
    }

    wrapChapter(url, meta = {}) {
        const normUrl = this.normalizeUrl(url);
        return {
            id: this.createId(normUrl),
            url: normUrl,
            number: parseFloat(meta.number) || 0,
            title: (meta.title || "").trim()
        };
    }
}

module.exports = {
    BaseProvider,
    NotFoundError,
    ParsingError,
    NetworkError,
    RateLimitError
};
