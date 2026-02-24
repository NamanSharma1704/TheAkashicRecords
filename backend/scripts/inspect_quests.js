const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function inspectQuests() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const quests = await db.collection('quests').find({}).toArray();
        console.log(JSON.stringify(quests, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

inspectQuests();
