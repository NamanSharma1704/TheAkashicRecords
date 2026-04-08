const { BaseProvider, ParsingError } = require('./BaseProvider');
const BrowserManager = require('../BrowserManager');
const cheerio = require('cheerio');

/**
 * Validates whether a URL is a REAL manga/manhwa chapter reader page.
 */
function _isValidReaderUrl(candidateUrl) {
    try {
        const urlObj = new URL(candidateUrl, 'http://dummy.url');
        const path = urlObj.pathname.toLowerCase();
        const search = urlObj.search.toLowerCase();
        const fullUrlStr = candidateUrl.toLowerCase();

        // 1. REJECT GENERIC / ROUTER PAGES
        // (Make exception for valid query-based sites like demonicscans which use chaptered.php?manga=X&chapter=Y)
        if (fullUrlStr.includes('.php')) {
            const hasExplicitChapterParams = search.includes('manga=') && search.includes('chapter=');
            if (!hasExplicitChapterParams) {
                const invalidPatterns = ['manga.php', 'series.php', 'reader.php', 'index.php'];
                if (invalidPatterns.some(pattern => fullUrlStr.includes(pattern))) return false;
                if (fullUrlStr.includes('chaptered.php')) return false; // Reject if it doesn't have the params
            }
        } else {
            if (fullUrlStr.includes('/ajax/')) return false;
            // Reject other query-heavy endpoints unless they match known structures
            if ((search.includes('?id=') || search.includes('?chapter=')) && !fullUrlStr.includes('demonicscans.org')) return false;
        }

        // 2. REQUIRE CHAPTER NUMBER IN URL
        // Allow pure query strings like ?manga=9275&chapter=396, or standard paths with trailing numbers
        const hasChapterIdentifier = /(?:chapter|ch|episode|ep)[-_/]?\d+/i.test(path) || search.includes('chapter=');
        if (!hasChapterIdentifier) return false;

        // 3. STRUCTURAL PATTERN
        // If it's a valid query-based URL, bypass the slug path requirement
        if (!search.includes('manga=') || !search.includes('chapter=')) {
            const pathSegments = path.split('/').filter(Boolean);
            if (pathSegments.length === 0) return false;
            
            const slugPattern = /[a-z]{3,}/i; 
            if (!slugPattern.test(path.replace(/(?:chapter|ch|episode|ep)[-_/]?\d+/i, ''))) return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

class UniversalProvider extends BaseProvider {
    constructor() {
        super();
        this.name = 'Universal';
        this.baseUrl = ''; // Universal doesn't have a single base url
    }

    async search(query) {
        console.log(`[Universal] Search bypassed for: ${query}`);
        return [];
    }

    
    _parseMangaDetails($, manga, pageOrigin) {
        const normalizeUrl = (p) => {
            if (!p) return '';
            if (p.startsWith('http')) return p;
            if (p.startsWith('//')) return 'https:' + p;
            try { return new URL(p, pageOrigin).href; } catch { return p; }
        };

        const title = $('h1').first().text().trim() || $('title').text().replace(/manga|read|chapter|-|free/gi, '').trim() || manga.title || 'Unknown Title';
        const description = $('.synopsis, .summary, .description, [itemprop="description"]').first().text().trim() || 'No description found.';

        let cover = manga.cover;
        if (!cover) {
            const coverImg = $('.thumb img, .summary_image img, .poster img, .manga-poster img').first();
            cover = coverImg.attr('src') || coverImg.attr('data-src') || coverImg.attr('content');
        }

        const chaptersList = [];
        const parsedMangaUrl = new URL(manga.url);
        const mangaSegments = parsedMangaUrl.pathname.split('/').filter(Boolean);
        const potentialSlugs = mangaSegments.filter(s => s.length > 3 && !/^episode-\d+|^chapter-\d+/i.test(s));
        const mainSlug = potentialSlugs.length > 0 ? potentialSlugs[potentialSlugs.length - 1].toLowerCase() : null;

        let chapterContainer = null;
        let maxValidLinks = 0;

        $('div, ul, section, tbody, tr').each((_, el) => {
            const classId = ($(el).attr('class') || '') + ' ' + ($(el).attr('id') || '');
            if (/(sidebar|related|trending|popular|recommendations|footer|header|widget)/i.test(classId)) return;

            let validLinkCount = 0;
            $(el).find('a').each((_, a) => {
                const href = $(a).attr('href') || '';
                const text = $(a).text() || '';
                if (/chapter|ch[-.]?\s*\d+|episode/i.test(href) || /chapter|ch[-.]?\s*\d+|episode/i.test(text)) {
                    validLinkCount++;
                }
            });

            if (validLinkCount > maxValidLinks) {
                maxValidLinks = validLinkCount;
                chapterContainer = el;
            }
        });

        const targetScope = (chapterContainer && maxValidLinks > 0) ? $(chapterContainer).find('a') : $('a');

        let rawChapters = [];
        targetScope.each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href.includes('#') || href.includes('javascript:')) return;

            let absoluteUrl;
            try {
                absoluteUrl = new URL(href, pageOrigin).href;
            } catch (e) { return; }

            if (!_isValidReaderUrl(absoluteUrl)) return;
            if (new URL(absoluteUrl).origin !== pageOrigin) return;

            const text = $(el).text().trim();
            const titleAttr = $(el).attr('title') || '';
            const combinedStr = `${href} ${text} ${titleAttr}`.toLowerCase();

            if (/chapter|ch[-.]?\s*\d+|episode/.test(combinedStr)) {
                let numMatch = text.match(/(?:Chapter|Ch\.?|Episode)\s*(\d+[\.]?\d*)/i) || 
                               href.match(/(?:chapter|ch|episode)[-a-zA-Z0-9=]*(\d+[\.]?\d*)/i) ||
                               titleAttr.match(/(?:Chapter|Ch\.?)\s*(\d+[\.]?\d*)/i);
                
                if (!numMatch) numMatch = text.match(/(\d+[\.]?\d*)/);
                if (!numMatch) {
                    const fallbackMatch = href.match(/(?:-|\/)(\d+[\.]?\d*)(?:\/|\.html|\.php|)$/i);
                    if (fallbackMatch) numMatch = fallbackMatch;
                }

                const number = numMatch ? parseFloat(numMatch[1]) : null;
                
                if (number !== null && !isNaN(number)) {
                    rawChapters.push({
                        url: absoluteUrl,
                        number: number,
                        title: text || `Chapter ${number}`,
                        path: new URL(absoluteUrl).pathname
                    });
                }
            }
        });

        let filteredChapters = rawChapters;
        if (mainSlug) {
            const withSlug = rawChapters.filter(c => c.url.toLowerCase().includes(mainSlug));
            if (withSlug.length > 0 && withSlug.length >= rawChapters.length * 0.2) {
                filteredChapters = withSlug;
            }
        }

        const pathPrefixCounts = {};
        for (const c of filteredChapters) {
            let prefix = c.path.replace(/\d+[\.]?\d*/g, '').replace(/\/?$/, '');
            pathPrefixCounts[prefix] = (pathPrefixCounts[prefix] || 0) + 1;
        }
        
        let dominantPrefix = null;
        let maxCount = 0;
        for (const [prefix, count] of Object.entries(pathPrefixCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantPrefix = prefix;
            }
        }

        if (dominantPrefix && maxCount > 2) {
            filteredChapters = filteredChapters.filter(c => {
                let prefix = c.path.replace(/\d+[\.]?\d*/g, '').replace(/\/?$/, '');
                return prefix === dominantPrefix || c.path.includes(dominantPrefix);
            });
        }

        const uniqueMap = new Map();
        for (const ch of filteredChapters) {
            const isQueryBased = ch.url.includes('?manga=') && ch.url.includes('&chapter=');
            const cleanUrl = isQueryBased ? ch.url : ch.url.split('?')[0]; 
            
            let idStr = String(ch.number);
            try {
                idStr = isQueryBased 
                    ? require('crypto').createHash('md5').update(cleanUrl).digest('hex') 
                    : require('crypto').createHash('md5').update(cleanUrl.replace(/\/+$/, '')).digest('hex');
            } catch (e) {}

            const wrapped = { 
                url: cleanUrl, 
                number: ch.number, 
                title: ch.title, 
                id: idStr 
            };
            
            if (!uniqueMap.has(ch.number) || cleanUrl.length < uniqueMap.get(ch.number).url.length) {
                uniqueMap.set(ch.number, wrapped);
            }
        }
        const finalChapters = Array.from(uniqueMap.values());
        const finalApproved = finalChapters.length < 3 ? [] : finalChapters;
        const uniqueChapters = finalApproved.sort((a, b) => b.number - a.number);

        return {
            ...manga,
            title,
            description,
            cover: normalizeUrl(cover),
            chapters: uniqueChapters
        };
    }

    async getMangaDetails(manga) {
        try {
            return await BrowserManager.withPage(async (page) => {
                console.log(`[Universal][Details] Fetching metadata for ${manga.url}`);
                await page.goto(manga.url, { waitUntil: 'load', timeout: 45000 });
                try {
                    await page.waitForLoadState('networkidle', { timeout: 15000 });
                } catch (e) {}

                try {
                    const turnstileFrame = await page.waitForSelector('iframe[src*="turnstile"]', { timeout: 5000 });
                    if(turnstileFrame) {
                        await page.waitForTimeout(3000);
                        const box = await turnstileFrame.boundingBox();
                        if(box) {
                            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                            await Promise.race([
                                page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
                                page.waitForURL(u => u.href !== manga.url, { timeout: 30000 }).catch(() => {})
                            ]);
                            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                        }
                    }
                } catch(e) {}

                let html;
                for (let i = 0; i < 3; i++) {
                    try {
                        html = await page.content();
                        break;
                    } catch (navError) {
                        await page.waitForTimeout(2000);
                    }
                }
                if(!html) throw new Error('Failed to get page content due to continuous navigation');
                
                const $ = cheerio.load(html);
                const pageOrigin = new URL(manga.url).origin;
                
                return this._parseMangaDetails($, manga, pageOrigin);
            });
        } catch (e) {
            if (e.message === 'SERVERLESS_UNSUPPORTED') {
                console.log(`[Universal][Details] Serverless HTTP fallback for ${manga.url}`);
                const res = await this.request(manga.url);
                const $ = cheerio.load(res.data);
                const pageOrigin = new URL(manga.url).origin;
                return this._parseMangaDetails($, manga, pageOrigin);
            }
            throw e;
        }
    }
}

module.exports = UniversalProvider;
