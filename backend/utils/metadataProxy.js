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
        const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=20&includes[]=cover_art&includes[]=author&includes[]=manga&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`);
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return null;

        // Better Matching: Check all titles and alt titles
        const manga = searchData.data.find(m => {
            const titles = [
                m.attributes.title.en,
                ...Object.values(m.attributes.title),
                ...m.attributes.altTitles.map(at => Object.values(at)[0])
            ].filter(Boolean).map(t => t.toLowerCase().trim());

            const searchLower = title.toLowerCase().trim();
            // Check for exact match or contains
            return titles.some(t => t === searchLower || t.includes(searchLower) || searchLower.includes(t));
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

module.exports = { fetchAniList, fetchMangaDex };
