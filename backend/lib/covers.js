/* Cover backfill: finding covers for records that have none. (Split out of index.js, 2026-11-13.) */

const { getModel } = require('../models/modelFactory');
const { normalizeTitle } = require('../utils/normalizeTitle');
const { LIVE, sleep } = require('./common');
const { lookupMetadata } = require('./metadata');
const { isWebUrl } = require('./questRules');

// ─── COVER BACKFILL ───────────────────────────────────────────────────────────

/** How long a title that no source had a cover for waits before it is looked up again. */
const COVER_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when the metadata is plainly the same series: one of its titles normalizes to the
 * record's, or starts with it and adds one word at most ("Omniscient Reader" -> "Omniscient
 * Reader's Viewpoint"). The limit is what stops "Necromancer Academy" from taking the cover
 * of "Necromancer Academy's Genius Summoner" (two more words, a different name). AUTO's
 * scoring will return a loose match rather than nothing, and a wrong cover is worse than the
 * monogram plate; a cover the rule misses can still be set by hand.
 */
const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

const sameSeries = (questTitle, data) => {
    const want = normalizeTitle(questTitle);
    if (want.length < 4) return false;
    const names = [data?.title?.english, data?.title?.romaji, ...(data?.altTitles || [])].filter(Boolean);
    return names.some((name) => {
        const n = normalizeTitle(name);
        return n === want
            || (want.length >= 8 && n.startsWith(want) && wordCount(name) - wordCount(questTitle) <= 1);
    });
};

/**
 * Fill in missing covers for up to `limit` records, least recently tried first, through the
 * cached metadata lookup. Only an empty cover is ever written, so a cover set meanwhile (or
 * by hand) is never replaced. Two at a time, as the chapter sync does, to stay polite to the
 * sources.
 */
const backfillCovers = async (conn, limit) => {
    const Quest = getModel(conn, 'Quest');
    const noCover = { ...LIVE, cover: { $in: ['', null] } };
    const due = await Quest.find({
        ...noCover,
        $or: [{ coverCheckedAt: null }, { coverCheckedAt: { $lt: new Date(Date.now() - COVER_RECHECK_MS) } }],
    })
        .sort({ coverCheckedAt: 1, _id: 1 }) // never tried (null) sorts first
        .limit(limit)
        .select('title')
        .lean();

    const filled = [];
    for (let i = 0; i < due.length; i += 2) {
        await Promise.all(due.slice(i, i + 2).map(async (q) => {
            const { data } = await lookupMetadata(q.title, 'AUTO').catch(() => ({ data: null }));
            const url = data && sameSeries(q.title, data)
                ? (data.coverImage?.extraLarge || data.coverImage?.large || '')
                : '';
            const set = { coverCheckedAt: new Date() };
            if (url && isWebUrl(url)) set.cover = url;
            const r = await Quest.updateOne({ _id: q._id, cover: { $in: ['', null] } }, { $set: set });
            if (set.cover && r.modifiedCount) filled.push({ id: q._id, title: q.title });
        }));
        if (i + 2 < due.length) await sleep(400);
    }
    const remaining = await Quest.countDocuments(noCover);
    return { checked: due.length, filled, remaining };
};

module.exports = { COVER_RECHECK_MS, wordCount, sameSeries, backfillCovers };
