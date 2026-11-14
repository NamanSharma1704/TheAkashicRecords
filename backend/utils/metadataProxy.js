const fetch = global.fetch; // Use global fetch (Node 18+)

// Fetch wrapper with AbortController-based timeout
const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const cleanDescription = (desc) => {
    if (!desc) return "No description available.";
    return desc
        .replace(/(?:---|\*\*\*)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
        .split(/\s*-{3,}\s*$/)[0]
        .trim();
};

const fetchAniList = async (title) => {
    const query = `
    query ($search: String) {
      Media (search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id
        title { english romaji native }
        synonyms
        description
        coverImage { extraLarge large }
        bannerImage
        genres
        averageScore
        meanScore
        status
        seasonYear
        chapters
        siteUrl
        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node {
              id
              name { full native }
              image { large medium }
            }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 6) {
          nodes {
            mediaRecommendation {
              id
              title { english romaji }
              coverImage { large }
              averageScore
            }
          }
        }
      }
    }
    `;

    const tryFetch = async (searchTitle) => {
        try {
            console.log(`[AniList] Probing Archives for: "${searchTitle}"`);
            const response = await fetchWithTimeout('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { search: searchTitle } })
            }, 8000);
            const data = await response.json();
            return data?.data?.Media || null;
        } catch (e) {
            if (e.name === 'AbortError') {
                console.warn(`[AniList] Timeout (8s) for "${searchTitle}" — skipping.`);
            } else {
                console.error(`[AniList] Probe Failed for "${searchTitle}":`, e.message);
            }
            return null;
        }
    };

    // 1. Try exact title
    let media = await tryFetch(title);

    // 2. Try cleaned title if failed (removes common suffixes that confuse search)
    if (!media) {
        const cleanedTitle = title
            .replace(/\s*(?:Manhwa|Webtoon|Manga|Scan|Official).*$/gi, '')
            .trim();
        if (cleanedTitle !== title) {
            console.log(`[AniList] Fallback: Searching for base nomenclature: "${cleanedTitle}"`);
            media = await tryFetch(cleanedTitle);
        }
    }

    if (media) {
        media.description = cleanDescription(media.description);
        // Every source reports its other names as `altTitles`: AUTO's exact-match scoring and
        // the cover backfill's same-series check both read it, and without it a series filed
        // under its official English title ("Return of the Blossoming Blade") never matched
        // the name it is better known by ("Return of the Mount Hua Sect").
        media.altTitles = media.synonyms || [];
        if (media.characters && media.characters.edges) {
            media.characters.nodes = media.characters.edges.map(e => ({ ...e.node, role: e.role }));
            console.log(`[AniList] Success: ${media.characters.nodes.length} entities detected for "${media.title.english || title}"`);
        }
        return media;
    }

    console.warn(`[AniList] No artifact match found for: "${title}"`);
    return null;
};

