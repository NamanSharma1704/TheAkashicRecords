/* Quest records: list, create, update, Trash, history, restore, bulk. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { initDatabase } = require('../config/init');
const { getModel } = require('../models/modelFactory');
const { normalizeTitle } = require('../utils/normalizeTitle');
const { GUEST_RECORD_CAP, LIVE, TRASH_RETENTION_MS, isQuestId, sendError } = require('../lib/common');
const { shiftDay, todayFor } = require('../lib/days');
const { debugLog } = require('../lib/log');
const { QUEST_STATUSES, recordReading, validateQuest } = require('../lib/questRules');
const { authenticate } = require('../middleware/authenticate');
const { RADAR_REFRESH_MS, cadenceOf, mergeDays } = require('../lib/radar');
const { releaseDaysFor } = require('../utils/metadataProxy');
const { writeLimiter } = require('../middleware/limiters');

const router = express.Router();

// GET /api/quests - Fetch all quests
router.get('/api/quests', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        // Synopses only on request (?full=1); see /api/boot/initial-data.
        const fields = req.query.full === '1' ? '' : '-synopsis';
        let quests = await Quest.find(LIVE).sort({ lastRead: -1 }).select(fields);

        debugLog(`[API] Quests requested by ${req.user.username}. Found: ${quests.length} documents.`);

        // Lazy-seed if DB is completely empty (common for Guest or new Sovereign)
        if (quests.length === 0) {
            debugLog('[API] Database empty. Checking lazy seeding condition...');
            // Only seed Guests, let Sovereigns migrate or add their own
            if (req.user.role === 'GUEST') {
                await initDatabase(() => req.dbConn);
                quests = await Quest.find(LIVE).sort({ lastRead: -1 }).select(fields);
            }
        }

        res.json(quests);
    } catch (err) {
        console.error('[API] Error fetching quests:', err.message);
        return sendError(res, 500, 'Failed to retrieve quest records.', err);
    }
});

router.post('/api/quests', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const { value: safeBody, error } = validateQuest(req.body, null);
        if (error) return res.status(400).json({ message: error });

        if (req.user.role === 'GUEST' && await Quest.estimatedDocumentCount() >= GUEST_RECORD_CAP) {
            return res.status(403).json({ message: `Guest archives hold up to ${GUEST_RECORD_CAP} records.` });
        }

        // 1. DUPLICATE CHECK (ignores punctuation, apostrophes and casing)
        const normalizedTitle = normalizeTitle(safeBody.title);

        // A single indexed lookup. This replaced a Quest.find({}) that pulled every document,
        // synopses included, into Node on each create, once per row during a CSV import.
        //
        // It relies on every record carrying normalizedTitle. Every write path sets it (create,
        // rename, restore, the guest-sandbox copy in config/init.js), and the owner's archive
        // was backfilled on 2026-11-06 (backend/scripts/backfill_normalized_titles.js), so the
        // old second pass over records without the field is gone. A database written before
        // the field existed needs that script run once.
        const collision = await Quest.findOne({ normalizedTitle, ...LIVE }).select('title');

        if (collision) {
            return res.status(409).json({
                message: `Artifact strictly classified as Duplicate. Existing entry detected: "${collision.title}"`
            });
        }

        // 2. Adding a title that sits in the Trash replaces the trashed copy. `title` carries a
        // unique index, so the trashed document would otherwise refuse the insert outright.
        await Quest.deleteMany({
            deletedAt: { $ne: null },
            $or: [{ normalizedTitle }, { title: safeBody.title }]
        });
        const newQuest = new Quest({ ...safeBody, normalizedTitle });
        const savedQuest = await newQuest.save();
        res.status(201).json(savedQuest);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Database Archive Collision: Title already exists in the records." });
        }
        return sendError(res, 400, 'Failed to create quest record.', err);
    }
});

// PUT /api/quests/:id - Update a quest
router.put('/api/quests/:id', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const questId = req.params.id;

        // A missing (or trashed) quest is a 404, settled before anything is counted: this used
        // to bump the streak and absorb the id, then update nothing and answer 200 with null.
        if (!isQuestId(questId)) return res.status(404).json({ message: 'Quest record not found.' });
        const existing = await Quest.findOne({ _id: questId, ...LIVE })
            .select('title currentChapter totalChapters status classType')
            .lean();
        if (!existing) return res.status(404).json({ message: 'Quest record not found.' });

        const { value: body, error } = validateQuest(req.body, existing);
        if (error) return res.status(400).json({ message: error });

        // Keep the duplicate-detection key in step with the title, and refuse a rename onto
        // another record's title (only an exact match used to be caught, by the unique index).
        if (body.title !== undefined) {
            body.normalizedTitle = normalizeTitle(body.title);
            if (body.normalizedTitle !== normalizeTitle(existing.title)) {
                const clash = await Quest
                    .findOne({ _id: { $ne: existing._id }, normalizedTitle: body.normalizedTitle, ...LIVE })
                    .select('title');
                if (clash) return res.status(409).json({ message: `Archive Collision: "${clash.title}" is already in the archive.` });
                // Another title is another series as far as the sources go: forget where the
                // old one was found (and found missing), and check the new one soon.
                body.chaptersCheckedAt = null;
                body.$unset = { sourceIds: 1, sourceMissedAt: 1 };
            }
        }

        const from = existing.currentChapter || 0;
        const to = body.currentChapter;
        const moved = to !== undefined && to !== from;
        // A CSV import (?import=1) replays history; it is not reading done today.
        const imported = req.query.import === '1';
        // Moving past chapters the tracker flagged as new means they are no longer new.
        if (moved && to > from) body.newChapters = 0;
        if (body.status !== undefined && body.status !== existing.status) {
            if (body.status === 'CONQUERED') body.conqueredAt = new Date();
            else if (existing.status === 'CONQUERED') body.conqueredAt = null;
        }
        // Reading on in a sealed (PLANNED) or STASIS series opens it again, unless the same
        // save sets a status itself (the editor does). An import replays history, not reading.
        if (moved && to > from && !imported && body.status === undefined && ['PLANNED', 'STASIS'].includes(existing.status)) {
            body.status = 'ACTIVE';
        }

        const updatedQuest = await Quest.findOneAndUpdate(
            { _id: questId, ...LIVE },
            { ...body, lastRead: Date.now() },
            { returnDocument: 'after' }
        );
        if (!updatedQuest) return res.status(404).json({ message: 'Quest record not found.' });

        // Counted only once the write has landed. Reading moves a chapter FORWARD, and only
        // that extends the streak and the day's absorbed titles: this used to fire whenever
        // the body merely contained currentChapter, which the edit form sends on every save
        // (as do the −1 button and the CSV import), so fixing a typo counted as reading today.
        if (moved && !imported) {
            try {
                if (to > from) await recordReading(req, questId);
                // Signed, so a correction nets out of the day's total in the stats.
                await getModel(req.dbConn, 'ReadingLog').create({
                    questId, title: updatedQuest.title, from, to, delta: to - from, day: todayFor(req)
                });
            } catch (statErr) {
                // The chapter is saved; losing a stat must not turn that into an error.
                console.error('[STATS] Reading not recorded:', statErr.message);
            }
        }
        res.json(updatedQuest);
    } catch (err) {
        return sendError(res, 400, 'Failed to update quest record.', err);
    }
});

// DELETE /api/quests/:id - Move a quest to the Trash (soft delete; see LIVE)
router.delete('/api/quests/:id', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const trashed = await Quest.findOneAndUpdate(
            { _id: req.params.id, ...LIVE },
            { deletedAt: new Date() },
            { returnDocument: 'after' }
        ).select('_id deletedAt');
        if (!trashed) return res.status(404).json({ message: 'Quest record not found.' });
        res.json({ message: 'Quest Purged.', id: trashed._id, deletedAt: trashed.deletedAt });
    } catch (err) {
        return sendError(res, 500, 'Failed to purge quest record.', err);
    }
});

// GET /api/quests/trash - What is in the Trash, newest first, with its purge date.
router.get('/api/quests/trash', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const trashed = await Quest.find({ deletedAt: { $ne: null } })
            .sort({ deletedAt: -1 })
            .select('title cover currentChapter totalChapters status classType deletedAt')
            .lean();
        res.json(trashed.map(q => ({ ...q, purgeAt: new Date(new Date(q.deletedAt).getTime() + TRASH_RETENTION_MS) })));
    } catch (err) {
        return sendError(res, 500, 'Failed to read the Trash.', err);
    }
});

// GET /api/quests/:id - One full record, synopsis included (the list omits synopses).
// Declared after /api/quests/trash so "trash" is never taken for an id.
router.get('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const quest = await Quest.findOne({ _id: req.params.id, ...LIVE });
        if (!quest) return res.status(404).json({ message: 'Quest record not found.' });
        res.json(quest);
    } catch (err) {
        return sendError(res, 500, 'Failed to retrieve the quest record.', err);
    }
});

// GET /api/quests/:id/history - One series' Chronicle, from the reading log: when it was
// added, first and last read, conquered; the days it was read; the last 30 days; and the
// most recent moves. Days are the reader's own (X-Timezone), as the stats use.
/** The star-path's milestone chapters: the first chapter, a quarter, half, three quarters and
 *  the latest; duplicates dropped, so a short series has fewer. src/utils/starMarks.ts mirrors
 *  this, so the page can draw the stars before the history lands. */
