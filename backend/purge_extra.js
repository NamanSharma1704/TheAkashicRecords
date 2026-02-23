const mongoose = require('mongoose');
const Quest = require('./models/Quest');
require('dotenv').config();

// IDs to delete: Nov-25 markdown import batch + near-duplicates
const NOV25_IDS = [
    '6925a36f01c38d6beccf8c31', // Tomb Raider King (dup)
    '6925a36f01c38d6beccf8c2f', // The World's Best Engineer (dup)
    '6925a36f01c38d6beccf8c28', // The Priest of Corruption (0ch)
    '6925a36f01c38d6beccf8c1c', // Supreme Curse Master (0ch)
    '6925a36f13d83d62ab5a50e4', // I'll Be Taking a Break for Personal Reasons (0ch)
    '6925a37001c38d6beccf8c37', // Versatile Mage (0ch)
    '6925a37001c38d6beccf8c33', // Transcension Academy (dup)
];

// Near-duplicates to remove (keeping the canonical version)
const NEAR_DUPE_TITLES = [
    "Omniscient Reader",            // keep "Omniscient Reader's Viewpoint"
    "Level Up with Skills",         // keep "Levelling Up with Skills" (or vice versa — remove one)
    "The Academy's Genius Swordsman", // 0ch
    "Ki ni Natteru Hito ga Otoko Janakatta", // 0ch Japanese title
    "I Became a Part-Time Employee for Gods", // 0ch
    "Gods' Gambit", // 0ch check
    "I'll Be Taking a Break for Personal Reasons", // already in NOV25
];

async function purge() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Before:', await Quest.countDocuments(), 'records');

    // Delete Nov-25 batch by ID
    for (const id of NOV25_IDS) {
        try {
            const r = await Quest.findByIdAndDelete(id);
            if (r) console.log('DELETED (batch):', r.title);
        } catch (e) { console.warn('Skip', id, e.message); }
    }

    // Delete near-duplicates by title
    for (const title of NEAR_DUPE_TITLES) {
        const found = await Quest.findOne({ title });
        if (found) {
            await Quest.findByIdAndDelete(found._id);
            console.log('DELETED (near-dupe):', found.title);
        }
    }

    const remaining = await Quest.find().sort({ title: 1 });
    const total = remaining.reduce((s, q) => s + (q.currentChapter || 0), 0);
    console.log('\n=== REMAINING RECORDS ===');
    remaining.forEach((q, i) => console.log((i + 1) + '. [' + q.currentChapter + 'ch] ' + q.title));
    console.log('---');
    console.log('Total records:', remaining.length, '| Total chapters:', total);
    process.exit(0);
}

purge().catch(e => { console.error(e); process.exit(1); });
