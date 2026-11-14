/* Checking for new chapters (on demand and by the hourly workflow). (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { getTenantDb } = require('../config/db');
const { syncChapters } = require('../lib/chapterSync');
const { secretMatches, sendError } = require('../lib/common');
const { authenticate } = require('../middleware/authenticate');
const { chapterSyncLimiter } = require('../middleware/limiters');

const router = express.Router();

// POST /api/quests/sync-chapters - Check your own library now (the app's "check" button).
// Each call fans out to public APIs, hence its own limiter.
router.post('/api/quests/sync-chapters', chapterSyncLimiter, authenticate, async (req, res) => {
    try {
        // The reader is waiting on this one: fewer series, and a shorter budget.
        res.json(await syncChapters(req.dbConn, { limit: 20, budgetMs: 20000, dueOnly: false }));
    } catch (err) {
        return sendError(res, 500, 'Chapter check failed.', err);
    }
});

// POST /api/admin/sync-chapters - The scheduled workflow's call, for the owner's archive.
router.post('/api/admin/sync-chapters', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 80);
        const conn = await getTenantDb(process.env.SYNC_TENANT || 'akashic_records');
        // No series is started after 38 s: the last ones can still take 16 s (a title search,
        // then the chapters, each with an 8 s timeout), inside the 60 s function limit.
        res.json({ message: 'Chapter sync complete.', ...(await syncChapters(conn, { limit, budgetMs: 38000, dueOnly: true })) });
    } catch (err) {
        return sendError(res, 500, 'Chapter sync failed.', err);
    }
});

module.exports = router;