const starMarks = (total) => {
    if (!(total > 0)) return [];
    if (total < 4) return [...new Set([1, total])];
    return [...new Set([1, Math.ceil(total * 0.25), Math.ceil(total * 0.5), Math.ceil(total * 0.75), total])];
};

router.get('/api/quests/:id/history', authenticate, async (req, res) => {
    try {
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const quest = await getModel(req.dbConn, 'Quest').findOne({ _id: req.params.id, ...LIVE })
            .select('createdAt conqueredAt totalChapters')
            .lean();
        if (!quest) return res.status(404).json({ message: 'Quest record not found.' });

        const log = await getModel(req.dbConn, 'ReadingLog').find({ questId: req.params.id })
            .sort({ at: 1 })
            .select('-_id from to delta day at')
            .lean();
        const byDay = new Map();
        for (const e of log) byDay.set(e.day, (byDay.get(e.day) || 0) + e.delta);
        const since = shiftDay(todayFor(req), -29);
        const forward = log.filter((e) => e.delta > 0);

        res.json({
            addedAt: quest.createdAt || null,
            firstReadDay: forward.length ? forward[0].day : null,
            // The last chapter actually read forward. The record's lastRead is touched by any
            // save (an appraisal, MARK_TARGET), so it means "last touched", not "last read".
            lastReadAt: forward.length ? forward[forward.length - 1].at : null,
            conqueredAt: quest.conqueredAt || null,
            // A day counts when its moves net forward, as in the reading stats.
            daysRead: [...byDay.values()].filter((n) => n > 0).length,
            chapters30: [...byDay].filter(([day]) => day >= since).reduce((sum, [, n]) => sum + n, 0),
            recent: log.slice(-6).reverse(),
            // The star-path on the series page: for each milestone chapter (starMarks), the
            // day the log first crossed it reading forward. Null when no move in the log
            // crosses it: reached before the record began, or not reached yet.
            milestones: starMarks(quest.totalChapters || 0).map((chapter) => {
                const crossing = forward.find((e) => e.from < chapter && e.to >= chapter);
                return { chapter, day: crossing ? crossing.day : null };
            }),
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to read the series history.', err);
    }
});

// DELETE /api/quests/:id/permanent - Erase a quest from the Trash now. Only trashed quests:
// a live one has to be deleted (and so be undoable) first.
router.delete('/api/quests/:id/permanent', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const gone = await Quest.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } }).select('_id');
        if (!gone) return res.status(404).json({ message: 'That record is not in the Trash.' });
        res.json({ message: 'Erased.', id: gone._id });
    } catch (err) {
        return sendError(res, 500, 'Failed to erase the record.', err);
    }
});

