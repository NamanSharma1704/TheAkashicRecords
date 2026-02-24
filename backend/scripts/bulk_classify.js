const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Quest = require('../models/Quest');

const inferClassFromTitle = (title) => {
    const t = title.toLowerCase();
    if (t.includes('necromancer') || t.includes('undead')) return "NECROMANCER";
    if (t.includes('mage') || t.includes('magic') || t.includes('constellation') || t.includes('star')) return "CONSTELLATION";
    if (t.includes('irregular') || t.includes('tower')) return "IRREGULAR";
    if (t.includes('return') || t.includes('reincarnat') || t.includes('wizard')) return "MAGE";
    if (t.includes('player') || t.includes('ranker') || t.includes('level')) return "PLAYER";
    return "PLAYER";
};

const bulkClassify = async () => {
    try {
        console.log("Connecting to Akashic Records Database...");
        await connectDB();

        const quests = await Quest.find({
            $or: [
                { classType: 'UNKNOWN' },
                { classType: { $exists: false } },
                { classType: '' }
            ]
        });

        console.log(`Found ${quests.length} unclassified records.`);

        let updatedCount = 0;
        for (const quest of quests) {
            const newClass = inferClassFromTitle(quest.title);
            quest.classType = newClass;
            await quest.save();
            updatedCount++;
            if (updatedCount % 5 === 0) {
                console.log(`Classified ${updatedCount}/${quests.length}...`);
            }
        }

        console.log(`Bulk Classification Success. ${updatedCount} records synchronized.`);
        process.exit(0);
    } catch (err) {
        console.error("Critical Migration Failure:", err.message);
        process.exit(1);
    }
};

bulkClassify();
