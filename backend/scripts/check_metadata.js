const { fetchAniList, fetchMangaDex } = require('../utils/metadataProxy');

async function checkMetadata() {
    const title = 'Reborn as the Strongest Swordsman';
    console.log(`Searching for: ${title}...`);

    try {
        // Try AniList first (via our internal proxy tool)
        let data = await fetchAniList(title);
        if (!data) {
            console.log('AniList missed, trying MangaDex...');
            data = await fetchMangaDex(title);
        }

        if (data) {
            console.log('\n--- Metadata Found ---');
            console.log('Title (EN):', data.title.english || data.title.romaji);
            console.log('Status:', data.status);
            console.log('Chapters:', data.chapters || 'Ongoing');
            console.log('Cover:', data.coverImage.extraLarge);
            console.log('Synopsis:', data.description.substring(0, 200) + '...');
            console.log('----------------------\n');
        } else {
            console.log('No metadata found in archives.');
        }
    } catch (e) {
        console.error('Error during fetch:', e.message);
    }
}

checkMetadata();
