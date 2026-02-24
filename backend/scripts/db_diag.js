const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('Connected to:', uri);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('\n--- Collections ---');
        for (let col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`- ${col.name} (${count} docs)`);
        }
        console.log('-------------------\n');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
