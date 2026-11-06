const { getModel } = require('../models/modelFactory');

/**
 * A lived-in history for a new guest sandbox, built once, right after the template is copied.
 *
 * The sandbox copies only the template's series, so a visitor used to arrive with an empty
 * profile: no reading activity, a streak of 0, most titles locked, no Chronicle. And the
 * template's dates were fixed when it was seeded, so every sample series looked staler by the
 * day. This does two things:
 *
 *   1. Shifts every "last read" (and a conquest date) by one amount, so the newest is now and
 *      the template's spacing is kept.
 *   2. Writes about eight weeks of reading-log entries ending yesterday: evenings in the
 *      guest's timezone, a few chapters a session, at most DAILY_CAP chapters a day, and a
 *      current streak of 8-12 days. Each series' last session falls on its "last read" day;
 *      a series on hold stops three weeks back; the conquered one ends on its conquest day.
 *      Every entry runs up to the series' current chapter, so the log and the library agree.
 *
 * Nothing is logged TODAY and a day holds at most DAILY_CAP chapters, so the visitor's daily
 * and weekly quests (default weekly target 50) are always still open to clear. Titles follow
 * from the log as they would for anyone: a streak of 7 earns Unbroken; nothing reaches the
 * night, big-day or 60-day-return titles. The app's own sync grants them on the first load,
 * quietly, as titles it recognises.
 *
 * Deterministic per sandbox (seeded by the guest id), so a retry builds the same history.
 * Writes go through the native collections: Mongoose treats createdAt as immutable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 56;
const DAILY_CAP = 7;
const PAUSED_FROM = 22;   // a series on hold was last read at least this many days ago
const SMALL_SERIES = 10;  // below this many chapters, a series reads only on its last day

/** mulberry32, seeded from text: stable for one sandbox, different between sandboxes. */
const rngFrom = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** 'YYYY-MM-DD' for `date` in `tz`. */
const dayIn = (tz, date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
/** The calendar day `delta` days from `day`. Pure date arithmetic, no zone. */
const shiftDay = (day, delta) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
/** The instant that reads `hour:minute` on `day` in `tz` (evenings only, so no DST gap). */
const zonedTime = (day, hour, minute, tz) => {
    const [y, m, d] = day.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, hour, minute);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return new Date(guess - (wall - guess));
};

/**
 * Build the history for one sandbox. `tz` is the guest's validated IANA zone (UTC when the
 * browser sent none), `userId` the guest id (the settings row), `now` for tests.
 */
const seedGuestHistory = async (conn, { tz = 'UTC', userId, now = Date.now() } = {}) => {
    const quests = getModel(conn, 'Quest').collection;
    const readingLog = getModel(conn, 'ReadingLog').collection;
    const rng = rngFrom(String(userId));
    const pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    const today = dayIn(tz, new Date(now));

    const series = await quests.find({ deletedAt: null })
        .project({ title: 1, status: 1, currentChapter: 1, lastRead: 1, conqueredAt: 1 }).toArray();
    if (!series.length) return { entries: 0 };

    // 1. Dates: shift so the newest "last read" is now, keeping the template's spacing.
    const newest = Math.max(...series.map((q) => (Number.isFinite(q.lastRead) ? q.lastRead : 0)));
    const shift = newest > 0 ? now - newest : 0;
    for (const q of series) {
        q.baseLastRead = Number.isFinite(q.lastRead) && q.lastRead > 0 ? q.lastRead + shift : now;
        q.daysAgo = Math.max(0, Math.floor((now - q.baseLastRead) / DAY_MS));
        const status = String(q.status || '').toUpperCase();
        const reading = status === 'ACTIVE' || status === 'CONQUERED' || status === 'STASIS';
        q.lastIdx = status === 'STASIS' ? Math.max(q.daysAgo, PAUSED_FROM) : Math.max(1, q.daysAgo);
        q.reads = reading && (q.currentChapter || 0) > 0 && q.lastIdx <= WINDOW_DAYS;
        q.sessions = [];
        q.used = 0;
    }

    // 2. Which days had reading: the last `streak` days all did, the day before none, the
    // rest of the window about half.
    const streak = pick(8, 12);
    const readingDay = (i) => i <= streak || (i !== streak + 1 && rng() < 0.55);
    for (let i = WINDOW_DAYS; i >= 1; i--) {
        if (!readingDay(i)) continue;
        // Open: still being read at this point (on or before its last day), with chapters to
        // spare; a short series reads only on its last day.
        const open = series.filter((q) => q.reads && i >= q.lastIdx && q.used < q.currentChapter
            && (q.currentChapter >= SMALL_SERIES || i === q.lastIdx));
        if (!open.length) continue;
        const due = open.filter((q) => q.lastIdx === i);                  // its last day
        const others = open.filter((q) => q.lastIdx !== i).sort(() => rng() - 0.5);
        const readers = [...due, ...others.slice(0, Math.max(due.length ? 0 : 1, pick(0, 2)))];
        let room = DAILY_CAP;
        for (const q of readers) {
            const n = Math.min(pick(1, 3), room, q.currentChapter - q.used);
            if (n <= 0) continue;
            q.sessions.push({ i, n });
            q.used += n;
            room -= n;
        }
    }

    // 3. Entries: each series' sessions run up to its current chapter (q.used never exceeds
    // it, so every session is kept).
    const entries = [];
    const updates = [];
    for (const q of series) {
        q.sessions.sort((a, b) => b.i - a.i);                          // oldest first
        let at = q.currentChapter - q.used;
        const times = [];
        for (const { i, n } of q.sessions) {
            const day = shiftDay(today, -i);
            const when = zonedTime(day, pick(19, 22), pick(0, 59), tz);
            entries.push({ questId: q._id, title: q.title, from: at, to: at + n, delta: n, day, at: when });
            times.push(when.getTime());
            at += n;
        }
        const set = {};
        if (times.length) {
            set.lastRead = times[times.length - 1];
            set.createdAt = new Date(times[0] - pick(3, 20) * DAY_MS);
            if (String(q.status).toUpperCase() === 'CONQUERED') set.conqueredAt = new Date(set.lastRead);
        } else {
            set.lastRead = q.baseLastRead;
            set.createdAt = new Date(q.baseLastRead - pick(5, 30) * DAY_MS);
            if (q.conqueredAt) set.conqueredAt = new Date(new Date(q.conqueredAt).getTime() + shift);
        }
        updates.push({ updateOne: { filter: { _id: q._id }, update: { $set: set } } });
    }

    if (updates.length) await quests.bulkWrite(updates, { ordered: false });
    if (entries.length) await readingLog.insertMany(entries, { ordered: false });

    // 4. The live streak: read every day up to yesterday. Only when there is a log behind it.
    const readDays = new Set(entries.map((e) => e.day));
    let run = 0;
    while (readDays.has(shiftDay(today, -(run + 1)))) run++;
    if (run > 0 && userId) {
        await getModel(conn, 'UserSettings').updateOne(
            { userId },
            { $set: { streak: run, lastReadDate: shiftDay(today, -1) } },
            { upsert: true }
        );
    }
    return { entries: entries.length, days: readDays.size, streak: run };
};

module.exports = { seedGuestHistory };
