const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Quest = require('../models/Quest');

async function listQuests() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('Connected.');

        const quests = await Quest.find({}, 'title').limit(20);
        console.log('\n--- First 20 Quests in DB ---');
        quests.forEach(q => console.log(`- ${q.title}`));
        console.log('-----------------------------\n');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

listQuests();
