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
        const response = await fetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=ANILIST`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("AniList proxy retrieval failed:", e);
        return null;
    }
};

export const fetchJikanCover = async (title: string) => {
    try {
        const response = await fetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=MAL`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("MAL proxy retrieval failed:", e);
        return null;
    }
};

export const fetchMangadex = async (title: string) => {
    try {
        const response = await fetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=MANGADEX`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("MangaDex Proxy Fetch Failed", e);
        return null;
    }
};

export const fetchAuto = async (title: string) => {
    try {
        const response = await fetch(`${PROXY_URL}?title=${encodeURIComponent(title)}&source=AUTO`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("Auto proxy retrieval failed:", e);
        return null;
    }
};
