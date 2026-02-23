const mongoose = require('mongoose');
const Quest = require('./models/Quest');
require('dotenv').config();

async function dedup() {
    console.log("Connecting...");
    await mongoose.connect(process.env.MONGODB_URI);

    const all = await Quest.find().sort({ updatedAt: 1 }); // oldest first
    console.log('Total before:', all.length);

    const seen = new Map();
    const toDelete = [];

    for (const q of all) {
        const key = q.title.trim().toLowerCase();
        if (seen.has(key)) {
            const existing = seen.get(key);
            // Keep whichever record has more data (link, cover, chapters)
            const existingScore = (existing.link ? 2 : 0) + (existing.coverUrl ? 2 : 0) + (existing.totalChapters ? 1 : 0);
            const currentScore = (q.link ? 2 : 0) + (q.coverUrl ? 2 : 0) + (q.totalChapters ? 1 : 0);

            if (currentScore > existingScore) {
                // Current record is better — delete the old one, keep this
                toDelete.push(existing._id);
                seen.set(key, q);
                console.log(`SWAP  "${q.title}" -> keeping newer/richer record`);
            } else {
                // Existing is better or equal — delete current
                toDelete.push(q._id);
                console.log(`DROP  "${q.title}" -> duplicate`);
            }
        } else {
            seen.set(key, q);
        }
    }

    console.log(`\nDeleting ${toDelete.length} duplicates...`);
    for (const id of toDelete) {
        await Quest.findByIdAndDelete(id);
    }

    const remaining = await Quest.countDocuments();
    const totalCh = await Quest.aggregate([{ $group: { _id: null, total: { $sum: '$currentChapter' } } }]);
    console.log('Remaining records:', remaining);
    console.log('Total chapters read:', totalCh[0]?.total || 0);
    process.exit(0);
}

dedup().catch(e => { console.error(e); process.exit(1); });
