/* Guest sandboxes: capacity, and reaping the stale ones. (Split out of index.js, 2026-11-13.) */

const mongoose = require('mongoose');
const { connectDB, getTenantDb } = require('../config/db');

// --- AUTH MIDDLEWARE ---

/**
 * Resiliently purges a guest sandbox.
 * Tries to drop the database, falls back to wiping collections if permissions are missing.
 */
const resilientPurge = async (dbConn, dbName) => {
    try {
        await dbConn.dropDatabase();
        console.log(`[PURGE] Successfully dropped database: ${dbName}`);
    } catch (err) {
        // Handle common permission errors (Atlas Error 8000 / not allowed)
        if (err.message.includes('not allowed') || err.code === 8000) {
            console.warn(`[PURGE] PERMISSION_DENIED: Cannot drop database shell for [${dbName}].`);
            console.warn(`[PURGE] FALLBACK: Wiping content only. Grant 'dbAdmin' roles for full shell removal.`);
            
            try {
                // Use native driver to bypass model collision issues
                await dbConn.db.collection('manhwas').deleteMany({});
                console.log(`[PURGE] Fallback Success: Wiped clinical data in ${dbName}`);
            } catch (wipeErr) {
                console.error(`[PURGE] Fallback Failure in [${dbName}]:`, wipeErr.message);
            }
        } else {
            console.error(`[PURGE] Critical Failure in [${dbName}]:`, err.message);
        }
    }
};

// ─── GUEST SANDBOX CAPACITY ───────────────────────────────────────────────────
// Guest mode is a public portfolio demo and must stay frictionless, so these bounds are
// set well above real demand: they exist to cap a flood, not to gate a visitor.
const SANDBOX_SOFT_THRESHOLD = 25;

 // reap opportunistically from here
const SANDBOX_HARD_CAP = 60;

       // refuse new sandboxes beyond this

/**
 * Count live guest sandboxes. Returns null if the cluster will not report them, in which
 * case the caller proceeds without a cap — a demo visitor is never blocked by the
 * bookkeeping failing.
 */
const countGuestSandboxes = async () => {
    try {
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        return databases.filter(d => d.name.startsWith('gsb_')).length;
    } catch (err) {
        console.warn('[GUEST_INIT] Sandbox census unavailable, proceeding uncapped:', err.message);
        return null;
    }
};

// ─── STALE SANDBOX REAPER ─────────────────────────────────────────────────────

/**
 * Identifies and drops gsb_* guest sandbox databases older than 2 hours.
 * Returns a summary so the caller can report what it did.
 */
const purgeStaleSandboxes = async () => {
    console.log('[REAPER] Starting maintenance check...');
    await connectDB();

    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    let inspected = 0;
    let purged = 0;

    for (const dbInfo of databases) {
        if (dbInfo.name.startsWith('gsb_')) {
            inspected++;
            const parts = dbInfo.name.split('_');
            // parts[0] = gsb, parts[1] = g, parts[2] = <base36_timestamp>
            const timestamp = parseInt(parts[2], 36);

            if (!isNaN(timestamp) && (now - timestamp) > TWO_HOURS_MS) {
                console.log(`[REAPER] Purging stale sandbox: ${dbInfo.name}`);
                const conn = await getTenantDb(dbInfo.name);
                await resilientPurge(conn, dbInfo.name);
                purged++;
            }
        }
    }

    console.log(`[REAPER] Cycle complete. Inspected ${inspected}, purged ${purged}.`);
    return { inspected, purged };
};

module.exports = { resilientPurge, SANDBOX_SOFT_THRESHOLD, SANDBOX_HARD_CAP, countGuestSandboxes, purgeStaleSandboxes };
