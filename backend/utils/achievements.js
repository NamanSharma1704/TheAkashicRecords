const { getModel } = require('../models/modelFactory');

/**
 * TITLES: achievements the System grants for reading.
 *
 * Each title is one measure of the archive against one target, so a locked title can show
 * how far along it is. Most measures come from the reading log (one signed entry per chapter
 * move, in the reader's own days); the rest from the live library. Days count when their
 * moves net forward, exactly as the reading stats count them, so an Undo earns nothing.
 *
 * `kind` picks the icon on the client. Keys are stored, so never rename one; retire a title
 * by leaving its key out (an earned copy then simply stops being listed).
 *
 * THE TITLES CODEX (2026-11-14): thirteen more, thirty in all. `hidden` ones are secrets until
 * earned: the sync sends a hidden, locked title without its name, description or progress (the
 * profile shows it UNDECODED), and the whole of it once it is held.
 */
const ACHIEVEMENTS = [
    { key: 'initiate', name: 'Initiate', kind: 'FIRST', measure: 'daysRead', target: 1, description: 'Read your first logged chapter.' },
    { key: 'streak_7', name: 'Unbroken', kind: 'STREAK', measure: 'longestStreak', target: 7, description: 'Read on 7 days in a row.' },
    { key: 'streak_30', name: 'Iron Will', kind: 'STREAK', measure: 'longestStreak', target: 30, description: 'Read on 30 days in a row.' },
    { key: 'streak_100', name: 'Ceaseless', kind: 'STREAK', measure: 'longestStreak', target: 100, description: 'Read on 100 days in a row.' },
    { key: 'day_50', name: 'Overclocked', kind: 'SURGE', measure: 'bestDay', target: 50, description: 'Read 50 chapters in one day.' },
    { key: 'day_150', name: 'Limit Breaker', kind: 'SURGE', measure: 'bestDay', target: 150, description: 'Read 150 chapters in one day.' },
    { key: 'series_10', name: 'Multiverse Walker', kind: 'BREADTH', measure: 'bestDaySeries', target: 10, description: 'Read 10 different series in one day.' },
    { key: 'night', name: 'Night Reader', kind: 'NIGHT', measure: 'nightReading', target: 1, description: 'Read a chapter between midnight and 4 a.m.' },
    { key: 'returner', name: 'Returner', kind: 'RETURN', measure: 'longestReturn', target: 60, description: 'Pick a series back up after 60 days away from it.' },
    { key: 'conquer_1', name: 'Gate Breaker', kind: 'CONQUEST', measure: 'conquered', target: 1, description: 'Conquer a series.' },
    { key: 'conquer_10', name: 'Raid Leader', kind: 'CONQUEST', measure: 'conquered', target: 10, description: 'Conquer 10 series.' },
    { key: 'conquer_50', name: 'Conqueror', kind: 'CONQUEST', measure: 'conquered', target: 50, description: 'Conquer 50 series.' },
    { key: 'depth_500', name: 'Abyss Diver', kind: 'DEPTH', measure: 'deepest', target: 500, description: 'Reach chapter 500 of a single series.' },
    { key: 'classes_5', name: 'Multiclass', kind: 'CLASSES', measure: 'classesRead', target: 5, description: 'Read a series from each of the five classes.' },
    { key: 'appraise_25', name: 'Appraiser', kind: 'APPRAISAL', measure: 'appraised', target: 25, description: 'Give 25 series an appraisal.' },
    { key: 'archive_100', name: 'Archivist', kind: 'ARCHIVE', measure: 'archived', target: 100, description: 'Keep 100 series in the archive.' },
    { key: 'archive_1000', name: 'Keeper of the Records', kind: 'ARCHIVE', measure: 'archived', target: 1000, description: 'Keep 1,000 series in the archive.' },
    // THE TITLES CODEX, 2026-11-14.
    { key: 'days_100', name: 'Devoted', kind: 'DEVOTION', measure: 'daysRead', target: 100, description: 'Read on 100 different days.' },
    { key: 'weekend_100', name: 'Weekend Raider', kind: 'SURGE', measure: 'bestWeekend', target: 100, description: 'Read 100 chapters across one weekend.' },
    { key: 'week_500', name: 'Relentless', kind: 'SURGE', measure: 'bestWeek', target: 500, description: 'Read 500 chapters in one week, Monday to Sunday.' },
    { key: 'series_25', name: 'Omniverse', kind: 'BREADTH', measure: 'bestDaySeries', target: 25, description: 'Read 25 different series in one day.' },
    { key: 'conquer_25', name: 'Warlord', kind: 'CONQUEST', measure: 'conquered', target: 25, description: 'Conquer 25 series.' },
    { key: 'conquer_long', name: 'Completionist', kind: 'CONQUEST', measure: 'conqueredLong', target: 1, description: 'Conquer a series of 300 chapters or more.' },
    { key: 'caught_up_10', name: 'Caught Up', kind: 'CAUGHT_UP', measure: 'caughtUp', target: 10, description: 'Be current on 10 Active series at once.' },
    { key: 'appraise_100', name: "Appraiser's Eye", kind: 'APPRAISAL', measure: 'appraised', target: 100, description: 'Give 100 series an appraisal.' },
    { key: 'archive_250', name: 'Archive Keeper', kind: 'ARCHIVE', measure: 'archived', target: 250, description: 'Keep 250 series in the archive.' },
    { key: 'dawn', name: 'Dawn Reader', kind: 'DAWN', measure: 'dawnReading', target: 1, hidden: true, description: 'Read a chapter between 5 and 7 a.m.' },
    { key: 'night_100', name: 'Nocturne', kind: 'NIGHT', measure: 'nightChapters', target: 100, hidden: true, description: 'Read 100 chapters between midnight and 4 a.m.' },
    { key: 'depth_1000', name: 'Leviathan', kind: 'DEPTH', measure: 'deepest', target: 1000, hidden: true, description: 'Reach chapter 1,000 of a single series.' },
    { key: 'streak_365', name: 'Eternal', kind: 'STREAK', measure: 'longestStreak', target: 365, hidden: true, description: 'Read on 365 days in a row.' },
];
const ACHIEVEMENT_KEYS = new Set(ACHIEVEMENTS.map((a) => a.key));