const fetchMangaDex = async (title) => {
    try {
        // Boost search with relevance and popularity sorting
        const searchUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=100&includes[]=cover_art&includes[]=author&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[relevance]=desc&order[followedCount]=desc`;

        const searchRes = await fetchWithTimeout(searchUrl, {}, 8000);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return null;

        const searchLower = title.toLowerCase().trim();

        // High Precision Matcher
        const manga = searchData.data.find(m => {
            const attr = m.attributes;
            const titles = [
                attr.title.en,
                ...Object.values(attr.title),
                ...attr.altTitles.map(at => Object.values(at)[0])
            ].filter(Boolean).map(t => t.toLowerCase().trim());

            // 1. Check for Exact Match (Highest Priority)
            if (titles.some(t => t === searchLower)) return true;

            // 2. Check if the search term perfectly encapsulates the title or vice versa
            // This helps with titles like "The Beginning After The End" vs "The Beginning After The End (Official)"
            return titles.some(t => {
                const searchWords = searchLower.split(/\s+/);
                if (searchWords.length > 3) { // Only do partial match for longer titles to stay precise
                    return t.includes(searchLower) || searchLower.includes(t);
                }
                return false;
            });
        }) || searchData.data[0];

        const attributes = manga.attributes;
        const coverRel = manga.relationships.find(r => r.type === 'cover_art');
        const fileName = coverRel ? coverRel.attributes.fileName : '';
        const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : '';

        // Get Recommendations (Basic tags check)
        let recommendations = [];
        const tags = (attributes.tags || [])
            .filter(t => t.attributes.group === 'genre')
            .slice(0, 2)
            .map(t => t.id);

        if (tags.length > 0) {
            const params = new URLSearchParams();
            params.append('limit', '6');
            params.append('includes[]', 'cover_art');
            tags.forEach(tagId => params.append('includedTags[]', tagId));
            params.append('contentRating[]', 'safe');

            const recRes = await fetchWithTimeout(`https://api.mangadex.org/manga?${params.toString()}`, {}, 6000);
            const recData = await recRes.json();
            if (recData.data) {
                recommendations = recData.data
                    .filter(m => m.id !== manga.id)
                    .map(m => {
                        const recCover = m.relationships.find(r => r.type === 'cover_art');
                        const recFileName = recCover ? recCover.attributes.fileName : '';
                        const recCoverUrl = recFileName ? `https://uploads.mangadex.org/covers/${m.id}/${recFileName}.256.jpg` : '';
                        return {
                            id: m.id,
                            mediaRecommendation: {
                                id: m.id,
                                title: { english: m.attributes.title.en || Object.values(m.attributes.title)[0] },
                                coverImage: { large: recCoverUrl },
                                averageScore: 0
                            }
                        };
                    });
            }
        }

        return {
            id: manga.id,
            title: {
                english: attributes.title.en || Object.values(attributes.title)[0],
                romaji: attributes.title.en || Object.values(attributes.title)[0],
                native: attributes.altTitles.find(t => t.ja || t.ko)?.ja || attributes.altTitles.find(t => t.ko)?.ko || ""
            },
            altTitles: (attributes.altTitles || []).flatMap((at) => Object.values(at)).filter(Boolean),
            description: cleanDescription(attributes.description.en),
            coverImage: { extraLarge: coverUrl, large: coverUrl },
            genres: attributes.tags.map(t => t.attributes.name.en),
            status: attributes.status.toUpperCase(),
            seasonYear: parseInt(attributes.year) || 0,
            siteUrl: `https://mangadex.org/title/${manga.id}`,
            characters: { nodes: [] },
            recommendations: { nodes: recommendations }
        };
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn(`[MangaDex] Timeout for "${title}" — skipping.`);
        } else {
            console.error("[Proxy] MangaDex Error:", e.message);
        }
        return null;
    }
};

// Best-effort character fetch from Jikan (MyAnimeList). Serves as a second character
// source so the row survives an AniList outage — AniList is otherwise the only provider,
// and it periodically goes dark (e.g. HTTP 403 "temporarily disabled"). Shaped to match
// the AniList character node so downstream merge/render logic is source-agnostic.
const fetchJikanCharacters = async (malId) => {
    try {
        const res = await fetchWithTimeout(`https://api.jikan.moe/v4/manga/${malId}/characters`, {}, 4000);
        if (res.status !== 200) return [];
        const data = await res.json();
        return (data.data || [])
            // Main cast first, then by MAL favourites so the strip leads with the leads.
            .sort((a, b) => {
                const rank = (r) => (r === 'Main' ? 0 : 1);
                return rank(a.role) - rank(b.role) || (b.favorites || 0) - (a.favorites || 0);
            })
            .slice(0, 12)
            .map(e => {
                const img = e.character?.images?.jpg?.image_url || "";
                return {
                    id: e.character?.mal_id,
                    name: { full: e.character?.name || "Unknown", native: "" },
                    image: { large: img, medium: img },
                    role: (e.role || "").toUpperCase()
                };
            })
            .filter(c => c.id != null);
    } catch {
        return []; // best-effort — never let a character miss sink the whole lookup
    }
};

