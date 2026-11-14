/* Series metadata from the sources, cached (hits and misses) in MetadataCache. (Split out of index.js, 2026-11-13.) */

const { connectDB } = require('../config/db');
const { normalizeTitle } = require('../utils/normalizeTitle');
const { fetchAniList, fetchBest, fetchJikan, fetchMangaDex } = require('../utils/metadataProxy');
const MetadataCache = require('../models/MetadataCache');
const { debugLog } = require('./log');

// ─── METADATA (cached) ────────────────────────────────────────────────────────

const META_SOURCES = ['ANILIST', 'MAL', 'MANGADEX'];

const META_HIT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// Short on purpose: a miss can be a source's outage or rate limit rather than a title no
// one knows, and a long-remembered miss would hide the cover and synopsis for days.
const META_MISS_TTL_MS = 30 * 60 * 1000;

const MAX_META_TITLE = 200;

/** One live lookup: the chosen source first and the others as fallbacks, or AUTO's
 *  parallel scoring across all three. */
const fetchMetadataFrom = async (title, source) => {
    const order = {
        ANILIST: [['AniList', fetchAniList], ['MangaDex', fetchMangaDex], ['MAL', fetchJikan]],
        MAL: [['MAL', fetchJikan], ['MangaDex', fetchMangaDex], ['AniList', fetchAniList]],
        MANGADEX: [['MangaDex', fetchMangaDex], ['AniList', fetchAniList], ['MAL', fetchJikan]],
    }[source];
    if (!order) return fetchBest(title);
    for (const [name, fetcher] of order) {
        const data = await fetcher(title);
        if (data) return data;
        debugLog(`[Proxy] ${name} miss for: ${title}`);
    }
    return null;
};

/**
 * Metadata for a title, from the shared cache while it is fresh, otherwise live (and then
 * cached). A cache fault never fails the lookup: it just falls through to the sources.
 * Returns `{ data, cached }`; `data` is null when no source knows the title.
 */
const lookupMetadata = async (title, source) => {
    const src = META_SOURCES.includes(source) ? source : 'AUTO';
    // normalizeTitle keeps only a-z0-9, so a title in another script would collapse to "".
    const key = `${src}|${normalizeTitle(title) || title.trim().toLowerCase()}`;
    await connectDB();
    try {
        const hit = await MetadataCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
        if (hit) return { data: hit.data, cached: true };
    } catch (err) {
        console.warn('[MetaCache] read failed:', err.message);
    }
    const data = await fetchMetadataFrom(title, src);
    try {
        await MetadataCache.updateOne(
            { key },
            { $set: { data: data || null, expiresAt: new Date(Date.now() + (data ? META_HIT_TTL_MS : META_MISS_TTL_MS)) } },
            { upsert: true },
        );
    } catch (err) {
        console.warn('[MetaCache] write failed:', err.message);
    }
    return { data, cached: false };
};

module.exports = { META_SOURCES, META_HIT_TTL_MS, META_MISS_TTL_MS, MAX_META_TITLE, fetchMetadataFrom, lookupMetadata };
