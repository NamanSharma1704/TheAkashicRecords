/* New-chapter tracking: which series are due a check, and checking them. (Split out of index.js, 2026-11-13.) */

const { getModel } = require('../models/modelFactory');
const { CHAPTER_SOURCE_KEYS, checkLatestChapter, prefetchChapterBatch } = require('../utils/metadataProxy');
const { LIVE, sleep } = require('./common');
const { dayOf } = require('./radar');

/** RELEASE RADAR: a find small enough, and close enough to the last check, to date a release. */
const FRESH_FIND_MAX = 3;
const FRESH_CHECK_MS = 3 * 24 * 60 * 60 * 1000;
const isFreshRelease = (q, added) => added > 0 && added <= FRESH_FIND_MAX
    && !!q.chaptersCheckedAt && Date.now() - new Date(q.chaptersCheckedAt).getTime() < FRESH_CHECK_MS;

// ─── NEW-CHAPTER TRACKING ─────────────────────────────────────────────────────

/**
 * Which series to check, and how often. A CONQUERED or SEVERED series has nothing you are
 * waiting for. An ACTIVE one is what you are reading, so it is checked most: every 2 hours
 * when the hourly run has room. PLANNED and STASIS ones still release chapters you will want
 * to know about, but you are not waiting on them: every 12 hours.
 */
const ACTIVE_CHECK_MS = 2 * 60 * 60 * 1000;

const RESTING_CHECK_MS = 12 * 60 * 60 * 1000;

const RESTING_STATUSES = ['PLANNED', 'STASIS'];

/** A source whose title search found nothing is searched again after this, not every run. */
const SOURCE_MISS_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Series checked at once. MangaDex allows about 5 requests a second; a series asks it for
 *  one (by id) or two (a search, then the chapters). */
const SYNC_CONCURRENCY = 3;

const SYNC_PAUSE_MS = 350;

/**
 * The series due a check, ACTIVE first. `dueOnly` (the hourly run): only those past their
 * interval, oldest check first. Otherwise (the app's button): the least recently checked,
 * ACTIVE first, whatever their interval, since the reader asked.
 */
const pickDueSeries = async (Quest, limit, dueOnly) => {
    const now = Date.now();
    const fields = 'title totalChapters status chaptersCheckedAt +sourceIds +sourceMissedAt';
    const overdue = (ms) => (dueOnly ? { $or: [{ chaptersCheckedAt: null }, { chaptersCheckedAt: { $lt: new Date(now - ms) } }] } : {});
    const oldestFirst = { chaptersCheckedAt: 1, _id: 1 }; // never checked (null) sorts first
    const active = await Quest.find({ ...LIVE, status: 'ACTIVE', ...overdue(ACTIVE_CHECK_MS) })
        .sort(oldestFirst).limit(limit).select(fields).lean();
    const room = limit - active.length;
    const resting = room > 0
        ? await Quest.find({ ...LIVE, status: { $in: RESTING_STATUSES }, ...overdue(RESTING_CHECK_MS) })
            .sort(oldestFirst).limit(room).select(fields).lean()
        : [];
    return [...active, ...resting];
};

/**
 * Check series for newly released chapters. When a source shows more chapters than the stored
 * total, the total is raised and the difference added to `newChapters`, which the app shows as
 * "+N NEW" until you read on. Totals are never lowered: a source is often behind the site you
 * actually read on.
 *
 * Faster than it was (2026-11-10): each series keeps the id every source filed it under, the
 * first time a title search matches (`sourceIds`), and is asked for by id from then on: one
 * request where a search took two, AniList's for the whole run in one batch. A source that
 * found nothing by title is searched again weekly, not hourly (`sourceMissedAt`). So a run
 * covers several times more series, and the ones you are reading come round every 2 hours.
 *
 * Bounded by time as well as count: no new series is started after `budgetMs`, so a slow
 * source can never push the run past the platform's 60 s limit. Series not reached keep their
 * old check time and come first next run.
 */