const fetchJikan = async (title) => {
    try {
        const searchUrl = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1&sfw=false`;
        const response = await fetchWithTimeout(searchUrl, {}, 6000); // Tight 6s timeout — Jikan rate-limits aggressively
        // Jikan returns 429 when rate-limited — treat as a miss rather than hanging
        if (response.status === 429) {
            console.warn(`[Jikan] Rate-limited for "${title}" — skipping.`);
            return null;
        }
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const manga = data.data[0];
            // Small spacer before the follow-up call — Jikan rate-limits ~3 req/s.
            await new Promise(r => setTimeout(r, 400));
            const charNodes = await fetchJikanCharacters(manga.mal_id);
            if (charNodes.length) console.log(`[Jikan] ${charNodes.length} entities detected for "${manga.title}"`);
            return {
                id: manga.mal_id,
                title: {
                    english: manga.title_english || manga.title,
                    romaji: manga.title,
                    native: manga.title_japanese || ""
                },
                altTitles: [...(manga.title_synonyms || []), ...(manga.titles || []).map((t) => t.title)].filter(Boolean),
                description: cleanDescription(manga.synopsis),
                chapters: manga.chapters || 0,
                coverImage: {
                    extraLarge: manga.images.jpg.large_image_url || manga.images.jpg.image_url,
                    large: manga.images.jpg.image_url
                },
                status: manga.status ? manga.status.toUpperCase() : "UNKNOWN",
                genres: (manga.genres || []).map(g => g.name),
                siteUrl: manga.url,
                characters: { nodes: charNodes },
                recommendations: { nodes: [] }
            };
        }
        return null;
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn(`[Jikan] Timeout (10s) for "${title}" — skipping.`);
        } else {
            console.error("[Proxy] Jikan Error:", e.message);
        }
        return null;
    }
};

const fetchBest = async (title) => {
    const searchLower = title.toLowerCase().trim();
    const searchWords = new Set(searchLower.split(/\s+/));

    // 1. Fetch from all sources in parallel with a hard 12s ceiling on the whole batch.
    //    This prevents Jikan 429s or network hangs from stalling the bulk-classify loop.
    const hardTimeout = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), ms));
    const [aniResult, mdResult, jkResult] = await Promise.all([
        Promise.race([fetchAniList(title).catch(() => null), hardTimeout(11000)]),
        Promise.race([fetchMangaDex(title).catch(() => null), hardTimeout(11000)]),
        Promise.race([fetchJikan(title).catch(() => null), hardTimeout(11000)]),  // search + character follow-up; still within the batch's existing 11s ceiling
    ]);

    const results = [
        { source: 'ANILIST', data: aniResult },
        { source: 'MANGADEX', data: mdResult },
        { source: 'MAL', data: jkResult }
    ].filter(r => r.data !== null);

    if (results.length === 0) return null;

    // 2. Scoring Logic
    const scoredResults = results.map(res => {
        let score = 0;
        const d = res.data;
        const titles = [
            d.title.english,
            d.title.romaji,
            ...(d.title.native ? [d.title.native] : []),
            ...(d.altTitles || [])
        ].filter(Boolean).map(t => t.toLowerCase().trim());

        // Exact Match Bonus
        if (titles.some(t => t === searchLower)) {
            score += 100;
        }

        // Fuzzy/Word Overlap Score
        const maxOverlap = Math.max(...titles.map(t => {
            const words = t.split(/\s+/);
            const overlap = words.filter(w => searchWords.has(w)).length;
            return (overlap / Math.max(words.length, searchWords.size));
        }));
        score += maxOverlap * 50;

        // Data Richness Bonus
        if (d.chapters && d.chapters > 0) score += 20;
        if (d.description && d.description.length > 50) score += 10;
        if (d.genres && d.genres.length > 0) score += 5;
        if (d.coverImage && d.coverImage.extraLarge) score += 15;

        // Source Preference (User prefers MangaDex for Manhwa details)
        if (res.source === 'MANGADEX') score += 10;
        if (res.source === 'ANILIST') score += 5;

        return { ...res, score };
    });

    // 3. Sort by score and pick the best
    scoredResults.sort((a, b) => b.score - a.score);

    const winner = scoredResults[0].data;
    console.log(`[Proxy] AUTO Selection scores:`, scoredResults.map(r => `${r.source}: ${Math.round(r.score)}`));

    // 4. Enrich Winner: If winner is missing characters or recommendations, steal from others
    scoredResults.forEach(res => {
        if (res.data === winner) return;

        // Merge Characters if winner has none
        if ((!winner.characters || !winner.characters.nodes || winner.characters.nodes.length === 0) &&
            (res.data.characters && res.data.characters.nodes && res.data.characters.nodes.length > 0)) {
            console.log(`[Proxy] Enriching ${winner.title.english} with characters from ${res.source}`);
            winner.characters = res.data.characters;
        }

        // Merge Recommendations if winner has none
        if ((!winner.recommendations || !winner.recommendations.nodes || winner.recommendations.nodes.length === 0) &&
            (res.data.recommendations && res.data.recommendations.nodes && res.data.recommendations.nodes.length > 0)) {
            console.log(`[Proxy] Enriching ${winner.title.english} with recommendations from ${res.source}`);
            winner.recommendations = res.data.recommendations;
        }
    });

    return winner;
};

/**
 * fetchGenresOnly — Purpose-built for bulk-classify.
 * Only fetches genres (skips Jikan entirely to avoid TCP-hang rate limiting).
 * Uses tight 7s timeouts on AniList + MangaDex in parallel.
 * Returns: string[] of genres, or [] on any failure.
 */
const fetchGenresOnly = async (title) => {
    const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), ms));

    try {
        // AniList: Lightweight query — only title + genres, no characters/recommendations
        const aniListQuery = `
        query ($search: String) {
          Media (search: $search, type: MANGA, sort: SEARCH_MATCH) {
            genres
            title { english romaji }
          }
        }`;

        const aniListFetch = fetchWithTimeout('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: aniListQuery, variables: { search: title } })
        }, 7000).then(r => r.json()).then(d => d?.data?.Media?.genres || []).catch(() => []);

        // MangaDex: Tag-based genre fetch
        const mangaDexFetch = fetchWithTimeout(
            `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&order[relevance]=desc`,
            {},
            7000
        ).then(r => r.json()).then(d => {
            if (!d.data || d.data.length === 0) return [];
            return d.data[0].attributes.tags.map(t => t.attributes.name.en).filter(Boolean);
        }).catch(() => []);

        // Race both fetches with a hard 8s ceiling on the whole batch
        const [aniGenres, mdGenres] = await Promise.all([
            Promise.race([aniListFetch, timeout(8000).then(() => [])]),
            Promise.race([mangaDexFetch, timeout(8000).then(() => [])]),
        ]);

        // Merge and deduplicate genres from both sources
        const merged = [...new Set([...aniGenres, ...mdGenres])];
        return merged;
    } catch (e) {
        console.warn(`[fetchGenresOnly] Failed for "${title}": ${e.message}`);
        return [];
    }
};

/** Same rule as normalizeTitle: lowercase letters and digits only. */
const titleKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** An honest name for the release APIs (MangaDex, for one, refuses a disguised browser). */
const SOURCE_UA = 'AkashicRecords/1.0 (+https://the-akashic-records.vercel.app)';

/*
 * NEW-CHAPTER CHECKS. Each source is asked for one series in one of two ways:
 *  - BY ID, when an earlier check found the series there and the record kept the id
 *    (`sourceIds`, see syncChapters in index.js): one request, or none for AniList, whose ids
 *    are answered for the whole run in one batched query.
 *  - BY TITLE otherwise: a search, accepted only on an exact title (or alt-title) match, as
 *    always. A match hands back the id, so the next check goes straight to it.
 * Every source answers with an outcome, which is what lets the caller keep its records honest:
 *    found  the series is there (`id`; `counts` may be empty: AniList gives no count until a
 *           series has finished)
 *    miss   searched, and no exact match (searched again only after a while)
 *    lost   the stored id is gone from the source (a removal): forget it, search next time
 *    error  the source could not be asked (network, rate limit): nothing is concluded
 * A search that fails is an ERROR, never a miss: a 429 used to read as "no such series".
 */
const answer = (outcome, counts = [], id = null) => ({ outcome, counts, id });

/** Throws on any non-OK reply (so it counts as an error) except the statuses given. */
const okOr = (res, ...allowed) => {
    if (!res.ok && !allowed.includes(res.status)) throw new Error(`HTTP ${res.status}`);
    return res;
};

const MD_RATINGS = 'contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica';

/** MangaDex's highest English chapter for one series, or null if MangaDex no longer has it. */
const mangaDexHighest = async (id) => {
    const res = okOr(await fetchWithTimeout(`https://api.mangadex.org/manga/${encodeURIComponent(id)}/aggregate?translatedLanguage[]=en`,
        { headers: { 'User-Agent': SOURCE_UA } }, 8000), 404);
    if (res.status === 404) return null;
    const aggregate = await res.json();
    let highest = 0;
    for (const volume of Object.values(aggregate.volumes || {})) {
        for (const chapter of Object.values(volume.chapters || {})) {
            const n = parseFloat(chapter.chapter);
            if (Number.isFinite(n) && n > highest) highest = n;
        }
    }
    return Math.floor(highest);
};

