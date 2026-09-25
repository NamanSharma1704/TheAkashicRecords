const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/** host/database only — a MONGODB_URI for Atlas carries the password in its userinfo. */
const describe = (uri) => {
    try {
        const u = new URL(uri);
        return `${u.host}${u.pathname}`;
    } catch {
        return '(unparseable MONGODB_URI)';
    }
};

async function diagnose() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not set (backend/.env)');
        await mongoose.connect(uri);
        console.log('Connected to:', describe(uri));

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
