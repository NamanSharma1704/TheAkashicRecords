/* Calendar days in the reader's own time zone, streaks, and the daily and weekly quests. (Split out of index.js, 2026-11-13.) */

const { getModel } = require('../models/modelFactory');

// ─── CALENDAR DAYS ────────────────────────────────────────────────────────────
// Streaks and daily counts are about the READER's day, not the server's. This used to be
// `new Date().toISOString()` — the UTC day — so the day rolled over at UTC midnight wherever
// you were, and late-night reading could land on the wrong day and break a streak. The app
// now sends its IANA timezone (X-Timezone, see src/utils/auth.ts systemFetch); anything
// missing or invalid falls back to UTC, the old behaviour.
const validZones = new Map();

const tzOf = (req) => {
    const tz = String(req.headers['x-timezone'] || '');
    if (!tz || tz.length > 64) return 'UTC';
    if (!validZones.has(tz)) {
        if (validZones.size > 500) validZones.clear(); // bound the cache
        try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); validZones.set(tz, true); }
        catch { validZones.set(tz, false); }
    }
    return validZones.get(tz) ? tz : 'UTC';
};

/** 'YYYY-MM-DD' for `date` as a calendar day in `tz` (en-CA formats dates ISO-style). */
const dayIn = (tz, date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** The calendar day `delta` days from `day` ('YYYY-MM-DD'). Pure date arithmetic, no zone. */
const shiftDay = (day, delta) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

const todayFor = (req) => dayIn(tzOf(req));

/**
 * The streak as of `today`. The stored count only changes when you read, so a streak you
 * broke days ago was still displayed until your next read. It is live only while the last
 * read was today or yesterday.
 */
const liveStreak = (settings, today) =>
    settings && (settings.lastReadDate === today || settings.lastReadDate === shiftDay(today, -1))
        ? settings.streak || 0
        : 0;

/** The Monday of the week holding `day` ('YYYY-MM-DD'): quest weeks run Monday to Sunday. */
const weekStartOf = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return shiftDay(day, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
};

/** Highest target each quest accepts. */
const GOAL_MAX = { SERIES: 25, CHAPTERS: 500, WEEKLY: 5000 };

/**
 * The daily and weekly quests with progress. A SERIES day counts the series read forward
 * today (the absorbed ids); chapter counts are the reading log's net per day, a day that
 * nets backwards counting as none, exactly as the reading stats count them.
 */
const readGoals = async (req, settings, daily, today) => {
    const weekStart = weekStartOf(today);
    const rows = await getModel(req.dbConn, 'ReadingLog').aggregate([
        { $match: { day: { $gte: weekStart, $lte: today } } },
        { $group: { _id: '$day', net: { $sum: '$delta' } } },
    ]);
    const kind = settings?.dailyGoalKind === 'CHAPTERS' ? 'CHAPTERS' : 'SERIES';
    return {
        today,
        daily: {
            kind,
            target: settings?.dailyGoalTarget || 5,
            progress: kind === 'SERIES'
                ? (daily?.absorbedIds?.length || 0)
                : Math.max(0, rows.find((r) => r._id === today)?.net || 0),
        },
        weekly: {
            target: settings?.weeklyGoalTarget || 50,
            progress: rows.reduce((sum, r) => sum + Math.max(0, r.net), 0),
            startsOn: weekStart,
            endsOn: shiftDay(weekStart, 6),
        },
    };
};

/**
 * Fetch-or-create for the two per-tenant singletons, as ONE atomic operation.
 *
 * These used to be a findOne followed by a create when nothing came back. Two requests
 * arriving together for a new tenant — React StrictMode's doubled mount effect, two
 * tabs, a chapter PUT beside a state refresh — both saw nothing, both inserted, and the
 * unique index rejected the loser with E11000. That surfaced as a 500 from
 * /api/boot/initial-data, which the client treats as "no library". An upsert keyed on
 * the unique field is resolved inside the database and cannot collide with itself.
 */
const ensureUserSettings = (UserSettings, userId) => UserSettings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, returnDocument: 'after' }
);

const ensureDailyQuest = (DailyQuest, date) => DailyQuest.findOneAndUpdate(
    { date },
    { $setOnInsert: { date } },
    { upsert: true, returnDocument: 'after' }
);

module.exports = { validZones, tzOf, dayIn, shiftDay, todayFor, liveStreak, weekStartOf, GOAL_MAX, readGoals, ensureUserSettings, ensureDailyQuest };