/** A finished series' final chapter, as MangaDex states it (a licensed one may host fewer). */
const mangaDexLastChapter = (attributes) => {
    const last = parseFloat(attributes?.lastChapter);
    return Number.isFinite(last) && last > 0 ? Math.floor(last) : 0;
};

/** MangaDex: the highest English chapter it hosts, and the series' stated final chapter. */
const latestFromMangaDex = async (title, key, id, batch) => {
    if (id) {
        const highest = await mangaDexHighest(id);
        if (highest === null) return answer('lost');
        const counts = [highest, batch.mangadexLast?.get(id) || 0].filter((n) => n > 0);
        return answer('found', counts, id);
    }
    const search = okOr(await fetchWithTimeout(
        `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&order[relevance]=desc&${MD_RATINGS}`,
        { headers: { 'User-Agent': SOURCE_UA } }, 8000
    ));
    const data = await search.json();
    const match = (data.data || []).find((m) => {
        const a = m.attributes || {};
        const titles = [...Object.values(a.title || {}), ...(a.altTitles || []).flatMap((t) => Object.values(t))];
        return titles.some((t) => titleKey(t) === key);
    });
    if (!match) return answer('miss');
    const highest = await mangaDexHighest(match.id);
    const counts = [highest || 0, mangaDexLastChapter(match.attributes)].filter((n) => n > 0);
    return answer('found', counts, match.id);
};

