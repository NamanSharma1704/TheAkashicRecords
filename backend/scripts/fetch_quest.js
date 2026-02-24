const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Quest = require('../models/Quest');

async function fetchQuest() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('MONGODB_URI not found in .env');
            return;
        }

        await mongoose.connect(uri);
        console.log('Connected to MongoDB.');

        const title = 'Reborn as the Strongest Swordsman';
        // Case-insensitive search
        const quest = await Quest.findOne({ title: { $regex: new RegExp(`^${title.trim()}$`, "i") } });

        if (quest) {
            console.log('\n--- Quest Data Found ---');
            console.log(JSON.stringify(quest, null, 2));
            console.log('------------------------\n');
        } else {
            console.log(`\nQuest "${title}" not found in database.\n`);

            // Try partial match to be helpful
            const similar = await Quest.find({ title: { $regex: new RegExp(title.split(' ')[0], "i") } }).limit(5);
            if (similar.length > 0) {
                console.log('Similar titles found:');
                similar.forEach(q => console.log(`- ${q.title}`));
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

fetchQuest();
