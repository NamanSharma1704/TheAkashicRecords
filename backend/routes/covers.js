/* Backfilling missing covers (on demand and by the workflow). (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { getTenantDb } = require('../config/db');
const { secretMatches, sendError } = require('../lib/common');
const { backfillCovers } = require('../lib/covers');
const { authenticate } = require('../middleware/authenticate');
const { coverBackfillLimiter } = require('../middleware/limiters');

const router = express.Router();

// POST /api/quests/backfill-covers - "Find missing covers" in the profile.
router.post('/api/quests/backfill-covers', coverBackfillLimiter, authenticate, async (req, res) => {
    try {
        res.json(await backfillCovers(req.dbConn, 8));
    } catch (err) {
        return sendError(res, 500, 'Cover search failed.', err);
    }
});

// POST /api/admin/backfill-covers - The scheduled workflow's call, for the owner's archive.
router.post('/api/admin/backfill-covers', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);
        const conn = await getTenantDb(process.env.SYNC_TENANT || 'akashic_records');
        res.json({ message: 'Cover backfill complete.', ...(await backfillCovers(conn, limit)) });
    } catch (err) {
        return sendError(res, 500, 'Cover backfill failed.', err);
    }
});

module.exports = router;
