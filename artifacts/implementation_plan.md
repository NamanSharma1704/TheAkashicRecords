# System Architect Report & Implementation Plan: Manhwa Reader Integration

## 0. Codebase Analysis (Current State)
The existing "Akashic Records" system is a high-fidelity, highly stylized Manhwa Tracker split into a React/Vite frontend and an Express/MongoDB backend.

### Architecture Summary
- **Backend**: Node.js + Express. Uses Mongoose for data persistence with a multi-tenant approach (`SOVEREIGN` vs `GUEST` modes to split databases). Heavy focus on security (rate limiting, SSRF checks) and performance. A proxy layer (`metadataProxy.js`) is used to fetch external metadata from sources like AniList, MangaDex, and MAL.
- **Frontend**: React + Vite framework using Motion for robust animations, TailwindCSS for styling (`system` workspace). The UI heavily invests in "Cinematic" aesthetics (Sololveling/System UI vibes) under `src/components/quest`, with components like `QuestCard.tsx` and `ManhwaDetail.tsx`.
- **Data Models**: Tracking utilizes the `Quest` model, which holds `title`, `cover`, `synopsis`, `totalChapters`, `currentChapter`, `status`, and `readLink` (an external URL).

### Gap Analysis
Currently, the system is fundamentally an **external-redirect tracker**. When a user clicks "INITIALIZE DIVE", they are navigated away from the portal via external links.
**Missing Pieces**:
1. **Source Scraping & Aggregation Engine**: Existing metadata fetching only pulls title descriptions and cover arts (via APIs), but not actual chapter arrays or reading pages.
2. **Standardized Provider Interface**: A need for modular, plug-and-play scrapers that handle HTML parsing from undocumented aggregation sites.
3. **Internal Caching & Rate Limiting System**: To avoid being IP-banned by aggregators and to ensure fast load times, chapter lists and page URLs must be heavily cached.
4. **Proxy for Pages**: Images from scraped providers usually block direct external domain loads via `Referer` checks. The backend's `/api/proxy/image` needs to be extended or repurposed for scraping provider image chains.
5. **Reader UI**: A vertical scrolling view inside `src/components/reader` that supports lazy loading, progress syncing with the `Quest` module, and provider-switching overlays.

---

## 1. Integration Plan

The focus is to add the Manhwa Reader **without rewriting the core tracker logic**. Instead, we extend the current data flow.

### Strategy
- **Backend Expansion**: Create a new `/backend/providers` directory. Implement an Aggregation Service that queries available providers in parallel using Promise.any/Promise.all techniques with fallback cascades.
- **Scraping Layer**: Utilize `axios` combined with `cheerio` for rapid DOM parsing. If an anti-bot check (like Cloudflare) is detected, fallback to `puppeteer`.
- **Frontend Expansion**: Intercept "INITIALIZE DIVE". Instead of opening a new tab, transition to a new Route/Overlay component `<SystemReader />`. This directly interfaces with the new API endpoints.

### Folder Structure (Proposed Additions)
```text
backend/
  └── services/
      └── aggregator/
          ├── AggregatorLayer.js       # Core parallel execution logic & caching
          ├── ProviderRegistry.js      # Plug-in management
          └── providers/
              ├── BaseProvider.js      # Interface enforcement
              ├── AsuraScans.js        # Axios+Cheerio implementation
              ├── ComixTo.js
              ├── ManhuaUs.js
              └── MgDemon.js
  └── controllers/
      └── readerController.js          # Express Route Handlers (search, chapters, pages)

src/
  └── components/
      └── reader/
          ├── SystemReader.tsx         # Main vertical scroll UI
          ├── ReaderOverlay.tsx        # HUD for chapter list & provider selection
          └── PageImage.tsx            # Lazy-loaded, proxied image component
```

---

## User Review Required

> [!IMPORTANT]
> **Anti-Bot Protections (Cloudflare)**
> Several of these proposed sites (especially AsuraScans) frequently toggle high Cloudflare "Under Attack" modes. Axios+Cheerio will instantly fail. 
> I propose we configure the backend to use `puppeteer` (specifically `puppeteer-extra-plugin-stealth`) natively for just the Cloudflare bypass phases, storing the resulting cookie session to be reused in lightweight Axios calls. Do you approve of injecting `puppeteer-extra` into the backend dependencies?

## 2. API Design & Sample Responses

### GET `/api/reader/search?q={title}`
Aggregates search results. Normalizes titles for exact and fuzzy matches.

**Sample Response**:
```json
{
  "success": true,
  "data": {
    "title": "The Beginning After The End",
    "providersAvailable": ["AsuraScans", "ComixTo", "ManhuaUs"],
    "results": [
      {
        "provider": "AsuraScans",
        "providerId": "the-beginning-after-the-end-123",
        "chapterCount": 175,
        "latestChapter": "175",
        "url": "..."
      }
    ]
  }
}
```

### GET `/api/reader/manhwa/:id/chapters?provider={name}`
Fetches the chapter list.

**Sample Response**:
```json
{
  "success": true,
  "provider": "AsuraScans",
  "chapters": [
    {
      "chapterId": "chap-175",
      "number": 175,
      "title": "Chapter 175",
      "date": "2023-01-01"
    }
  ]
}
```

### GET `/api/reader/chapter/:chapterId/pages?provider={name}`
Retrieves ordered array of image URLs to feed the reader frontend.

---

## 3. Aggregation Layer Implementation (CORE)

The Aggregation service will query providers in parallel to fetch chapters and deduplicate them.

