import { systemFetch } from './auth';

export const cleanDescription = (desc: string): string => {
    if (!desc) return "No description available.";
    return desc
        .replace(/(?:---|\*\*\*)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
        .split(/\s*-{3,}\s*$/)[0]
        .trim();
};

const PROXY_URL = "/api/proxy/metadata";

export const fetchAnilistCover = async (title: string) => {
    try {
        const response = await systemFetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=ANILIST`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("AniList proxy retrieval failed:", e);
        return null;
    }
};

export const fetchJikanCover = async (title: string) => {
    try {
        const response = await systemFetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=MAL`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("MAL proxy retrieval failed:", e);
        return null;
    }
};

export const fetchMangadex = async (title: string) => {
    try {
        const response = await systemFetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=MANGADEX`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("MangaDex Proxy Fetch Failed", e);
        return null;
    }
};

export const fetchAuto = async (title: string) => {
    try {
        const response = await systemFetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=AUTO`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("Auto proxy retrieval failed:", e);
        return null;
    }
};
/**
 * Wrap an origin image URL so it is fetched through the relay.
 *
 * Call this at RENDER time only. The origin URL is what belongs in state and in the
 * database — a proxied path is deployment-relative and stops being meaningful the moment
 * the app moves, so it must never be persisted. See unproxyImageUrl.
 */
export const getProxiedImageUrl = (url: string | undefined): string => {
    if (!url || !url.startsWith('http')) return url || "";
    // Avoid proxying if already proxied or a local blob
    if (url.includes('/api/proxy/image')) return url;
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
};

const PROXY_PREFIX = '/api/proxy/image?url=';

/**
 * Recover the origin URL from a proxied one, leaving anything else untouched.
 *
 * Quests were previously mapped through getProxiedImageUrl on the way IN from the API,
 * and the edit form posted that mapped value straight back out — so saving any existing
 * quest rewrote its stored cover as "/api/proxy/image?url=..." in MongoDB. Unwrapping on
 * the way in means state always holds the origin URL, and records already rewritten are
 * repaired the next time they are saved.
 */
export const unproxyImageUrl = (url: string | undefined): string => {
    if (!url) return "";

    const idx = url.indexOf(PROXY_PREFIX);
    if (idx === -1) return url;

    // Trailing params (e.g. &referer=) are not part of the origin URL.
    const encoded = url.slice(idx + PROXY_PREFIX.length).split('&')[0];
    try {
        return decodeURIComponent(encoded);
    } catch {
        return url; // malformed percent-encoding — leave it alone
    }
};