/** AniList: a chapter count, which it reports only once a series has finished. */
const latestFromAniList = async (title, key, id, batch) => {
    if (id) {
        // Answered by the run's one batched query (prefetchChapterBatch).
        if (!batch.anilist) throw new Error('batch unavailable');
        if (!batch.anilist.has(Number(id))) return answer('lost');
        const chapters = batch.anilist.get(Number(id));
        return answer('found', chapters > 0 ? [chapters] : [], Number(id));
    }
    const res = okOr(await fetchWithTimeout('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            query: 'query ($s: String) { Media(search: $s, type: MANGA, sort: SEARCH_MATCH) { id chapters title { english romaji native } synonyms } }',
            variables: { s: title }
        })
    }, 8000), 404); // AniList answers "no such media" with a 404
    const media = res.status === 404 ? null : (await res.json())?.data?.Media;
    if (!media) return answer('miss');
    const names = [...Object.values(media.title || {}), ...(media.synonyms || [])];
    if (!names.some((t) => titleKey(t) === key)) return answer('miss');
    // Kept even without a count: an ongoing series gets one when it finishes.
    return answer('found', media.chapters > 0 ? [media.chapters] : [], media.id);
};

/** MangaUpdates formats that are not the comic itself: a novel, a doujinshi, an artbook. */
const MU_NOT_THE_COMIC = new Set(['Novel', 'Doujinshi', 'Artbook', 'Drama CD']);

