export const cleanDescription = (desc: string): string => {
    if (!desc) return "No description available.";
    return desc
        .replace(/(?:---|\*\*\*)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
        .split(/\s*-{3,}\s*$/)[0]
        .trim();
};

export const fetchAnilistCover = async (title: string) => {
    try {
        const query = `
        query ($search: String) {
          Media (search: $search, type: MANGA, sort: SEARCH_MATCH) {
            title {
                english
                romaji
            }
            coverImage {
              extraLarge
            }
            description
            chapters
          }
        }
        `;
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });
        const data = await response.json();
        return data.data.Media;
    } catch (e) {
        console.warn("AniList retrieval failed:", e);
        return null;
    }
};

export const fetchJikanCover = async (title: string) => {
    try {
        const searchUrl = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1&sfw=false`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const manga = data.data[0];
            return {
                title: { english: manga.title_english || manga.title },
                coverImage: { extraLarge: manga.images.jpg.large_image_url || manga.images.jpg.image_url },
                chapters: manga.chapters,
                description: manga.synopsis || ''
            };
        }
        return null;
    } catch (e) {
        console.warn("Jikan retrieval failed:", e);
        return null;
    }
};

export const fetchMangadex = async (title: string) => {
    try {
        const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=20&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive`);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return null;

        const cleanSearch = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const manga = searchData.data.find((m: any) => {
            const enTitle = m.attributes.title.en || Object.values(m.attributes.title)[0] as string;
            const cleanResult = enTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
            return cleanResult.includes(cleanSearch) || cleanSearch.includes(cleanResult);
        }) || searchData.data[0];

        const attributes = manga.attributes;
        const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art');
        const fileName = coverRel ? coverRel.attributes.fileName : '';
        const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : '';

        return {
            id: manga.id,
            title: {
                english: attributes.title.en || Object.values(attributes.title)[0] as string,
                romaji: attributes.title.en || Object.values(attributes.title)[0] as string,
                native: attributes.altTitles.find((t: any) => t.ja || t.ko)?.ja || attributes.altTitles.find((t: any) => t.ko)?.ko || ""
            },
            description: cleanDescription(attributes.description.en || ""),
            coverImage: {
                extraLarge: coverUrl,
                large: coverUrl
            },
            chapters: parseInt(attributes.lastChapter) || 0,
            status: attributes.status.toUpperCase(),
            siteUrl: `https://mangadex.org/title/${manga.id}`
        };
    } catch (e) {
        console.error("MangaDex Fetch Failed", e);
        return null;
    }
};

export const fetchAuto = async (title: string) => {
    const cleanQuery = title.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Try AniList first
    let result = await fetchAnilistCover(title);

    // Evaluate result quality
    const checkMatch = (res: any) => {
        if (!res) return false;
        const tEn = res.title?.english?.toLowerCase().replace(/[^a-z0-9]/g, '') || "";
        const tRo = res.title?.romaji?.toLowerCase().replace(/[^a-z0-9]/g, '') || "";
        return tEn.includes(cleanQuery) || cleanQuery.includes(tEn) ||
            tRo.includes(cleanQuery) || cleanQuery.includes(tRo);
    };

    let isGoodAnilist = checkMatch(result) && result?.coverImage?.extraLarge;

    // 2. If AniList is shaky or missing chapters, try MangaDex
    if (!isGoodAnilist || !result?.chapters) {
        const mdResult = await fetchMangadex(title);
        if (mdResult && mdResult.coverImage?.extraLarge) {
            if (!result) {
                result = mdResult;
            } else {
                // Merge: Keep AniList titles/images if good, but take MangaDex chapters
                result = {
                    ...result,
                    chapters: mdResult.chapters || result.chapters,
                    // If AniList was bad, take everything from MangaDex
                    ...(isGoodAnilist ? {} : mdResult)
                };
            }
        }
    }

    // 3. Final fallback to MAL if still missing chapters
    if (!result?.chapters) {
        const jikanResult = await fetchJikanCover(title);
        if (jikanResult) {
            if (!result) {
                result = jikanResult;
            } else {
                result.chapters = jikanResult.chapters || result.chapters;
            }
        }
    }

    return result;
};
