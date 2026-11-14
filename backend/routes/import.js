/* Reading-list import from AniList and MyAnimeList. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { ImportError, fetchAniListList, lookupMalIds } = require('../utils/listImport');
const { classifyBest } = require('../lib/classify');
const { sendError } = require('../lib/common');
const { authenticate } = require('../middleware/authenticate');
const { importLimiter } = require('../middleware/limiters');

const router = express.Router();

/** A row for the import pipeline from AniList's view of a series. */
const importRow = (m, extra = {}) => ({
    title: m.title,
    aliases: m.aliases,
    totalChapters: Math.max(m.chapters || 0, extra.currentChapter || 0),
    coverUrl: m.cover || '',
    classType: classifyBest(m.title, m.genres, null),
    ...extra,
});

// GET /api/import/anilist?user=NAME - a public AniList manga list.
router.get('/api/import/anilist', authenticate, importLimiter, async (req, res) => {
    const user = String(req.query.user || '').trim();
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(user)) {
        return res.status(400).json({ message: 'An AniList username is 2 to 20 letters, digits, dashes or underscores.' });
    }
    try {
        const entries = await fetchAniListList(user);
        const rows = entries
            .filter((e) => e.title)
            .map((e) => importRow(e, { currentChapter: e.progress, status: e.status, rating: e.rating }));
        res.json({ user, rows });
    } catch (err) {
        if (err instanceof ImportError) return res.status(err.status).json({ message: err.message });
        return sendError(res, 502, 'Could not read that AniList list.', err);
    }
});

// POST /api/import/mal-lookup - { ids: [malId, ...] } (at most 500): AniList's record for each
// MyAnimeList id it knows, so a MAL export gains English titles, covers and classes.
router.post('/api/import/mal-lookup', authenticate, importLimiter, async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
        return res.status(400).json({ message: 'Send between 1 and 500 MyAnimeList ids.' });
    }
    try {
        const found = await lookupMalIds([...new Set(ids)]);
        const rows = {};
        for (const [malId, m] of Object.entries(found)) rows[malId] = importRow(m);
        res.json({ found: rows });
    } catch (err) {
        if (err instanceof ImportError) return res.status(err.status).json({ message: err.message });
        return sendError(res, 502, 'Could not look those series up.', err);
    }
});

module.exports = router;
