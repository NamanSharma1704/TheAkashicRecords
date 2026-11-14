/* RELEASE RADAR (2026-11-14): when a series usually releases, worked out from the days it did. */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Release days kept per series (newest first). */
const MAX_RELEASE_DAYS = 40;
/** A series' release days are fetched from its source again after this. */
const RADAR_REFRESH_MS = DAY_MS;

const utcOf = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const daysBetween = (later, earlier) => Math.round((utcOf(later) - utcOf(earlier)) / DAY_MS);
const addDays = (day, n) => dayOf(utcOf(day) + n * DAY_MS);
const weekdayOf = (day) => new Date(utcOf(day)).getUTCDay();

/** Distinct release days, newest first, at most MAX_RELEASE_DAYS. */
const mergeDays = (...lists) => [...new Set(lists.flat().filter((d) => typeof d === 'string' && DAY_RE.test(d)))]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, MAX_RELEASE_DAYS);

/**
 * The cadence of a series from its release days (newest first) as of `today` (the reader's own
 * day). Honest by construction: it only reads what was recorded, and says so when that is not
 * enough. Days within SAME_RELEASE_DAYS of each other count as one release (several groups,
 * or the official site and a group, a day or two apart), dated by its first day.
 *
 *   LEARNING   fewer than 3 release days known                   { seen, lastDay }
 *   BREAK      nothing for more than 3 cadences (and 30 days)    { lastDay, sinceLast }
 *   WEEKLY     a week apart, mostly on one weekday               { weekday (0 = Sunday), nextDay }
 *   EVERY      a steady interval other than a week               { everyDays, nextDay }
 *              (both with `overdue` once two releases in a row have not come; not yet a BREAK)
 *   IRREGULAR  no pattern worth a prediction                     { lastDay }
 */
/** Days within this many of each other are one release (groups, or the official site, a day or two apart). */
const SAME_RELEASE_DAYS = 2;

/** One release per cluster of nearby days, dated by its first day, newest first. */
const releasesOf = (days) => {
    const out = [];
    let newest = null; // the cluster is bounded by its newest day, so a daily series never chains into one
    for (const d of days) {
        if (newest && daysBetween(newest, d) <= SAME_RELEASE_DAYS) out[out.length - 1] = d; // the same release, seen earlier
        else { out.push(d); newest = d; }
    }
    return out;
};

const cadenceOf = (rawDays, today) => {
    const all = mergeDays(rawDays);
    const lastDay = all[0] || null;

    // Daily first, from the raw days: folding nearby days together would read it as every 3.
    if (all.length >= 5) {
        const raw = all.slice(0, 10);
        const gaps = raw.slice(0, -1).map((d, i) => daysBetween(d, raw[i + 1]));
        if (gaps.filter((g) => g <= 1).length / gaps.length >= 0.7) {
            const sinceLast = daysBetween(today, lastDay);
            if (sinceLast > 30) return { status: 'BREAK', seen: all.length, lastDay, sinceLast };
            const next = sinceLast >= 1 ? today : addDays(lastDay, 1);
            return { status: 'EVERY', seen: all.length, lastDay, everyDays: 1, nextDay: next, sinceLast, overdue: sinceLast > 3 };
        }
    }

    const days = releasesOf(all);
    const seen = days.length;
    if (seen < 3) return { status: 'LEARNING', seen, lastDay };

    const recent = days.slice(0, 10);
    const intervals = recent.slice(0, -1).map((d, i) => daysBetween(d, recent[i + 1]));
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const sinceLast = daysBetween(today, lastDay);
    if (sinceLast > Math.max(3 * median, 30)) return { status: 'BREAK', seen, lastDay, sinceLast };

    const window = recent.slice(0, 8);
    const counts = new Map();
    window.forEach((d) => counts.set(weekdayOf(d), (counts.get(weekdayOf(d)) || 0) + 1));
    const [weekday, top] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (median >= 6 && median <= 8 && top / window.length >= 0.6) {
        // The first `weekday` after the last release, then on by weeks until it is not past.
        let next = addDays(lastDay, ((weekday - weekdayOf(lastDay) + 7) % 7) || 7);
        while (next < today) next = addDays(next, 7);
        return { status: 'WEEKLY', seen, lastDay, weekday, nextDay: next, sinceLast, overdue: sinceLast > 14 };
    }

    const steady = intervals.filter((x) => Math.abs(x - median) <= 1).length / intervals.length;
    if (median >= 2 && steady >= 0.6) {
        let next = addDays(days[0], median);
        while (next < today) next = addDays(next, median);
        return { status: 'EVERY', seen, lastDay, everyDays: median, nextDay: next, sinceLast, overdue: sinceLast > 2 * median };
    }
    return { status: 'IRREGULAR', seen, lastDay };
};

module.exports = { MAX_RELEASE_DAYS, RADAR_REFRESH_MS, mergeDays, cadenceOf, dayOf };
