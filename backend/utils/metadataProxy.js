const fetch = global.fetch; // Use global fetch (Node 18+)

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
        characters(sort: ROLE, perPage: 10) {
          edges {
            role
            node {
              id
              name { full }
              image { large }
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

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: title } })
        });
        const data = await response.json();
        if (data.data && data.data.Media) {
            const media = data.data.Media;
            media.description = cleanDescription(media.description);
            if (media.characters && media.characters.edges) {
                media.characters.nodes = media.characters.edges.map(e => ({ ...e.node, role: e.role }));
            }
            return media;
        }
        return null;
    } catch (e) {
        console.error("[Proxy] AniList Error:", e.message);
        return null;
    }
};

const fetchMangaDex = async (title) => {
    try {
        // Boost search with relevance and popularity sorting
        const searchUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=100&includes[]=cover_art&includes[]=author&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[relevance]=desc&order[followedCount]=desc`;

        const searchRes = await fetch(searchUrl);
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
                const words = t.split(/\s+/);
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

            const recRes = await fetch(`https://api.mangadex.org/manga?${params.toString()}`);
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
        console.error("[Proxy] MangaDex Error:", e.message);
        return null;
    }
};

const fetchJikan = async (title) => {
    try {
        const searchUrl = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1&sfw=false`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const manga = data.data[0];
            return {
                id: manga.mal_id,
                title: {
                    english: manga.title_english || manga.title,
                    romaji: manga.title,
                    native: manga.title_japanese || ""
                },
                description: cleanDescription(manga.synopsis),
                chapters: manga.chapters || 0,
                coverImage: {
                    extraLarge: manga.images.jpg.large_image_url || manga.images.jpg.image_url,
                    large: manga.images.jpg.image_url
                },
                status: manga.status ? manga.status.toUpperCase() : "UNKNOWN",
                genres: (manga.genres || []).map(g => g.name),
                siteUrl: manga.url,
                characters: { nodes: [] },
                recommendations: { nodes: [] }
            };
        }
        return null;
    } catch (e) {
        console.error("[Proxy] Jikan Error:", e.message);
        return null;
    }
};

const fetchBest = async (title) => {
    const searchLower = title.toLowerCase().trim();
    const searchWords = new Set(searchLower.split(/\s+/));

    // 1. Fetch from all sources in parallel
    const [aniResult, mdResult, jkResult] = await Promise.all([
        fetchAniList(title).catch(() => null),
        fetchMangaDex(title).catch(() => null),
        fetchJikan(title).catch(() => null)
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

    console.log(`[Proxy] AUTO Selection scores:`, scoredResults.map(r => `${r.source}: ${Math.round(r.score)}`));

    return scoredResults[0].data;
};

module.exports = { fetchAniList, fetchMangaDex, fetchJikan, fetchBest };