// POST /api/quests/:id/restore - Bring a quest back out of the Trash (Undo)
router.post('/api/quests/:id/restore', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const trashed = await Quest.findOne({ _id: req.params.id, deletedAt: { $ne: null } }).select('title normalizedTitle');
        if (!trashed) return res.status(404).json({ message: 'Nothing to restore: the record is not in the Trash.' });

        // Restoring must not create a duplicate if the title was added again meanwhile.
        const key = trashed.normalizedTitle || normalizeTitle(trashed.title);
        const clash = await Quest.findOne({ _id: { $ne: trashed._id }, normalizedTitle: key, ...LIVE }).select('title');
        if (clash) {
            return res.status(409).json({ message: `Cannot restore: "${clash.title}" is already in the archive.` });
        }

        const restored = await Quest.findByIdAndUpdate(trashed._id, { deletedAt: null }, { returnDocument: 'after' });
        res.json(restored);
    } catch (err) {
        return sendError(res, 500, 'Failed to restore quest record.', err);
    }
});

// POST /api/quests/bulk - One change to many records: { ids, action, status? }.
//   action 'status'  : set `status` on every live record listed (conqueredAt follows, as in PUT)
//   action 'trash'   : move every live record listed to the Trash
//   action 'restore' : bring trashed records back, except any whose title is live again
// Ids that match nothing (already gone, already in that state) are simply not counted. The
// records' lastRead is left alone: a bulk re-file is not reading, and stamping fifty records
// at once would flood "Recent".
const BULK_ID_RE = /^[a-f0-9]{24}$/i;