/** MangaUpdates' latest recorded chapter for one series, or null if the series is gone. */
const mangaUpdatesLatest = async (id) => {
    const res = okOr(await fetchWithTimeout(`https://api.mangaupdates.com/v1/series/${encodeURIComponent(id)}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': SOURCE_UA } }, 8000), 404);
    if (res.status === 404) return null;
    const n = Number((await res.json())?.latest_chapter);
    return Number.isInteger(n) && n > 0 ? n : 0;
};

/**
 * MangaUpdates: the latest chapter its release tracking has recorded. It covers licensed
 * series MangaDex has dropped and ongoing ones AniList gives no count for. The search names
 * the title it matched (`hit_title`), so a series filed under its official English name
 * ("Return of the Blossoming Blade") is still found by the name it is read under ("Return of
 * the Mount Hua Sect"); the same exact-title rule as the other sources applies to that name
 * or the series' own title. The count itself needs the series record, a second request (the
 * only request, once the id is known).
 */
const latestFromMangaUpdates = async (title, key, id) => {
    if (id) {
        const n = await mangaUpdatesLatest(id);
        if (n === null) return answer('lost');
        return answer('found', n > 0 ? [n] : [], String(id));
    }
    const res = okOr(await fetchWithTimeout('https://api.mangaupdates.com/v1/series/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': SOURCE_UA },
        body: JSON.stringify({ search: title, perpage: 10 })
    }, 8000));
    const hit = ((await res.json())?.results || []).find((r) =>
        r?.record?.series_id && !MU_NOT_THE_COMIC.has(r.record.type)
        && [r.hit_title, r.record.title].some((t) => titleKey(t) === key));
    if (!hit) return answer('miss');
    const seriesId = String(hit.record.series_id);
    const n = await mangaUpdatesLatest(seriesId);
    return answer('found', n ? [n] : [], seriesId);
};

/** The sources, by the key each one's id is kept under on a record (`sourceIds.<key>`). */
const CHAPTER_SOURCES = [
    ['mangadex', 'MangaDex', latestFromMangaDex],
    ['anilist', 'AniList', latestFromAniList],
    ['mangaupdates', 'MangaUpdates', latestFromMangaUpdates],
];
const CHAPTER_SOURCE_KEYS = CHAPTER_SOURCES.map(([k]) => k);

/**
 * What a whole run can learn in one request per source, before the series are checked:
 * AniList's count for every known AniList id (one GraphQL page per 50), and MangaDex's stated
 * final chapter for every known MangaDex id (one listing per 100). A batch that fails leaves
 * its map unset: AniList's id'd series then count as an error this run, and MangaDex's simply
 * go without the final-chapter figure (their hosted chapters still come per series).
 */
const prefetchChapterBatch = async ({ mangadex = [], anilist = [] }) => {
    const batch = { anilist: null, mangadexLast: null };
    const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
    await Promise.all([
        (async () => {
            if (!anilist.length) { batch.anilist = new Map(); return; }
            const found = new Map();
            for (const ids of chunks(anilist.map(Number), 50)) {
                const res = okOr(await fetchWithTimeout('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        query: 'query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: MANGA) { id chapters } } }',
                        variables: { ids }
                    })
                }, 8000));
                for (const m of (await res.json())?.data?.Page?.media || []) found.set(m.id, m.chapters || 0);
            }
            batch.anilist = found;
        })().catch((e) => console.warn(`[Chapters] AniList batch unavailable: ${e.message}`)),
        (async () => {
            if (!mangadex.length) return;
            const found = new Map();
            for (const ids of chunks(mangadex, 100)) {
                const qs = ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join('&');
                const res = okOr(await fetchWithTimeout(`https://api.mangadex.org/manga?${qs}&limit=100&${MD_RATINGS}`,
                    { headers: { 'User-Agent': SOURCE_UA } }, 8000));
                for (const m of (await res.json())?.data || []) found.set(m.id, mangaDexLastChapter(m.attributes));
            }
            batch.mangadexLast = found;
        })().catch((e) => console.warn(`[Chapters] MangaDex batch unavailable: ${e.message}`)),
    ]);
    return batch;
};

