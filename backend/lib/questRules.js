/* What a quest record may hold, and the reading log a chapter step writes. (Split out of index.js, 2026-11-13.) */

const { getModel } = require('../models/modelFactory');
const { ensureUserSettings, shiftDay, todayFor } = require('./days');

// Allowed fields for quest creation/update (prevents mass assignment)
const QUEST_ALLOWED_FIELDS = ['title', 'cover', 'synopsis', 'totalChapters', 'currentChapter', 'status', 'classType', 'readLink', 'lastRead', 'rating'];

const sanitizeQuestBody = (body) => {
    const safe = {};
    QUEST_ALLOWED_FIELDS.forEach(f => {
        if (body[f] !== undefined) safe[f] = body[f];
    });
    return safe;
};

// ─── QUEST VALIDATION ─────────────────────────────────────────────────────────
// The allowlist above decides WHICH fields a client may write; this decides what values.
// Before it, negative chapters, text in number fields, a `javascript:` reading link and any
// status string at all went straight into the database.
// PLANNED shows in the app as SEALED (plan to read); STASIS is on hold.
const QUEST_STATUSES = ['ACTIVE', 'PLANNED', 'STASIS', 'CONQUERED', 'SEVERED'];

const QUEST_CLASSES = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER', 'UNKNOWN'];

const MAX_CHAPTER = 100000;

const MAX_URL = 2048;

const isWebUrl = (s) => {
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Validate and normalise a quest write. `existing` is the stored record on an update, null on
 * a create. Returns { value } (allowlisted, normalised) or { error } (the message for a 400).
 *
 * A status or class the app cannot produce is refused only when it CHANGES: records written by
 * older builds may carry legacy values, and re-saving one untouched must not start failing.
 */
const validateQuest = (raw, existing = null) => {
    const v = sanitizeQuestBody(raw || {});
    const fail = (error) => ({ error });

    if (v.title !== undefined) {
        if (typeof v.title !== 'string' || !v.title.trim()) return fail('A title is required.');
        v.title = v.title.trim();
        if (v.title.length > 300) return fail('The title is too long (300 characters at most).');
    } else if (!existing) {
        return fail('A title is required.');
    }

    for (const f of ['currentChapter', 'totalChapters']) {
        if (v[f] === undefined) continue;
        const n = typeof v[f] === 'string' && v[f].trim() !== '' ? Number(v[f]) : v[f];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_CHAPTER) {
            return fail(`${f} must be a whole number from 0 to ${MAX_CHAPTER}.`);
        }
        v[f] = n;
    }

    for (const f of ['readLink', 'cover']) {
        if (v[f] === undefined) continue;
        if (typeof v[f] !== 'string') return fail(`${f} must be text.`);
        v[f] = v[f].trim();
        if (v[f].length > MAX_URL) return fail(`${f} is too long.`);
        // A cover may still hold the app's own proxy path, as written by older builds.
        const ok = !v[f] || isWebUrl(v[f]) || (f === 'cover' && v[f].startsWith('/api/proxy/image?'));
        if (!ok) return fail(`${f === 'readLink' ? 'The reading link' : 'The cover'} must be an http(s) address.`);
    }

    if (v.synopsis !== undefined) {
        if (typeof v.synopsis !== 'string') return fail('The synopsis must be text.');
        if (v.synopsis.length > 20000) return fail('The synopsis is too long.');
    }

    for (const [f, allowed] of [['status', QUEST_STATUSES], ['classType', QUEST_CLASSES]]) {
        if (v[f] === undefined) continue;
        if (typeof v[f] !== 'string') return fail(`${f} must be text.`);
        v[f] = v[f].trim().toUpperCase();
        if (!allowed.includes(v[f]) && v[f] !== existing?.[f]) {
            return fail(`${f} must be one of: ${allowed.join(', ')}.`);
        }
    }

    // The Hunter's Appraisal: a whole 1-10, or null (or "") to clear it. 0 clears it too: the
    // February build's old 0-10 rating stored 0 for "unrated", records saved then still carry
    // it, and an app that sends it back with an edit must not have the whole save refused.
    if (v.rating !== undefined) {
        if (v.rating === null || v.rating === '' || v.rating === 0 || v.rating === '0') v.rating = null;
        else {
            const n = typeof v.rating === 'string' ? Number(v.rating) : v.rating;
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 10) {
                return fail('The appraisal must be a whole number from 1 to 10.');
            }
            v.rating = n;
        }
    }

    // Epoch milliseconds, as stored; a date string (how a backup writes it) is read as a date.
    if (v.lastRead !== undefined) {
        const n = typeof v.lastRead === 'string' && !/^\d+$/.test(v.lastRead.trim()) ? Date.parse(v.lastRead) : Number(v.lastRead);
        if (Number.isFinite(n) && n > 0) v.lastRead = n;
        else delete v.lastRead;
    }

    // The total never sits below the chapter you are on. A chapter past a known total raises
    // it (you read it, so it exists), which is the app's own rule for a typed chapter too.
    const current = v.currentChapter ?? existing?.currentChapter ?? 0;
    const total = v.totalChapters ?? existing?.totalChapters ?? 0;
    if (total > 0 && current > total) v.totalChapters = current;

    return { value: v };
};

/**
 * A chapter moved forward today: advance the streak and absorb the quest into today's count.
 *
 * Two conditional updates instead of read-modify-save, so two saves landing together cannot
 * both extend the streak: whichever runs first moves lastReadDate to today, and the second
 * one's filters then match nothing.
 */
const recordReading = async (req, questId) => {
    const UserSettings = getModel(req.dbConn, 'UserSettings');
    const DailyQuest = getModel(req.dbConn, 'DailyQuest');
    const today = todayFor(req);
    const yesterday = shiftDay(today, -1);
    const userId = req.user._id;

    await ensureUserSettings(UserSettings, userId);
    const extended = await UserSettings.updateOne(
        { userId, lastReadDate: yesterday },
        { $inc: { streak: 1 }, $set: { lastReadDate: today } }
    );
    if (extended.modifiedCount === 0) {
        await UserSettings.updateOne(
            { userId, lastReadDate: { $nin: [today, yesterday] } },
            { $set: { streak: 1, lastReadDate: today } }
        );
    }
    // $addToSet rather than read-push-save: two chapter saves in quick succession would
    // otherwise each read the old array and the second save drop the first id.
    await DailyQuest.updateOne(
        { date: today },
        { $setOnInsert: { date: today }, $addToSet: { absorbedIds: questId } },
        { upsert: true }
    );
};

module.exports = { QUEST_ALLOWED_FIELDS, sanitizeQuestBody, QUEST_STATUSES, QUEST_CLASSES, MAX_CHAPTER, MAX_URL, isWebUrl, validateQuest, recordReading };