router.post('/api/quests/bulk', authenticate, writeLimiter, async (req, res) => {
    try {
        const { ids, action, status } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 || !ids.every((id) => typeof id === 'string' && BULK_ID_RE.test(id))) {
            return res.status(400).json({ message: 'Choose between 1 and 1000 records.' });
        }
        const Quest = getModel(req.dbConn, 'Quest');
        const list = [...new Set(ids)];

        if (action === 'status') {
            if (!QUEST_STATUSES.includes(status)) return res.status(400).json({ message: 'That is not a status.' });
            const live = { _id: { $in: list }, ...LIVE };
            let modified = 0;
            if (status === 'CONQUERED') {
                const r = await Quest.updateMany({ ...live, status: { $ne: 'CONQUERED' } }, { $set: { status, conqueredAt: new Date() } });
                modified = r.modifiedCount;
            } else {
                const [reopened, moved] = await Promise.all([
                    Quest.updateMany({ ...live, status: 'CONQUERED' }, { $set: { status, conqueredAt: null } }),
                    Quest.updateMany({ ...live, status: { $nin: ['CONQUERED', status] } }, { $set: { status } }),
                ]);
                modified = reopened.modifiedCount + moved.modifiedCount;
            }
            return res.json({ modified });
        }

        if (action === 'trash') {
            const deletedAt = new Date();
            const r = await Quest.updateMany({ _id: { $in: list }, ...LIVE }, { $set: { deletedAt } });
            return res.json({ modified: r.modifiedCount, deletedAt });
        }

        if (action === 'restore') {
            const trashed = await Quest.find({ _id: { $in: list }, deletedAt: { $ne: null } }).select('title normalizedTitle').lean();
            const keyOf = (q) => q.normalizedTitle || normalizeTitle(q.title);
            const liveClashes = await Quest.find({ normalizedTitle: { $in: trashed.map(keyOf) }, ...LIVE }).select('normalizedTitle').lean();
            const taken = new Set(liveClashes.map((q) => q.normalizedTitle));
            const clear = trashed.filter((q) => !taken.has(keyOf(q)));
            if (clear.length) await Quest.updateMany({ _id: { $in: clear.map((q) => q._id) } }, { $set: { deletedAt: null } });
            const restored = clear.length ? await Quest.find({ _id: { $in: clear.map((q) => q._id) } }).select('-synopsis') : [];
            return res.json({ restored, clashed: trashed.filter((q) => taken.has(keyOf(q))).map((q) => q.title) });
        }

        return res.status(400).json({ message: 'Unknown bulk action.' });
    } catch (err) {
        return sendError(res, 500, 'Failed to apply the change to those records.', err);
    }
});

// GET /api/quests/:id/radar - RELEASE RADAR: when this series usually releases (lib/radar.js),
// from its source's release history by the tracker's stored ids (asked at most daily) and the
// tracker's own finds. { status, seen, lastDay, weekday?, everyDays?, nextDay?, sinceLast?,
// source, tracked }; `tracked` is false when no source knows the series by id yet.
router.get('/api/quests/:id/radar', authenticate, async (req, res) => {
    try {
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const Quest = getModel(req.dbConn, 'Quest');
        const quest = await Quest.findOne({ _id: req.params.id, ...LIVE })
            .select('title +sourceIds +releaseDays +foundDays +releaseSource +releasesFetchedAt').lean();
        if (!quest) return res.status(404).json({ message: 'Quest record not found.' });

        const ids = quest.sourceIds || {};
        const tracked = !!(ids.mangaupdates || ids.mangadex);
        let days = quest.releaseDays || [];
        let source = quest.releaseSource || null;
        const stale = !quest.releasesFetchedAt || Date.now() - new Date(quest.releasesFetchedAt).getTime() > RADAR_REFRESH_MS;
        if (tracked && stale) {
            try {
                const fetched = await releaseDaysFor(ids);
                if (fetched.days.length) { days = mergeDays(fetched.days); source = fetched.source; }
                await Quest.updateOne({ _id: quest._id }, { $set: { releaseDays: days, releaseSource: source, releasesFetchedAt: new Date() } });
            } catch (e) {
                // The source is down or rate-limiting: what was known stands, and it is asked next time.
                console.warn(`[Radar] ${quest.title}: ${e.message}`);
            }
        }
        // The source's history, plus any release the tracker saw that the source has not
        // recorded yet; with no source history, the tracker's own finds alone.
        const found = quest.foundDays || [];
        const usable = days.length ? mergeDays(days, found.filter((d) => d > days[0])) : mergeDays(found);
        res.json({ ...cadenceOf(usable, todayFor(req)), source: source || (usable.length ? 'TRACKER' : null), tracked });
    } catch (err) {
        return sendError(res, 500, 'Failed to read the release radar.', err);
    }
});

module.exports = router;
