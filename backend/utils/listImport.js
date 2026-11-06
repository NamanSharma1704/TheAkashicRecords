/**
 * LIST IMPORT: reading lists from AniList, and MyAnimeList exports matched through AniList.
 *
 * AniList's GraphQL API serves any public list without a key. MyAnimeList's API needs a
 * client id, so MAL lists come in as the user's own export file (parsed in the browser), and
 * only their MAL ids reach the server, which asks AniList for the same series by `idMal`:
 * that is what gives a MAL row an English title, alternative titles, a cover and genres.
 *
 * AniList allows about 30 requests a minute (its "degraded" ceiling, in force since 2024),
 * so a list is read 500 entries per request and ids are looked up 50 per request.
 */

const ANILIST = 'https://graphql.anilist.co';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

/** An error with an HTTP status for the route to answer with. */
class ImportError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const aniListQuery = async (query, variables) => {
    const res = await fetchWithTimeout(ANILIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) throw new ImportError(429, 'AniList is rate-limiting requests. Wait a minute and try again.');
    const body = await res.json().catch(() => null);
    const message = body?.errors?.[0]?.message || '';
    if (/private user/i.test(message)) throw new ImportError(403, 'That AniList list is private. Make it public in AniList settings, or export it instead.');
    if (/user not found/i.test(message)) throw new ImportError(404, 'No AniList user by that name.');
    if (!res.ok || !body?.data) throw new ImportError(502, 'AniList did not answer. Try again in a moment.');
    return body.data;
};

const MEDIA_FIELDS = 'id idMal title { english romaji userPreferred } synonyms chapters coverImage { large } genres';

/** AniList list status -> archive status. */
const ANILIST_STATUS = {
    CURRENT: 'ACTIVE',
    REPEATING: 'ACTIVE',
    PLANNING: 'PLANNED',
    COMPLETED: 'CONQUERED',
    PAUSED: 'STASIS',
    DROPPED: 'SEVERED',
};

/** The name a series goes by here (English where AniList has one), and every other name it
 *  is known by, so a library that calls it something else still matches it. */
const namesOf = (media) => {
    const title = media.title?.english || media.title?.userPreferred || media.title?.romaji || '';
    const aliases = [media.title?.english, media.title?.romaji, media.title?.userPreferred, ...(media.synonyms || [])]
        .filter((n) => typeof n === 'string' && n.trim() && n !== title)
        .map((n) => n.trim());
    return { title: title.trim(), aliases: [...new Set(aliases)].slice(0, 12) };
};

/**
 * A public AniList manga list as entries: one per series (custom lists repeat entries from
 * the standard ones, so it goes by media id), at most 5,000.
 */
const fetchAniListList = async (userName) => {
    const query = `query ($user: String, $chunk: Int) {
        MediaListCollection(userName: $user, type: MANGA, chunk: $chunk, perChunk: 500) {
            hasNextChunk
            lists { isCustomList entries { status progress score(format: POINT_10) media { ${MEDIA_FIELDS} } } }
        }
    }`;
    const byMedia = new Map();
    for (let chunk = 1; chunk <= 10; chunk++) {
        const data = await aniListQuery(query, { user: userName, chunk });
        const collection = data.MediaListCollection;
        for (const list of collection?.lists || []) {
            for (const e of list.entries || []) {
                if (!e?.media?.id) continue;
                // A standard list wins over a custom one: it carries the real status.
                if (byMedia.has(e.media.id) && list.isCustomList) continue;
                byMedia.set(e.media.id, e);
            }
        }
        if (!collection?.hasNextChunk) break;
    }
    return [...byMedia.values()].map((e) => ({
        ...namesOf(e.media),
        status: ANILIST_STATUS[e.status] || 'ACTIVE',
        progress: Math.max(0, Math.floor(e.progress || 0)),
        chapters: e.media.chapters || 0,
        rating: e.score >= 1 && e.score <= 10 ? Math.round(e.score) : null,
        cover: e.media.coverImage?.large || '',
        genres: e.media.genres || [],
    }));
};

/** AniList's record for each MyAnimeList id it knows, keyed by that id. */
const lookupMalIds = async (malIds) => {
    const query = `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: MANGA) { ${MEDIA_FIELDS} } } }`;
    const found = {};
    for (let i = 0; i < malIds.length; i += 50) {
        const data = await aniListQuery(query, { ids: malIds.slice(i, i + 50) });
        for (const m of data.Page?.media || []) {
            if (!m.idMal) continue;
            found[m.idMal] = {
                ...namesOf(m),
                chapters: m.chapters || 0,
                cover: m.coverImage?.large || '',
                genres: m.genres || [],
            };
        }
    }
    return found;
};

module.exports = { fetchAniListList, lookupMalIds, ImportError };
