/* The reader's state: boot data, quests, quest order, stats, titles. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { initDatabase } = require('../config/init');
const { getModel } = require('../models/modelFactory');
const { ACHIEVEMENTS, ACHIEVEMENT_KEYS, measureArchive } = require('../utils/achievements');
const { LIVE, TRASH_RETENTION_MS, sendError } = require('../lib/common');
const { GOAL_MAX, ensureDailyQuest, ensureUserSettings, liveStreak, readGoals, shiftDay, todayFor, tzOf } = require('../lib/days');
const { debugLog } = require('../lib/log');
const { authenticate } = require('../middleware/authenticate');
const { writeLimiter } = require('../middleware/limiters');

const router = express.Router();

// GET /api/boot/initial-data - Batched fetch for instant loading
router.get('/api/boot/initial-data', authenticate, async (req, res) => {
    const start = Date.now();
    try {
        debugLog(`[PERF] Initial Data Batch Request Start: ${req.user.username}`);

        const Quest = getModel(req.dbConn, 'Quest');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = todayFor(req);

        // parallel fetch for absolute speed. The two singletons are fetched-or-created
        // atomically (see ensureUserSettings), so a first visit needs no follow-up writes.
        const [quests, settings, daily] = await Promise.all([
            // No synopses in the boot payload: they are the bulk of every record and only the
            // detail view and the editor show one, so each fetches its own (GET /api/quests/:id).
            Quest.find(LIVE).sort({ lastRead: -1 }).select('-synopsis'),
            ensureUserSettings(UserSettings, req.user._id),
            ensureDailyQuest(DailyQuest, today),
            // Trash retention, enforced here because every session boots through this route
            // (and a serverless deployment has no long-running process to schedule it on).
            // Indexed on deletedAt, so a library with nothing expired costs one index probe.
            Quest.deleteMany({ deletedAt: { $lt: new Date(Date.now() - TRASH_RETENTION_MS) } })
        ]);

        debugLog(`[PERF] Initial parallel fetch complete: ${Date.now() - start}ms`);

        // Quests seeding
        if (quests.length === 0 && req.user.role === 'GUEST') {
            await initDatabase(() => req.dbConn);
            debugLog(`[PERF] Followup completions in: ${Date.now() - start}ms`);
        }

        res.json({
            quests,
            userState: {
                streak: liveStreak(settings, today),
                lastReadDate: settings?.lastReadDate || null,
                dailyAbsorbed: daily?.absorbedIds.length || 0,
                absorbedIds: daily?.absorbedIds || [],
                goals: await readGoals(req, settings, daily, today),
                questOrder: settings?.questOrder || [],
            }
        });

        debugLog(`[PERF] Total Initial Data Duration: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[PERF] Initial Data Failure (${Date.now() - start}ms):`, err.message);
        return sendError(res, 500, 'Failed to load initial archive data.', err);
    }
});

// --- ROUTES ---

// GET /api/user/state - Fetch streak and daily absorb
router.get('/api/user/state', authenticate, async (req, res) => {
    const start = Date.now();
    try {
        debugLog(`[PERF] User State Request Start: ${req.user.username}`);
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = todayFor(req);

        // Parallel fetch-or-create; atomic, so concurrent first requests cannot collide.
        const [settings, daily] = await Promise.all([
            ensureUserSettings(UserSettings, req.user._id),
            ensureDailyQuest(DailyQuest, today)
        ]);

        debugLog(`[PERF] Initial fetch complete: ${Date.now() - start}ms`);

        res.json({
            streak: liveStreak(settings, today),
            lastReadDate: settings.lastReadDate,
            dailyAbsorbed: daily.absorbedIds.length,
            absorbedIds: daily.absorbedIds,
            goals: await readGoals(req, settings, daily, today),
        });
        debugLog(`[PERF] Total User State Duration: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[PERF] User State Failure (${Date.now() - start}ms):`, err.message);
        return sendError(res, 500, 'Failed to load hunter state.', err);
    }
});

// PUT /api/user/goals - Set the quests: { daily: { kind: 'SERIES'|'CHAPTERS', target },
// weekly: { target } }. Answers with the quests and their progress as they now stand.
router.put('/api/user/goals', authenticate, writeLimiter, async (req, res) => {
    try {
        const { daily, weekly } = req.body || {};
        const kind = daily?.kind;
        if (kind !== 'SERIES' && kind !== 'CHAPTERS') {
            return res.status(400).json({ message: 'The daily quest counts either series or chapters.' });
        }
        const inRange = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
        if (!inRange(daily?.target, GOAL_MAX[kind])) {
            return res.status(400).json({ message: `The daily target must be a whole number from 1 to ${GOAL_MAX[kind]}.` });
        }
        if (!inRange(weekly?.target, GOAL_MAX.WEEKLY)) {
            return res.status(400).json({ message: `The weekly target must be a whole number from 1 to ${GOAL_MAX.WEEKLY}.` });
        }
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const today = todayFor(req);
        await ensureUserSettings(UserSettings, req.user._id);
        const [settings, dailyDoc] = await Promise.all([
            UserSettings.findOneAndUpdate(
                { userId: req.user._id },
                { $set: { dailyGoalKind: kind, dailyGoalTarget: daily.target, weeklyGoalTarget: weekly.target } },
                { returnDocument: 'after' }
            ),
            ensureDailyQuest(getModel(req.dbConn, 'DailyQuest'), today),
        ]);
        res.json(await readGoals(req, settings, dailyDoc, today));
    } catch (err) {
        return sendError(res, 500, 'Failed to save the quests.', err);
    }
});

// PUT /api/user/quest-order - The ACTIVE QUESTS list order: { order: [questId, ...] }. Kept
// on the server so a phone and a desktop show the same list. Ids are not checked against the
// library: an unknown one sorts nowhere, and a deleted record's id is harmless.
const QUEST_ID_RE = /^[a-f0-9]{24}$/i;

router.put('/api/user/quest-order', authenticate, writeLimiter, async (req, res) => {
    try {
        const order = req.body?.order;
        if (!Array.isArray(order) || order.length > 2000 || !order.every((id) => typeof id === 'string' && QUEST_ID_RE.test(id))) {
            return res.status(400).json({ message: 'The order must be a list of record ids.' });
        }
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        await ensureUserSettings(UserSettings, req.user._id);
        await UserSettings.updateOne({ userId: req.user._id }, { $set: { questOrder: [...new Set(order)] } });
        res.status(204).end();
    } catch (err) {
        return sendError(res, 500, 'Failed to save the quest order.', err);
    }
});

// GET /api/stats - Reading activity from the reading log, in the reader's own days.
//
// Each log entry is a signed chapter change, so a day's sum is the net chapters read: an Undo
// or a correction cancels out rather than counting twice. Streaks here are runs of days with
// net reading > 0. (The live streak in UserSettings counts any day with a forward move, so a
// day you entirely undid still extends that one; this one is the stricter record.)
router.get('/api/stats', authenticate, async (req, res) => {
    try {
        const ReadingLog = getModel(req.dbConn, 'ReadingLog');
        const today = todayFor(req);
        const since = shiftDay(today, -370); // a year of weeks, with room to align to Sunday

        const rows = await ReadingLog.aggregate([
            { $match: { day: { $gte: since } } },
            { $group: { _id: '$day', chapters: { $sum: '$delta' } } },
            { $sort: { _id: 1 } }
        ]);
        const days = rows.filter(r => r.chapters > 0).map(r => ({ day: r._id, chapters: r.chapters }));
        const byDay = new Map(days.map(d => [d.day, d.chapters]));

        const sumDays = (from, to) => {
            let total = 0;
            for (let d = from; d <= to; d = shiftDay(d, 1)) total += byDay.get(d) || 0;
            return total;
        };

        let longestStreak = 0, run = 0, prev = null;
        for (const { day } of days) {
            run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
            longestStreak = Math.max(longestStreak, run);
            prev = day;
        }
        // A streak still counts today if you read yesterday and have not read yet today.
        let currentStreak = 0;
        for (let d = byDay.has(today) ? today : shiftDay(today, -1); byDay.get(d) > 0; d = shiftDay(d, -1)) currentStreak++;

        res.json({
            today,
            days,
            thisWeek: sumDays(shiftDay(today, -6), today),
            lastWeek: sumDays(shiftDay(today, -13), shiftDay(today, -7)),
            currentStreak,
            longestStreak,
            daysRead: days.length,
            chaptersThisYear: days.reduce((sum, d) => sum + d.chapters, 0)
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to read reading stats.', err);
    }
});

// POST /api/achievements/sync - Weigh the archive against the titles (utils/achievements.js),
// grant what is newly earned, and list the whole catalogue with progress.
//
// A POST because it writes: a title is granted the first time an evaluation finds it earned.
// Each grant is an upsert keyed on the title, so two evaluations racing grant it once, and
// only the one that inserted it reports it as fresh. The first evaluation of an archive
// grants what its records already earn as "recognised" and reports how many, rather than
// announcing a dozen titles at once.
router.post('/api/achievements/sync', authenticate, writeLimiter, async (req, res) => {
    try {
        const Achievement = getModel(req.dbConn, 'Achievement');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const readHeld = async () => new Map(
            (await Achievement.find({}).select('-_id key unlockedAt recognised').lean()).map((a) => [a.key, a])
        );
        const [settings, held] = await Promise.all([ensureUserSettings(UserSettings, req.user._id), readHeld()]);
        const values = await measureArchive(req.dbConn, tzOf(req), { skipNight: held.has('night') });
        const seeding = !settings.achievementsSeededAt;

        const due = ACHIEVEMENTS.filter((a) => !held.has(a.key) && values[a.measure] >= a.target);
        const fresh = [];
        if (due.length) {
            const now = new Date();
            const r = await Achievement.bulkWrite(due.map((a) => ({
                updateOne: {
                    filter: { key: a.key },
                    update: { $setOnInsert: { key: a.key, unlockedAt: now, recognised: seeding } },
                    upsert: true,
                },
            })), { ordered: false });
            for (const i of Object.keys(r.upsertedIds || {})) fresh.push(due[Number(i)].key);
        }
        if (seeding) {
            await UserSettings.updateOne(
                { userId: req.user._id, achievementsSeededAt: null },
                { $set: { achievementsSeededAt: new Date() } }
            );
        }
        // Read back after a grant: a racing evaluation may have granted some of these first.
        const earned = due.length ? await readHeld() : held;

        res.json({
            // Shown only while it is still a title the catalogue knows and the archive holds.
            equipped: settings.equippedTitle && earned.has(settings.equippedTitle) && ACHIEVEMENT_KEYS.has(settings.equippedTitle)
                ? settings.equippedTitle
                : null,
            achievements: ACHIEVEMENTS.map(({ key, name, kind, description, measure, target }) => ({
                key, name, kind, description, target,
                value: values[measure],
                unlockedAt: earned.get(key)?.unlockedAt || null,
                recognised: earned.get(key)?.recognised === true,
            })),
            fresh: seeding ? [] : fresh,
            recognised: seeding ? fresh.length : 0,
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to evaluate titles.', err);
    }
});

// PUT /api/achievements/equipped - Choose the title shown under the hunter's name: { key },
// a title the archive has earned, or { key: null } for none.
router.put('/api/achievements/equipped', authenticate, writeLimiter, async (req, res) => {
    try {
        const key = req.body?.key ?? null;
        if (key !== null) {
            if (typeof key !== 'string' || !ACHIEVEMENT_KEYS.has(key)) {
                return res.status(400).json({ message: 'That is not a title.' });
            }
            if (!(await getModel(req.dbConn, 'Achievement').exists({ key }))) {
                return res.status(403).json({ message: 'That title has not been earned yet.' });
            }
        }
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        await ensureUserSettings(UserSettings, req.user._id);
        await UserSettings.updateOne({ userId: req.user._id }, { $set: { equippedTitle: key } });
        res.json({ equipped: key });
    } catch (err) {
        return sendError(res, 500, 'Failed to equip the title.', err);
    }
});

// ─── THE DORMANT GATE SWEEP ───────────────────────────────────────────────────
// Active series with no chapter read forward in DORMANT_AFTER_MS, offered for filing (keep,
// STASIS, CONQUERED, SEVERED) at most once every SWEEP_EVERY_MS. "Last read" is the last
// forward step in the reading log; a series the log has never seen read (read before the log
// began, or never) falls back to the record's lastRead (last touched), then the day it was
// added. A series kept active in a sweep is left alone for another DORMANT_AFTER_MS.
const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_AFTER_MS = 30 * DAY_MS;
const SWEEP_EVERY_MS = 7 * DAY_MS;

// GET /api/user/dormant - { due, sweptAt, gates: [{ _id, title, cover, currentChapter,
// totalChapters, newChapters, lastReadAt }] }, the longest quiet first.
router.get('/api/user/dormant', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const ReadingLog = getModel(req.dbConn, 'ReadingLog');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const [settings, active] = await Promise.all([
            ensureUserSettings(UserSettings, req.user._id),
            Quest.find({ ...LIVE, status: 'ACTIVE' })
                .select('title cover currentChapter totalChapters newChapters lastRead createdAt')
                .lean(),
        ]);
        const now = Date.now();
        const lastForward = new Map((await ReadingLog.aggregate([
            { $match: { questId: { $in: active.map((q) => q._id) }, delta: { $gt: 0 } } },
            { $group: { _id: '$questId', at: { $max: '$at' } } },
        ])).map((r) => [String(r._id), new Date(r.at).getTime()]));
        const kept = new Map((settings.dormantKept || []).map((k) => [k.questId, new Date(k.at).getTime()]));

        const gates = active
            .map((q) => {
                const id = String(q._id);
                const lastReadAt = lastForward.get(id)
                    ?? (typeof q.lastRead === 'number' && q.lastRead > 0 ? q.lastRead : null)
                    ?? (q.createdAt ? new Date(q.createdAt).getTime() : now);
                return { q, id, lastReadAt, quietSince: Math.max(lastReadAt, kept.get(id) || 0) };
            })
            .filter((g) => now - g.quietSince >= DORMANT_AFTER_MS)
            .sort((a, b) => a.lastReadAt - b.lastReadAt)
            .map(({ q, id, lastReadAt }) => ({
                _id: id,
                title: q.title,
                cover: q.cover || '',
                currentChapter: q.currentChapter || 0,
                totalChapters: q.totalChapters || 0,
                newChapters: q.newChapters || 0,
                lastReadAt,
            }));
        const sweptAt = settings.dormantSweptAt ? new Date(settings.dormantSweptAt).getTime() : null;
        res.json({ due: sweptAt === null || now - sweptAt >= SWEEP_EVERY_MS, sweptAt, gates });
    } catch (err) {
        return sendError(res, 500, 'Failed to look for dormant gates.', err);
    }
});

// POST /api/user/dormant - { kept: [questId] }: the sweep is done (or put off a week, with
// none kept). The statuses themselves go through POST /api/quests/bulk.
router.post('/api/user/dormant', authenticate, writeLimiter, async (req, res) => {
    try {
        const kept = req.body?.kept ?? [];
        if (!Array.isArray(kept) || kept.length > 1000 || !kept.every((id) => typeof id === 'string' && QUEST_ID_RE.test(id))) {
            return res.status(400).json({ message: 'Kept gates must be a list of record ids.' });
        }
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const settings = await ensureUserSettings(UserSettings, req.user._id);
        const now = new Date();
        const fresh = new Set(kept);
        // Earlier keeps stay until their 30 days are up; a gate kept again starts over.
        const carried = (settings.dormantKept || [])
            .filter((k) => !fresh.has(k.questId) && now - new Date(k.at) < DORMANT_AFTER_MS)
            .map((k) => ({ questId: k.questId, at: k.at }));
        const dormantKept = [...carried, ...[...fresh].map((questId) => ({ questId, at: now }))];
        await UserSettings.updateOne({ userId: req.user._id }, { $set: { dormantSweptAt: now, dormantKept } });
        res.json({ sweptAt: now.getTime(), kept: fresh.size });
    } catch (err) {
        return sendError(res, 500, 'Failed to save the sweep.', err);
    }
});

module.exports = router;
