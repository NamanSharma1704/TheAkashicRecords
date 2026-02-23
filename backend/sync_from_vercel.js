const mongoose = require('mongoose');
const Quest = require('./models/Quest');
require('dotenv').config();

const VERCEL_API = 'https://neo-scrolls.vercel.app/api/manhwa';

function normalize(str) {
    return str.trim().toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // remove punctuation
        .replace(/\s+/g, ' ')         // collapse spaces
        .replace(/\bthe\b/g, '')      // remove leading 'the'
        .trim();
}

function scoreSimilarity(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1.0;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    // Count matching words
    const setA = new Set(na.split(' ').filter(w => w.length > 2));
    const setB = new Set(nb.split(' ').filter(w => w.length > 2));
    let matches = 0;
    setA.forEach(w => { if (setB.has(w)) matches++; });
    return matches / Math.max(setA.size, setB.size);
}

async function syncFromVercel() {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Fetching from Vercel...');
    const res = await fetch(VERCEL_API);
    const vercelData = await res.json();
    console.log(`Vercel: ${vercelData.length} records`);

    const localAll = await Quest.find();

    let synced = 0, skipped = 0, notFound = 0;

    for (const vq of vercelData) {
        // Find best local match by title similarity
        let bestMatch = null, bestScore = 0;
        for (const lq of localAll) {
            const score = scoreSimilarity(vq.title, lq.title);
            if (score > bestScore) { bestScore = score; bestMatch = lq; }
        }

        if (!bestMatch || bestScore < 0.5) {
            console.log(`  [NO MATCH] "${vq.title}" (best: "${bestMatch?.title}", score: ${bestScore.toFixed(2)})`);
            notFound++;
            continue;
        }

        const updateFields = {};
        // Only overwrite empty fields — never downgrade data
        if (vq.coverUrl && !bestMatch.coverUrl) updateFields.coverUrl = vq.coverUrl;
        if (vq.link && !bestMatch.link) updateFields.link = vq.link;
        if (vq.synopsis && !bestMatch.synopsis) updateFields.synopsis = vq.synopsis;
        if (vq.rating && !bestMatch.rating) updateFields.rating = vq.rating;
        if (vq.totalChapters && !bestMatch.totalChapters) updateFields.totalChapters = vq.totalChapters;

        // Always sync currentChapter from Vercel if it's higher (Vercel is authoritative)
        if (vq.currentChapter > (bestMatch.currentChapter || 0)) {
            updateFields.currentChapter = vq.currentChapter;
        }

        if (Object.keys(updateFields).length > 0) {
            await Quest.findByIdAndUpdate(bestMatch._id, updateFields);
            console.log(`  [SYNC] "${vq.title}" -> "${bestMatch.title}" (${Object.keys(updateFields).join(', ')})`);
            // Update local cache
            Object.assign(bestMatch, updateFields);
            synced++;
        } else {
            console.log(`  [OK]   "${vq.title}" -> "${bestMatch.title}"`);
            skipped++;
        }
    }

    console.log(`\nSynced: ${synced} | OK already: ${skipped} | Not found: ${notFound}`);
    const withLink = await Quest.countDocuments({ link: { $ne: '' } });
    const withCover = await Quest.countDocuments({ coverUrl: { $ne: '' } });
    const totalCh = await Quest.aggregate([{ $group: { _id: null, t: { $sum: '$currentChapter' } } }]);
    console.log(`Records with link: ${withLink} | with coverUrl: ${withCover}`);
    console.log(`Total chapters: ${totalCh[0]?.t}`);
    process.exit(0);
}

syncFromVercel().catch(e => { console.error(e); process.exit(1); });