```javascript
// backend/services/aggregator/AggregatorLayer.js

const providers = require('./ProviderRegistry').getProviders();
const NodeCache = require('node-cache');
const readerCache = new NodeCache({ stdTTL: 3600 }); // 1 Hour Cache

class AggregatorLayer {
    async searchAll(query) {
        const cacheKey = `search:${query}`;
        if (readerCache.has(cacheKey)) return readerCache.get(cacheKey);

        // Map searches concurrently
        const searchPromises = providers.map(async (provider) => {
            try {
                const results = await provider.search(query);
                return { provider: provider.name, success: true, results };
            } catch (err) {
                console.error(`[Reader] ${provider.name} Search Error:`, err.message);
                return { provider: provider.name, success: false, results: [] };
            }
        });

        const responses = await Promise.allSettled(searchPromises);
        
        let output = { query, providersAvailable: [], sources: {} };
        
        responses.forEach(({ status, value }) => {
            if (status === 'fulfilled' && value.success && value.results.length > 0) {
                output.providersAvailable.push(value.provider);
                output.sources[value.provider] = value.results;
            }
        });

        readerCache.set(cacheKey, output);
        return output;
    }
}
```

---

## 4. Fallback Logic & Smart Selection

When a user opens a Manhwa in the reader frontend, the backend runs a smart-select cascade:
1. Hits API: `/api/reader/chapters?title=Ranker_Who_Lives_A_Second_Time`
2. Aggregator checks all providers.
3. Automatically maps the best source based on heuristic scoring:
   - Speed/Ping
   - Is it in the `providersAvailable` array?
   - Chapter coverage quantity (who has the most chapters?)
4. If an image fails to load in the Reader UI (e.g. 403 Forbidden), the Frontend triggers an automatic Provider Swap, hitting the identical chapter using `provider=ComixTo` instead of `provider=AsuraScans`.

---

## 5. Full Provider Example (AsuraScans)

```javascript
// backend/services/aggregator/providers/AsuraScans.js
const BaseProvider = require('./BaseProvider');
const axios = require('axios');
const cheerio = require('cheerio');

class AsuraScans extends BaseProvider {
    constructor() {
        super();
        this.name = 'AsuraScans';
        this.baseUrl = 'https://asurascans.com';
        
        // Anti-Bot bypass proxy headers
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
                'Referer': this.baseUrl
            },
            timeout: 8000
        });
    }

    async search(query) {
        const res = await this.client.get(`/?s=${encodeURIComponent(query)}`);
        const $ = cheerio.load(res.data);
        
        let results = [];
        $('.bsx').each((i, el) => {
            const url = $(el).find('a').attr('href');
            const title = $(el).find('.tt').text().trim();
            const providerId = url.split('/').filter(Boolean).pop(); // Extract slug
            
            if(title) results.push({ provider: this.name, providerId, title, url });
        });
        
        return results;
    }

    async getChapters(manhwaId) {
        // Assume manhwaId is the manga slug path
        const res = await this.client.get(`/manga/${manhwaId}/`);
        const $ = cheerio.load(res.data);
        
        let chapters = [];
        $('#chapterlist li').each((i, el) => {
            const numText = $(el).find('.chapternum').text().trim(); // 'Chapter 175'
            const chapterUrl = $(el).find('a').attr('href');
            const chapterId = chapterUrl.split('/').filter(Boolean).pop();
            
            chapters.push({
                chapterId,
                number: parseFloat(numText.replace(/[^0-9.]/g, '')),
                url: chapterUrl
            });
        });
        
        return chapters; // Note: Ensure they are sorted consistently ASC or DESC
    }

    async getPages(chapterId) {
        // Scrapes the actual HTML page to find the image containers
        const res = await this.client.get(`/${chapterId}/`);
        const $ = cheerio.load(res.data);
        
        let pages = [];
        // Typically asura images are situated within `#readerarea img`
        $('#readerarea img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            // Ensure no tracking pixels are caught
            if(src && !src.includes('lazyload')) pages.push(src);
        });
        
        return pages;
    }
}

module.exports = new AsuraScans();
```

---

## 6. Frontend Reader Implementation Plan

The UI expansion will require a new `<SystemReader />` component overlaid on the application.

**State Machine Requirements:**
- `currentProvider`: Tracks the active scrape source.
- `chapterPages`: Array of strings representing the page image URLs for the current chapter string.
- `readingProgress`: Tracks what page the user is currently on (IntersectionObserver).

**Execution Logic:**
- **Proxy the Images:** Inject pages into `src="https://our-backend/api/proxy/image?url=${pageUrl}"` to bypass standard referrer locks placed by AsuraScans and Comix.to.
- **Lazy Image Loading:** Render vertical list with `loading="lazy"`. Maintain a skeleton state until the image fulfills.
- **Progress Synchronization:** Use `IntersectionObserver` on the last page container. Upon reaching the bottom 10% of the chapter, trigger a background API hit to `PUT /api/quests/:id` to iterate `currentChapter` up by +1. Provide visually striking cinematic feedback (e.g. golden pulse effect) when the chapter is absorbed successfully.

---

## Open Questions

1. **Caching Layer Infrastructure**: Currently we only use in-memory state or manual MongoDB records. For scraping heavy APIs, do you prefer a lightweight external DB connection like **Redis**, or is an in-memory `node-cache` acceptable for the caching logic?
2. **Missing Provider Content**: Manhuaus and Mgdemon specialize in entirely different genres than Asura. Should we display "Not Found" alerts natively within the UI when a provider has zero hits for a search term, or silently aggregate only confirmed hits?