/** The five classes a series can hold (UNKNOWN is the absence of one). */
const CLASSES = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
/** Night is before this hour, in the reader's timezone. */
const NIGHT_ENDS = 4;
/** Dawn is from this hour to DAWN_ENDS, in the reader's timezone. */
const DAWN_STARTS = 5;
const DAWN_ENDS = 7;
/** A conquest this long or longer counts for Completionist. */
const LONG_SERIES = 300;
/** The weekday of a whole-day number: 0 is Sunday (day 0, 1 Jan 1970, was a Thursday). */
const weekdayOfNumber = (n) => (n + 4) % 7;

/** 'YYYY-MM-DD' as a whole-day number, so consecutive days differ by exactly 1. */
const dayNumber = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
};
const maxOf = (values) => {
    let best = 0;
    for (const v of values) if (v > best) best = v;
    return best;
};

/**
 * Every measure the catalogue uses, for one archive. `tz` is the reader's IANA zone (already
 * validated), which places a chapter's time of day. `held` (the keys already earned) drops the
 * time-of-day queries that cannot use an index once the titles they serve are held.
 */
const measureArchive = async (conn, tz, { held = new Set() } = {}) => {
    const hourIn = { $hour: { date: '$at', timezone: tz } };
    const Quest = getModel(conn, 'Quest');
    const ReadingLog = getModel(conn, 'ReadingLog');

    const [libraryRows, questDays, night, dawn, nightRows] = await Promise.all([
        Quest.aggregate([
            { $match: { deletedAt: null } },
            {
                $group: {
                    _id: null,
                    archived: { $sum: 1 },
                    conquered: { $sum: { $cond: [{ $eq: ['$status', 'CONQUERED'] }, 1, 0] } },
                    // A missing or null rating sorts below every number, so this counts rated ones.
                    appraised: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } },
                    deepest: { $max: '$currentChapter' },
                    classes: { $addToSet: { $cond: [{ $gt: ['$currentChapter', 0] }, '$classType', null] } },
                    conqueredLong: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'CONQUERED'] }, { $gte: ['$totalChapters', LONG_SERIES] }] }, 1, 0] } },
                    // Current on: an Active series whose chapter has reached its known total.
                    caughtUp: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'ACTIVE'] }, { $gt: ['$totalChapters', 0] }, { $gte: ['$currentChapter', '$totalChapters'] }] }, 1, 0] } },
                },
            },
        ]),
        // One row per series per day, netted: enough for day totals, series per day and gaps.
        ReadingLog.aggregate([
            { $group: { _id: { day: '$day', questId: '$questId' }, net: { $sum: '$delta' } } },
        ]),
        held.has('night')
            ? Promise.resolve(true)
            : ReadingLog.exists({
                delta: { $gt: 0 },
                // $hour of a missing date is null, and null sorts below 4: insist on a date.
                at: { $type: 'date' },
                $expr: { $lt: [hourIn, NIGHT_ENDS] },
            }),
        held.has('dawn')
            ? Promise.resolve(true)
            : ReadingLog.exists({
                delta: { $gt: 0 },
                at: { $type: 'date' },
                $expr: { $and: [{ $gte: [hourIn, DAWN_STARTS] }, { $lt: [hourIn, DAWN_ENDS] }] },
            }),
        // Chapters read at night, netted (an Undo at night takes its chapters back).
        held.has('night_100')
            ? Promise.resolve(null)
            : ReadingLog.aggregate([
                { $match: { at: { $type: 'date' }, $expr: { $lt: [hourIn, NIGHT_ENDS] } } },
                { $group: { _id: null, net: { $sum: '$delta' } } },
            ]),
    ]);

    const lib = libraryRows[0] || { archived: 0, conquered: 0, appraised: 0, deepest: 0, classes: [], conqueredLong: 0, caughtUp: 0 };
    const dayTotals = new Map();
    const seriesPerDay = new Map();
    const daysBySeries = new Map();
    for (const { _id: { day, questId }, net } of questDays) {
        if (typeof day !== 'string') continue;
        dayTotals.set(day, (dayTotals.get(day) || 0) + net);
        if (net <= 0) continue;
        seriesPerDay.set(day, (seriesPerDay.get(day) || 0) + 1);
        const id = String(questId);
        if (!daysBySeries.has(id)) daysBySeries.set(id, []);
        daysBySeries.get(id).push(dayNumber(day));
    }

    const readDays = [...dayTotals].filter(([, n]) => n > 0).map(([day]) => dayNumber(day)).sort((a, b) => a - b);
    let longestStreak = 0;
    for (let i = 0, run = 0; i < readDays.length; i++) {
        run = i > 0 && readDays[i] === readDays[i - 1] + 1 ? run + 1 : 1;
        if (run > longestStreak) longestStreak = run;
    }
    // A weekend is a Saturday and the Sunday after it; a week runs Monday to Sunday.
    const totalsByNumber = new Map([...dayTotals].map(([day, n]) => [dayNumber(day), n]));
    let bestWeekend = 0;
    const weeks = new Map();
    for (const [n, total] of totalsByNumber) {
        const wd = weekdayOfNumber(n);
        if (wd === 6) bestWeekend = Math.max(bestWeekend, total + (totalsByNumber.get(n + 1) || 0));
        if (wd === 0 && !totalsByNumber.has(n - 1)) bestWeekend = Math.max(bestWeekend, total);
        const monday = n - ((wd + 6) % 7);
        weeks.set(monday, (weeks.get(monday) || 0) + total);
    }
    let longestReturn = 0;
    for (const days of daysBySeries.values()) {
        days.sort((a, b) => a - b);
        for (let i = 1; i < days.length; i++) longestReturn = Math.max(longestReturn, days[i] - days[i - 1]);
    }

    return {
        daysRead: readDays.length,
        longestStreak,
        bestDay: maxOf(dayTotals.values()),
        bestDaySeries: maxOf(seriesPerDay.values()),
        nightReading: night ? 1 : 0,
        longestReturn,
        conquered: lib.conquered || 0,
        deepest: lib.deepest || 0,
        classesRead: (lib.classes || []).filter((c) => CLASSES.includes(c)).length,
        appraised: lib.appraised || 0,
        archived: lib.archived || 0,
        dawnReading: dawn ? 1 : 0,
        // A skipped count (the title is held) reports the bar, not a number it did not measure.
        nightChapters: nightRows === null ? 100 : Math.max(0, nightRows[0]?.net || 0),
        bestWeekend: Math.max(0, bestWeekend),
        bestWeek: Math.max(0, maxOf(weeks.values())),
        conqueredLong: lib.conqueredLong || 0,
        caughtUp: lib.caughtUp || 0,
    };
};

module.exports = { ACHIEVEMENTS, ACHIEVEMENT_KEYS, measureArchive };
