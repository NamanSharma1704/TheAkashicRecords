const cheerio = require('cheerio');

/**
 * Validates whether a URL is a REAL manga/manhwa chapter reader page.
 * 
 * @param {string} candidateUrl - The URL to validate
 * @param {string} [htmlString] - Optional HTML content of the page
 * @returns {boolean} TRUE if valid reader page, FALSE otherwise
 */
function isValidReaderPage(candidateUrl, htmlString) {
    try {
        const urlObj = new URL(candidateUrl, 'http://dummy.url'); // Fallback base for relative URLs
        const path = urlObj.pathname.toLowerCase();
        const search = urlObj.search.toLowerCase();
        const fullUrlStr = candidateUrl.toLowerCase();

        // --------------------------------------------------
        // 1. REJECT GENERIC / ROUTER PAGES (CRITICAL)
        // --------------------------------------------------
        const invalidPatterns = [
            'chaptered.php', 'manga.php', 'series.php', 'reader.php', 'index.php', '/ajax/'
        ];
        if (invalidPatterns.some(pattern => fullUrlStr.includes(pattern))) {
            return false;
        }
        
        // Reject query-heavy endpoints (?id=, ?chapter=, etc.)
        if (search.includes('?id=') || search.includes('?chapter=')) {
            return false;
        }

        // --------------------------------------------------
        // 2. REQUIRE CHAPTER NUMBER IN URL
        // --------------------------------------------------
        // Must contain a numeric identifier typically bound to a chapter or episode
        const hasChapterIdentifier = /(?:chapter|ch|episode|ep)[-_]?\d+/i.test(path);
        if (!hasChapterIdentifier) {
            return false;
        }

        // --------------------------------------------------
        // 3. STRUCTURAL PATTERN
        // --------------------------------------------------
        // URL should have a minimum length to include a series slug, e.g. /{slug}/chapter-{number}
        const pathSegments = path.split('/').filter(Boolean);
        if (pathSegments.length === 0) {
            return false; // Root domain / too short
        }
        
        // Ensure there's some alphabetical representation (the slug) beyond just a chapter word
        const slugPattern = /[a-z]{3,}/i; 
        if (!slugPattern.test(path.replace(/(?:chapter|ch|episode|ep)[-_]?\d+/i, ''))) {
            return false; // Very generic / no slug found
        }

        // --------------------------------------------------
        // CONTENT & HTML-BASED SIGNALS (if HTML provided)
        // --------------------------------------------------
        if (htmlString) {
            const $ = cheerio.load(htmlString);
            
            // 4. CONTENT SIGNAL
            // Calculate valid images in the body, ignoring typical UI elements
            const readerImages = $('img').filter((i, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src') || '';
                const srcLower = src.toLowerCase();
                // Strip out expected non-comic images based on naming conventions
                return src && 
                       !srcLower.includes('logo') && 
                       !srcLower.includes('icon') && 
                       !srcLower.includes('avatar') &&
                       !srcLower.includes('banner');
            });

            // If finding images <= 2 -> REJECT
            if (readerImages.length <= 2) {
                // (Without complex JS execution, we strictly rely on early HTML image tags or lazy load data-tags)
                return false;
            }

            // 5. ANTI-CONTAMINATION
            // Check anchor tags linking to different manga series. Valid reader pages usually
            // scope strongly to the single running comic.
            const seriesLinks = new Set();
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('/manga/') || href.includes('/series/'))) {
                    // Normalize base paths to determine unique comic series
                    try {
                        const lUrl = new URL(href, 'http://dummy.url').pathname.split('/').slice(0, 3).join('/');
                        seriesLinks.add(lUrl);
                    } catch (e) { }
                }
            });

            // If the page contains a high volume of links routing to multiple distinct series
            // it resembles a listing/grid or home page, rather than a dedicated vertical reader.
            if (seriesLinks.size > 3) {
                return false;
            }
        }

        // --------------------------------------------------
        // 6. CONFIDENCE RULE
        // --------------------------------------------------
        // Reaching this point means no invalid router patterns caught it, 
        // it contains a clear chapter numeric suffix, and it passed structural tests.
        return true;
        
    } catch (error) {
        // Broad confidence rule: If the URL fails basic parsing, it's not trustworthy.
        return false;
    }
}

module.exports = { isValidReaderPage };
