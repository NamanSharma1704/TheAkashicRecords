/* The System's event log: what actually happened, newest first. (THE LIVING SYSTEM LOG, 2026-11-14.) */

const express = require('express');
const { getModel } = require('../models/modelFactory');
const { ACHIEVEMENTS } = require('../utils/achievements');
const { LIVE, sendError } = require('../lib/common');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

const TITLE_NAME = new Map(ACHIEVEMENTS.map((a) => [a.key, a.name]));

// GET /api/events?limit=12 - [{ id, kind, at, text, questId? }], newest first, merged from:
//   READ      the reading log: chapters read forward, each save one event. An Undo or a
//             correction writes a negative entry; it is netted against the reads it took back
//             (newest first, per series), so an undone chapter is never shown as absorbed.
//   FOUND     the tracker's latest find on a series, while its new chapters are still unread
//             (the record keeps only the latest count, so only that one is told).
//   CONQUEST  a series conquered, at the moment it was.
//   TITLE     a title granted ("earned"), or found in older records ("recognised").
// Nothing is invented: every line is a stored fact with its stored time.
router.get('/api/events', authenticate, async (req, res) => {
    try {
        const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
        const Quest = getModel(req.dbConn, 'Quest');
        const [log, found, conquered, titles] = await Promise.all([
            // More than `limit`, so an Undo near the top can be netted against what it undid.
            getModel(req.dbConn, 'ReadingLog').find({}).sort({ at: -1 }).limit(limit * 4).lean(),
            Quest.find({ ...LIVE, newChapters: { $gt: 0 }, chaptersUpdatedAt: { $ne: null } })
                .sort({ chaptersUpdatedAt: -1 }).limit(limit).select('title newChapters chaptersUpdatedAt').lean(),
            Quest.find({ ...LIVE, conqueredAt: { $ne: null } })
                .sort({ conqueredAt: -1 }).limit(limit).select('title conqueredAt').lean(),
            getModel(req.dbConn, 'Achievement').find({}).sort({ unlockedAt: -1 }).limit(limit).lean(),
        ]);

        const events = [];
        const taken = new Map(); // questId -> chapters an Undo has taken back, not yet netted
        for (const e of log) {
            const id = String(e.questId);
            if (e.delta < 0) { taken.set(id, (taken.get(id) || 0) - e.delta); continue; }
            if (e.delta === 0) continue;
            const back = Math.min(taken.get(id) || 0, e.delta);
            if (back) taken.set(id, taken.get(id) - back);
            const read = e.delta - back;
            if (read <= 0) continue;
            const to = e.from + read;
            events.push({
                id: `read-${e._id}`,
                kind: 'READ',
                at: new Date(e.at).getTime(),
                questId: id,
                text: `${read === 1 ? `CH ${to}` : `CH ${e.from + 1}–${to}`} absorbed · ${e.title || 'a gate'}`,
            });
        }
        for (const q of found) {
            events.push({
                id: `found-${q._id}-${new Date(q.chaptersUpdatedAt).getTime()}`,
                kind: 'FOUND',
                at: new Date(q.chaptersUpdatedAt).getTime(),
                questId: String(q._id),
                text: `+${q.newChapters} chapter${q.newChapters === 1 ? '' : 's'} detected · ${q.title}`,
            });
        }
        for (const q of conquered) {
            events.push({
                id: `conquest-${q._id}`,
                kind: 'CONQUEST',
                at: new Date(q.conqueredAt).getTime(),
                questId: String(q._id),
                text: `Gate conquered · ${q.title}`,
            });
        }
        for (const t of titles) {
            const name = TITLE_NAME.get(t.key);
            if (!name) continue;
            events.push({
                id: `title-${t.key}`,
                kind: 'TITLE',
                at: new Date(t.unlockedAt).getTime(),
                text: `Title ${t.recognised ? 'recognised' : 'earned'} · ${name}`,
            });
        }

        events.sort((a, b) => b.at - a.at);
        res.json(events.slice(0, limit));
    } catch (err) {
        return sendError(res, 500, 'Failed to read the event log.', err);
    }
});

module.exports = router;