const syncChapters = async (conn, { limit, budgetMs, dueOnly }) => {
    const Quest = getModel(conn, 'Quest');
    const started = Date.now();
    const due = await pickDueSeries(Quest, limit, dueOnly);

    const idsOf = (q, k) => q.sourceIds?.[k] || null;
    const batch = await prefetchChapterBatch({
        mangadex: due.map((q) => idsOf(q, 'mangadex')).filter(Boolean),
        anilist: due.map((q) => idsOf(q, 'anilist')).filter(Boolean),
    });

    const updated = [];
    const asked = { byId: 0, bySearch: 0, skipped: 0 };
    let checked = 0;
    for (let i = 0; i < due.length; i += SYNC_CONCURRENCY) {
        if (Date.now() - started > budgetMs) break;
        await Promise.all(due.slice(i, i + SYNC_CONCURRENCY).map(async (q) => {
            const ids = Object.fromEntries(CHAPTER_SOURCE_KEYS.map((k) => [k, idsOf(q, k)]));
            const now = Date.now();
            // By id where known; by title unless that came up empty within the week.
            const ask = CHAPTER_SOURCE_KEYS.filter((k) => {
                if (ids[k]) { asked.byId++; return true; }
                const missed = q.sourceMissedAt?.[k];
                if (missed && now - new Date(missed).getTime() < SOURCE_MISS_RETRY_MS) { asked.skipped++; return false; }
                asked.bySearch++;
                return true;
            });
            const { latest, answers } = await checkLatestChapter(q.title, { ids, ask, batch })
                .catch(() => ({ latest: null, answers: {} }));

            const set = { chaptersCheckedAt: new Date() };
            const unset = {};
            for (const [k, a] of Object.entries(answers)) {
                if (a.outcome === 'found') {
                    if (a.id !== null && String(a.id) !== String(ids[k] ?? '')) set[`sourceIds.${k}`] = a.id;
                    if (q.sourceMissedAt?.[k]) unset[`sourceMissedAt.${k}`] = 1;
                } else if (a.outcome === 'miss') {
                    set[`sourceMissedAt.${k}`] = new Date();
                } else if (a.outcome === 'lost') {
                    // Gone from the source: search for it again next time.
                    unset[`sourceIds.${k}`] = 1;
                }
            }

            const total = q.totalChapters || 0;
            // Far past the record is likelier the wrong series than a burst of releases.
            const plausible = latest !== null && (total === 0 || latest <= total * 3 + 50);
            let added = 0;
            if (plausible && latest > total) {
                set.totalChapters = latest;
                set.chaptersUpdatedAt = new Date();
                // Filling in an unknown total is not "new chapters".
                added = total > 0 ? latest - total : 0;
                updated.push({ id: q._id, title: q.title, from: total, to: latest, added });
            } else if (latest !== null && !plausible) {
                console.warn(`[Chapters] Ignored ${latest} for "${q.title}" (record says ${total}): implausible match.`);
            }
            await Quest.updateOne({ _id: q._id }, {
                $set: set,
                ...(Object.keys(unset).length ? { $unset: unset } : {}),
                ...(added > 0 ? { $inc: { newChapters: added } } : {}),
                // A fresh find is a release the Radar can date: a few chapters, on a series
                // also checked in the last few days. A backlog caught up on cannot be dated.
                ...(isFreshRelease(q, added) ? { $addToSet: { foundDays: dayOf(Date.now()) } } : {}),
            });
            checked++;
        }));
        if (i + SYNC_CONCURRENCY < due.length) await sleep(SYNC_PAUSE_MS);
    }
    return { checked, due: due.length, updated, asked, ms: Date.now() - started };
};

module.exports = { ACTIVE_CHECK_MS, RESTING_CHECK_MS, RESTING_STATUSES, SOURCE_MISS_RETRY_MS, SYNC_CONCURRENCY, SYNC_PAUSE_MS, pickDueSeries, syncChapters };
