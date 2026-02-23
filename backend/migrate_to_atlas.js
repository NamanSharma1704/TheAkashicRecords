/**
 * migrate_to_atlas.js
 * Run once: node migrate_to_atlas.js
 * Copies all documents from local neo-scrolls/manhwas to Atlas akashic/manhwas
 */
const mongoose = require('mongoose');
require('dotenv').config();

const ATLAS_URI = process.env.MONGODB_URI; // Atlas from .env
const LOCAL_URI = 'mongodb://127.0.0.1:27017/neo-scrolls';

async function migrate() {
    console.log('Connecting to local MongoDB...');
    const local = await mongoose.createConnection(LOCAL_URI).asPromise();

    console.log('Connecting to Atlas...');
    const atlas = await mongoose.createConnection(ATLAS_URI).asPromise();

    const localCol = local.collection('manhwas');
    const atlasCol = atlas.collection('manhwas');

    const docs = await localCol.find({}).toArray();
    console.log(`Found ${docs.length} documents in local DB.`);

    if (docs.length === 0) {
        console.log('Nothing to migrate.');
        process.exit(0);
    }

    // Clear Atlas collection first to avoid duplicates on re-run
    await atlasCol.deleteMany({});

    const result = await atlasCol.insertMany(docs);
    console.log(`✅ Migrated ${result.insertedCount} documents to Atlas.`);

    await local.close();
    await atlas.close();
    process.exit(0);
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
