/* Downloading and restoring the full backup. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const mongoose = require('mongoose');
const { getModel } = require('../models/modelFactory');
const { normalizeTitle } = require('../utils/normalizeTitle');
const { ACHIEVEMENT_KEYS } = require('../utils/achievements');
const { BACKUP_FORMAT, BACKUP_PATH, BACKUP_SETTINGS_FIELDS, BACKUP_VERSION, DAY_RE, MAX_BACKUP_LOG, MAX_BACKUP_QUESTS, backupQuest, backupRecordIn, upperOf } = require('../lib/backup');
const { GUEST_RECORD_CAP, sendError } = require('../lib/common');
const { GOAL_MAX, ensureUserSettings, shiftDay, todayFor } = require('../lib/days');
const { validateQuest } = require('../lib/questRules');
const { authenticate } = require('../middleware/authenticate');
const { writeLimiter } = require('../middleware/limiters');

const router = express.Router();

// GET /api/backup - Everything a library holds, as one JSON document:
//   - every record with its synopsis, the Trash included, A-Z by title;
//   - the reading log behind the stats and the Chronicle;
//   - the settings: streak, the daily and weekly quests, the equipped title and the ACTIVE
//     QUESTS order;
//   - the titles earned, and the past week's daily-quest progress (the rest expires anyway).
// It opens with a summary of what it holds. The CSV export stays the spreadsheet view; this is
// the one that restores completely. No password or session ever goes into it.
router.get(BACKUP_PATH, authenticate, async (req, res) => {
    try {
        const [quests, readingLog, settings, achievements, dailyQuests] = await Promise.all([
            getModel(req.dbConn, 'Quest').find({})
                .select('-__v -normalizedTitle -chaptersCheckedAt -coverCheckedAt')
                .collation({ locale: 'en', strength: 2 })
                .sort({ title: 1 })
                .lean(),
            getModel(req.dbConn, 'ReadingLog').find({}).select('-__v -_id').sort({ at: 1 }).lean(),
            getModel(req.dbConn, 'UserSettings').findOne({ userId: req.user._id })
                .select(`-_id ${BACKUP_SETTINGS_FIELDS.join(' ')}`)
                .lean(),
            getModel(req.dbConn, 'Achievement').find({}).select('-_id key unlockedAt recognised').sort({ unlockedAt: 1 }).lean(),
            getModel(req.dbConn, 'DailyQuest').find({}).select('-_id date absorbedIds').sort({ date: 1 }).lean(),
        ]);
        const trashed = quests.filter((q) => q.deletedAt).length;
        res.json({
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            hunter: req.user.username || null,
            // What the file holds, so it can be checked at a glance.
            summary: {
                records: quests.length - trashed,
                recordsInTrash: trashed,
                readingLogEntries: readingLog.length,
                titles: achievements.length,
                dailyQuestDays: dailyQuests.length,
            },
            settings: settings
                ? Object.fromEntries(BACKUP_SETTINGS_FIELDS.filter((k) => k in settings).map((k) => [k, settings[k]]))
                : null,
            quests: quests.map(backupQuest),
            readingLog,
            // Optional in version 1: older files have none, and a restore treats that as none.
            achievements,
            dailyQuests,
        });
    } catch (err) {
        return sendError(res, 500, 'Backup failed.', err);
    }
});

/**
 * POST /api/backup - Restore a backup by MERGING it into the library, never by replacing it,
 * so restoring an old file cannot cost anything read since:
 *   - a title the library lacks is added (a record trashed in the backup lands in the Trash);
 *   - a title it has moves forward only (chapter, total) and gains a cover, synopsis or
 *     link only where its own is empty; a trashed copy the backup has live comes back out;
 *   - reading-log entries are added unless the same move is already recorded;
 *   - the streak is taken only when the backup's last reading day is the later one;
 *   - titles are granted (keeping the earlier date); the equipped title, the quests' targets
 *     and the ACTIVE QUESTS order only where none is set here;
 *   - the past week's daily-quest progress is merged in.
 * Every record goes through validateQuest, as any write does; a new one keeps the date it was
 * first added.
 */