/**
 * Best-effort count of released chapters for one series, for new-chapter tracking.
 *
 * `ids` are the ids the record kept from earlier checks; `ask` the sources to ask at all (the
 * caller skips a source that recently found nothing by title); `batch` comes from
 * prefetchChapterBatch. Returns `latest` (a whole number, or null when no source knows) and
 * each asked source's answer, so the caller can keep new ids and forget lost ones.
 *
 * The sources are patchy, and this is honest about it:
 *  - MangaDex's /aggregate lists every chapter it hosts in English, ongoing series included,
 *    but many licensed manhwa have been removed from MangaDex entirely.
 *  - AniList (`chapters`) only reports a count once a series has FINISHED.
 *  - MangaUpdates records releases, licensed series included; its figure can lead or trail
 *    the site you read on by a chapter or two.
 * So a title is matched ONLY exactly (or by alt-title): a fuzzy hit on the wrong series could
 * invent hundreds of chapters. The sources are asked at once; the highest figure wins, and the
 * caller never lowers a stored total on it (a source is often behind the site you read on).
 * One source failing never costs the others.
 */
const checkLatestChapter = async (title, { ids = {}, ask = CHAPTER_SOURCE_KEYS, batch = {} } = {}) => {
    const key = titleKey(title);
    if (!key) return { latest: null, answers: {} };
    const answers = {};
    await Promise.all(CHAPTER_SOURCES.filter(([k]) => ask.includes(k)).map(async ([k, name, lookup]) => {
        answers[k] = await lookup(title, key, ids[k] || null, batch).catch((e) => {
            console.warn(`[Chapters] ${name} unavailable for "${title}": ${e.message}`);
            return answer('error');
        });
    }));
    const counts = Object.values(answers).flatMap((a) => a.counts);
    return { latest: counts.length ? Math.max(...counts) : null, answers };
};

/**
 * RELEASE RADAR: the days a source recorded releases of one series, newest first, distinct.
 * MangaUpdates first (it records official and group releases, licensed series included; the
 * release date is a day, no time); else MangaDex's English chapters (readableAt). By the ids the
 * chapter tracker already keeps, never by a title search. `{ source, days }`; no days when
 * neither source has the series by id.
 */
const releaseDaysFor = async (ids = {}) => {
    if (ids.mangaupdates) {
        const res = okOr(await fetchWithTimeout('https://api.mangaupdates.com/v1/releases/search', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': SOURCE_UA },
            body: JSON.stringify({ search: String(ids.mangaupdates), search_type: 'series', perpage: 40, orderby: 'date', asc: 'desc' }),
        }, 8000));
        const data = await res.json();
        const days = [...new Set((data?.results || []).map((r) => r?.record?.release_date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')))];
        if (days.length) return { source: 'MangaUpdates', days };
    }
    if (ids.mangadex) {
        const res = okOr(await fetchWithTimeout(
            `https://api.mangadex.org/manga/${encodeURIComponent(ids.mangadex)}/feed?translatedLanguage[]=en&order[readableAt]=desc&limit=40&${MD_RATINGS}`,
            { headers: { 'User-Agent': SOURCE_UA } }, 8000), 404);
        if (res.ok) {
            const data = await res.json();
            const days = [...new Set((data?.data || []).map((c) => String(c?.attributes?.readableAt || c?.attributes?.publishAt || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
            if (days.length) return { source: 'MangaDex', days };
        }
    }
    return { source: null, days: [] };
};

module.exports = { fetchAniList, fetchMangaDex, fetchJikan, fetchBest, fetchGenresOnly, checkLatestChapter, prefetchChapterBatch, releaseDaysFor, CHAPTER_SOURCE_KEYS };
