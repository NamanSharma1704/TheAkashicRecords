const { fetchBest } = require('../backend/utils/metadataProxy');

async function verifyAggregation() {
    console.log("--- METADATA AGGREGATION VERIFICATION ---");
    const title = "The Beginning After The End";

    try {
        const result = await fetchBest(title);

        console.log(`\nTitle: ${result.title.english}`);
        console.log(`Source Ranking Context: ${result.source || 'AUTO'}`);

        const hasCharacters = result.characters && result.characters.nodes && result.characters.nodes.length > 0;
        const hasRecommendations = result.recommendations && result.recommendations.nodes && result.recommendations.nodes.length > 0;

        console.log(`[VERIFY] Characters Detectable: ${hasCharacters ? "YES" : "NO"}`);
        console.log(`[VERIFY] Recommendations Available: ${hasRecommendations ? "YES" : "NO"}`);

        if (hasCharacters) {
            console.log(`[DATA] Sample Character: ${result.characters.nodes[0].name.full}`);
        }

        if (hasRecommendations) {
            console.log(`[DATA] Sample Recommendation: ${result.recommendations.nodes[0].mediaRecommendation.title.english}`);
        }

    } catch (e) {
        console.error("Aggregation Test Failed:", e);
    }
}

verifyAggregation();