router.post(BACKUP_PATH, authenticate, writeLimiter, express.json({ limit: '4mb' }), async (req, res) => {
    const b = req.body || {};
    if (b.format !== BACKUP_FORMAT || b.version !== BACKUP_VERSION || !Array.isArray(b.quests)) {
        return res.status(400).json({ message: 'That file is not an Akashic Records backup.' });
    }
    const log = Array.isArray(b.readingLog) ? b.readingLog : [];
    if (b.quests.length > MAX_BACKUP_QUESTS || log.length > MAX_BACKUP_LOG) {
        return res.status(400).json({ message: 'That backup is larger than this archive accepts.' });
    }

    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const ReadingLog = getModel(req.dbConn, 'ReadingLog');
        const UserSettings = getModel(req.dbConn, 'UserSettings');

        const existing = await Quest.find({})
            .select('title normalizedTitle currentChapter totalChapters cover synopsis readLink rating deletedAt')
            .lean();
        const byNorm = new Map(existing.map((q) => [q.normalizedTitle || normalizeTitle(q.title), q]));
        const idMap = new Map(); // the backup's record id -> the id it has here
        let room = req.user.role === 'GUEST' ? Math.max(0, GUEST_RECORD_CAP - existing.length) : Infinity;

        const inserts = [];
        const updates = [];
        let skipped = 0;
        for (const fromFile of b.quests) {
            const raw = backupRecordIn(fromFile);
            // The record's own status and class stand in for "what it already was": a value
            // an older build wrote is this archive's own data, so it restores as it is, the
            // same allowance an untouched re-save gets.
            const own = { status: upperOf(raw.status), classType: upperOf(raw.classType) };
            const { value: v, error } = validateQuest(raw, own);
            if (error) { skipped++; continue; }
            const norm = normalizeTitle(v.title);
            const trashedInBackup = !!raw.deletedAt && !Number.isNaN(Date.parse(raw.deletedAt));
            const have = byNorm.get(norm);
            if (have) {
                if (raw._id) idMap.set(String(raw._id), have._id);
                const set = {};
                if ((v.currentChapter ?? 0) > (have.currentChapter ?? 0)) set.currentChapter = v.currentChapter;
                if ((v.totalChapters ?? 0) > (have.totalChapters ?? 0)) set.totalChapters = v.totalChapters;
                for (const f of ['cover', 'synopsis', 'readLink', 'rating']) if (v[f] && !have[f]) set[f] = v[f];
                if (have.deletedAt && !trashedInBackup) set.deletedAt = null;
                if (Object.keys(set).length) {
                    updates.push({ updateOne: { filter: { _id: have._id }, update: { $set: set } } });
                    Object.assign(have, set);
                }
                continue;
            }
            if (room <= 0) { skipped++; continue; }
            const _id = new mongoose.Types.ObjectId();
            // The conquest date is server-owned, so validateQuest drops it; a restore carries it.
            const conqueredAt = v.status === 'CONQUERED' && raw.conqueredAt && !Number.isNaN(Date.parse(raw.conqueredAt)) ? new Date(raw.conqueredAt) : null;
            // When it was first added, which the Chronicle shows; a new record otherwise.
            const createdAt = raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt)) ? new Date(raw.createdAt) : null;
            const doc = { _id, ...v, normalizedTitle: norm, conqueredAt, deletedAt: trashedInBackup ? new Date(raw.deletedAt) : null, ...(createdAt ? { createdAt } : {}) };
            inserts.push(doc);
            byNorm.set(norm, doc);
            if (raw._id) idMap.set(String(raw._id), _id);
            room--;
        }

        let added = inserts.length;
        if (inserts.length) {
            try {
                await Quest.insertMany(inserts, { ordered: false });
            } catch (err) {
                // A record refused here (a title another one already holds, say) is skipped;
                // its reading-log entries are dropped with it rather than left pointing nowhere.
                const failed = (err.writeErrors || []).map((w) => inserts[w.index ?? w.err?.index]?._id).filter(Boolean);
                if (!failed.length) throw err;
                const gone = new Set(failed.map(String));
                for (const [k, id] of idMap) if (gone.has(String(id))) idMap.delete(k);
                added -= failed.length;
                skipped += failed.length;
            }
        }
        if (updates.length) await Quest.bulkWrite(updates, { ordered: false });

        // Reading log: same record, same moment, same move = already recorded.
        const rows = [];
        for (const e of log) {
            const questId = idMap.get(String(e?.questId));
            const from = Number(e?.from), to = Number(e?.to), delta = Number(e?.delta);
            const at = new Date(e?.at);
            if (!questId || ![from, to, delta].every(Number.isInteger) || !DAY_RE.test(String(e?.day)) || Number.isNaN(at.getTime())) continue;
            rows.push({ questId, title: String(e.title || '').slice(0, 300), from, to, delta, day: e.day, at });
        }
        const keyOf = (r) => `${r.questId}|${+new Date(r.at)}|${r.from}|${r.to}`;
        const seen = new Set((await ReadingLog.find({ questId: { $in: [...new Set(rows.map((r) => r.questId))] } })
            .select('questId at from to').lean()).map(keyOf));
        const fresh = rows.filter((r) => !seen.has(keyOf(r)) && seen.add(keyOf(r)));
        if (fresh.length) await ReadingLog.insertMany(fresh, { ordered: false });

        // Titles: each one the catalogue still knows is granted, keeping the earlier date when
        // this archive holds it already. A future date is a bad file, not an early grant.
        const titleDates = new Map();
        for (const a of Array.isArray(b.achievements) ? b.achievements : []) {
            const at = new Date(a?.unlockedAt);
            if (!ACHIEVEMENT_KEYS.has(a?.key) || isNaN(at) || at.getTime() > Date.now() + 86400000) continue;
            if (!titleDates.has(a.key) || at < titleDates.get(a.key).at) titleDates.set(a.key, { at, recognised: a.recognised === true });
        }
        let titlesRestored = 0;
        if (titleDates.size) {
            const r = await getModel(req.dbConn, 'Achievement').bulkWrite([...titleDates].map(([key, t]) => ({
                updateOne: {
                    filter: { key },
                    update: { $min: { unlockedAt: t.at }, $setOnInsert: { recognised: t.recognised } },
                    upsert: true,
                },
            })), { ordered: false });
            titlesRestored = r.upsertedCount || 0;
        }

        // Streak: only when the backup has read more recently than this library.
        let streakRestored = false;
        const s = b.settings;
        if (s && DAY_RE.test(String(s.lastReadDate)) && Number.isInteger(s.streak) && s.streak >= 0) {
            await ensureUserSettings(UserSettings, req.user._id);
            const r = await UserSettings.updateOne(
                { userId: req.user._id, $or: [{ lastReadDate: null }, { lastReadDate: { $lt: s.lastReadDate } }] },
                { $set: { streak: s.streak, lastReadDate: s.lastReadDate } },
            );
            streakRestored = r.modifiedCount > 0;
        }

        // The equipped title, when this archive has none and holds that title (after the merge).
        if (s && typeof s.equippedTitle === 'string' && ACHIEVEMENT_KEYS.has(s.equippedTitle)
            && await getModel(req.dbConn, 'Achievement').exists({ key: s.equippedTitle })) {
            await ensureUserSettings(UserSettings, req.user._id);
            await UserSettings.updateOne(
                { userId: req.user._id, equippedTitle: null },
                { $set: { equippedTitle: s.equippedTitle } }
            );
        }

        // The rest of the settings, each only where this archive has not set its own, so a
        // restore never overrides a choice made here: the daily and weekly quests while they
        // are still the defaults, the ACTIVE QUESTS order while there is none. Record ids go
        // through idMap, as the reading log does.
        const settingsRestored = [];
        if (s && typeof s === 'object') {
            await ensureUserSettings(UserSettings, req.user._id);
            const cur = await UserSettings.findOne({ userId: req.user._id })
                .select('questOrder dailyGoalKind dailyGoalTarget weeklyGoalTarget').lean();
            const set = {};
            const goalsUntouched = (cur?.dailyGoalKind ?? 'SERIES') === 'SERIES'
                && (cur?.dailyGoalTarget ?? 5) === 5 && (cur?.weeklyGoalTarget ?? 50) === 50;
            const kind = s.dailyGoalKind === 'CHAPTERS' || s.dailyGoalKind === 'SERIES' ? s.dailyGoalKind : null;
            const inRange = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
            if (goalsUntouched && kind && inRange(s.dailyGoalTarget, GOAL_MAX[kind]) && inRange(s.weeklyGoalTarget, GOAL_MAX.WEEKLY)
                && !(kind === 'SERIES' && s.dailyGoalTarget === 5 && s.weeklyGoalTarget === 50)) {
                Object.assign(set, { dailyGoalKind: kind, dailyGoalTarget: s.dailyGoalTarget, weeklyGoalTarget: s.weeklyGoalTarget });
                settingsRestored.push('quests');
            }
            if (!cur?.questOrder?.length && Array.isArray(s.questOrder)) {
                const order = [...new Set(s.questOrder.map((id) => idMap.get(String(id))).filter(Boolean).map(String))].slice(0, 2000);
                if (order.length) { set.questOrder = order; settingsRestored.push('quest order'); }
            }
            if (Object.keys(set).length) await UserSettings.updateOne({ userId: req.user._id }, { $set: set });
        }

        // The daily quest's progress for the days the archive still keeps (the past week):
        // the series read forward each day, merged into what this archive already counts.
        let questDaysRestored = 0;
        const today = todayFor(req);
        const keepFrom = shiftDay(today, -7);
        const dayOps = [];
        for (const d of Array.isArray(b.dailyQuests) ? b.dailyQuests : []) {
            const date = String(d?.date);
            if (!DAY_RE.test(date) || date < keepFrom || date > today) continue;
            const ids = [...new Set((Array.isArray(d.absorbedIds) ? d.absorbedIds : [])
                .map((id) => idMap.get(String(id))).filter(Boolean).map(String))];
            if (!ids.length) continue;
            dayOps.push({ updateOne: {
                filter: { date },
                // Dated to its own day, so it expires with the week as the live ones do.
                update: { $setOnInsert: { date, createdAt: new Date(`${date}T12:00:00Z`) }, $addToSet: { absorbedIds: { $each: ids } } },
                upsert: true,
            } });
        }
        if (dayOps.length) {
            const r = await getModel(req.dbConn, 'DailyQuest').bulkWrite(dayOps, { ordered: false });
            questDaysRestored = (r.upsertedCount || 0) + (r.modifiedCount || 0);
        }

        res.json({ added, updated: updates.length, skipped, logEntries: fresh.length, streakRestored, titlesRestored, settingsRestored, questDaysRestored });
    } catch (err) {
        return sendError(res, 500, 'Restore failed.', err);
    }
});

module.exports = router;
