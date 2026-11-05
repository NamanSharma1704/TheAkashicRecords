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
];
const ACHIEVEMENT_KEYS = new Set(ACHIEVEMENTS.map((a) => a.key));

/** The five classes a series can hold (UNKNOWN is the absence of one). */
const CLASSES = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
/** Night is before this hour, in the reader's timezone. */
const NIGHT_ENDS = 4;

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
 * validated), which places a chapter's time of day. `skipNight` drops the one query that
 * cannot use an index, once Night Reader is held.
 */
const measureArchive = async (conn, tz, { skipNight = false } = {}) => {
    const Quest = getModel(conn, 'Quest');
    const ReadingLog = getModel(conn, 'ReadingLog');

    const [libraryRows, questDays, night] = await Promise.all([
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
                },
            },
        ]),
        // One row per series per day, netted: enough for day totals, series per day and gaps.
        ReadingLog.aggregate([
            { $group: { _id: { day: '$day', questId: '$questId' }, net: { $sum: '$delta' } } },
        ]),
        skipNight
            ? Promise.resolve(true)
            : ReadingLog.exists({
                delta: { $gt: 0 },
                // $hour of a missing date is null, and null sorts below 4: insist on a date.
                at: { $type: 'date' },
                $expr: { $lt: [{ $hour: { date: '$at', timezone: tz } }, NIGHT_ENDS] },
            }),
    ]);

    const lib = libraryRows[0] || { archived: 0, conquered: 0, appraised: 0, deepest: 0, classes: [] };
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
    };
};

module.exports = { ACHIEVEMENTS, ACHIEVEMENT_KEYS, measureArchive };
