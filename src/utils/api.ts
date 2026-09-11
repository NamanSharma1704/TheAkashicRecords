import { systemFetch } from './auth';

/**
 * Normalise a synopsis pulled from AniList / MangaDex / MAL into the small HTML subset
 * sanitizeHtml renders.
 *
 * The sources disagree on format: AniList sends HTML (<br>, <i>), MangaDex sends
 * markdown, and both append link blocks and source credits that are noise in a reading
 * tracker. This is the single copy — ManhwaDetail used to keep its own stricter version
 * while this one sat unused, and the add/edit modal stored descriptions uncleaned, which
 * is how "(Source: [YenPress](https://…))" and literal ** ended up on the detail page.
 *
 * Idempotent: running it on already-cleaned text changes nothing.
 */
export const cleanDescription = (desc: string | null | undefined, fallback = "No description available."): string => {
    if (!desc || !desc.trim()) return fallback;

    let text = desc
        // Trailing link block: a "---" rule followed by Original / Official / Links, etc.
        .replace(/\s*---[\s\S]*?(?:Original|Official|Translations|Links|Webtoon)[\s\S]*$/i, '')
        // The same block without a rule, introduced by a line break.
        .replace(/(?:\n|<br\s*\/?>)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Original Webtoon|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
        // A bare trailing horizontal rule.
        .split(/\s*-{3,}\s*$/)[0];

    // Markdown links keep their label and drop the URL. Allows one level of parentheses
    // inside the URL, which real links contain.
    text = text.replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g, '$1');

    // Source credits: "(Source: YenPress)", "(Source: MU)".
    text = text.replace(/\s*\(\s*Source\s*:[^)]*\)/gi, '');

    // Markdown emphasis → the two emphasis tags sanitizeHtml keeps.
    text = text
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/__(.+?)__/g, '<b>$1</b>')
        .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\w)/g, '$1<i>$2</i>');

    // Plain-text paragraphs. Only when the source isn't already HTML, so AniList's
    // "<br>\n" pairs don't double up.
    if (!/<br\s*\/?>/i.test(text)) text = text.replace(/\r?\n/g, '<br>');

    text = text.trim();
    return text || fallback;
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
