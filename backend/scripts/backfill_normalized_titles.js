/**
 * One-shot backfill for Quest.normalizedTitle.
 *
 * Documents created before that field existed have no value for it, so the create handler
 * falls back to scanning them on every new quest. Running this once populates the field
 * across a database and retires that fallback.
 *
 * Usage:
 *   node backend/scripts/backfill_normalized_titles.js                 # akashic_records
 *   node backend/scripts/backfill_normalized_titles.js test_records    # a specific database
 *   node backend/scripts/backfill_normalized_titles.js --all           # every non-system database
 *
 * Idempotent: re-running it changes nothing. Reports collisions rather than deleting
 * anything — use POST /api/admin/purge-duplicates for that.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { normalizeTitle } = require('../utils/normalizeTitle');

const backfillOne = async (conn, dbName) => {
    const quests = conn.db.collection('manhwas');
    const docs = await quests.find({}, { projection: { title: 1, normalizedTitle: 1 } }).toArray();

    if (docs.length === 0) {
        console.log(`  [${dbName}] empty, nothing to do`);
        return { scanned: 0, updated: 0, collisions: 0 };
    }

    const ops = [];
    const seen = new Map();
    let collisions = 0;

    for (const doc of docs) {
        const normalized = normalizeTitle(doc.title);

        if (seen.has(normalized)) {
            collisions++;
            console.log(`  [${dbName}] COLLISION: "${doc.title}" collides with "${seen.get(normalized)}"`);
        } else {
            seen.set(normalized, doc.title);
        }

        if (doc.normalizedTitle !== normalized) {
            ops.push({
                updateOne: { filter: { _id: doc._id }, update: { $set: { normalizedTitle: normalized } } }
            });
        }
    }

    if (ops.length > 0) await quests.bulkWrite(ops, { ordered: false });

    console.log(`  [${dbName}] scanned ${docs.length}, updated ${ops.length}, collisions ${collisions}`);
    return { scanned: docs.length, updated: ops.length, collisions };
};

(async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

    const arg = process.argv[2];
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected.\n');

    let targets;
    if (arg === '--all') {
        const { databases } = await mongoose.connection.db.admin().listDatabases();
        targets = databases
            .map(d => d.name)
            .filter(n => !['admin', 'local', 'config'].includes(n));
    } else {
        targets = [arg || 'akashic_records'];
    }

    const totals = { scanned: 0, updated: 0, collisions: 0 };
    for (const dbName of targets) {
        const conn = mongoose.connection.useDb(dbName, { useCache: true });
        const r = await backfillOne(conn, dbName);
        totals.scanned += r.scanned;
        totals.updated += r.updated;
        totals.collisions += r.collisions;
    }

    console.log(`\nDone. scanned=${totals.scanned} updated=${totals.updated} collisions=${totals.collisions}`);
    if (totals.collisions > 0) {
        console.log('Collisions found — run POST /api/admin/purge-duplicates before making the index unique.');
    }

    await mongoose.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
