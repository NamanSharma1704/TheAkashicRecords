const mongoose = require('mongoose');
const Quest = require('./models/Quest');
const https = require('https');
require('dotenv').config();

// Simple fetch utility for AniList (backend equivalent)
async function fetchAnilist(title) {
    const query = `
    query ($search: String) {
      Media (search: $search, type: MANGA) {
        chapters
        title {
            english
            romaji
        }
      }
    }
    `;
    return new Promise((resolve) => {
        const req = https.request('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data && json.data.Media) {
                        resolve(json.data.Media.chapters);
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.write(JSON.stringify({ query, variables: { search: title } }));
        req.end();
    });
}

// Simple fetch utility for Jikan (MAL)
async function fetchJikan(title) {
    return new Promise((resolve) => {
        https.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data && json.data[0]) {
                        resolve(json.data[0].chapters);
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function sync() {
    console.log("Connecting to Monolith DB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const quests = await Quest.find({ $or: [{ totalChapters: null }, { totalChapters: 0 }] });
    console.log(`Found ${quests.length} artifacts missing total chapters.`);

    for (const quest of quests) {
        console.log(`Scanning: ${quest.title}...`);

        let chapters = await fetchAnilist(quest.title);

        if (!chapters) {
            chapters = await fetchJikan(quest.title);
        }

        if (chapters && chapters > 0) {
            quest.totalChapters = chapters;
            await quest.save();
            console.log(`  -> Restored: ${chapters} chapters. (${quest._id})`);
        } else {
            console.log(`  -> Archive incomplete for this artifact. (${chapters === 0 ? '0 ch found' : 'No entry found'})`);
        }

        // Avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log("Synchronization complete.");
    process.exit(0);
}

sync().catch(err => {
    console.error(err);
    process.exit(1);
});
