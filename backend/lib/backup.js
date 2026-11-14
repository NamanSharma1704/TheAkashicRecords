/* The full backup: its path, format, limits and record shapes. (Split out of index.js, 2026-11-13.) */

// Cap the body size. Nothing this API accepts is large, and the default 100kb is more
// room than any quest payload needs. The one exception is restoring a full backup
// (synopses and the reading log), which parses its own body, after authentication, with
// a larger cap; the 64kb parser would otherwise refuse it before the route ever ran.
const BACKUP_PATH = '/api/backup';

// ─── FULL BACKUP ──────────────────────────────────────────────────────────────

const BACKUP_FORMAT = 'akashic-records-backup';

const BACKUP_VERSION = 1;

const MAX_BACKUP_QUESTS = 5000;

const MAX_BACKUP_LOG = 100000;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One record as the backup writes it: the fields a reader knows, in one fixed order, then any
 * other field the record carries (fields from older builds included), so nothing is dropped.
 * Only the server's own lookup bookkeeping is left out (normalizedTitle, chaptersCheckedAt,
 * coverCheckedAt, __v): it is rebuilt by itself. lastRead is stored as epoch milliseconds and
 * written as a date anyone can read; a restore takes either form.
 */
const BACKUP_QUEST_FIELDS = ['_id', 'title', 'status', 'classType', 'currentChapter', 'totalChapters', 'rating',
    'readLink', 'cover', 'synopsis', 'lastRead', 'newChapters', 'chaptersUpdatedAt', 'conqueredAt', 'deletedAt',
    'createdAt', 'updatedAt'];

const backupQuest = (q) => {
    const out = {};
    for (const k of BACKUP_QUEST_FIELDS) if (k in q) out[k] = q[k];
    for (const [k, val] of Object.entries(q)) if (!(k in out)) out[k] = val;
    if (typeof out.lastRead === 'number' && Number.isFinite(out.lastRead) && out.lastRead > 0) {
        out.lastRead = new Date(out.lastRead).toISOString();
    }
    return out;
};

/**
 * A record from a backup file, made ready for validateQuest. A null field counts as absent:
 * older exports wrote nulls (a missing cover, say) that the write rules refuse as "not text",
 * and the whole record was skipped for it. A rating from the February build's 0-10 scale is
 * rounded to the whole number the appraisal takes (below a half, it was unrated).
 */
const backupRecordIn = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const r = Object.fromEntries(Object.entries(raw).filter(([, val]) => val !== null));
    if (typeof r.rating === 'number' && !Number.isInteger(r.rating)) {
        if (r.rating >= 0.5) r.rating = Math.min(10, Math.round(r.rating));
        else delete r.rating;
    }
    return r;
};

const upperOf = (s) => (typeof s === 'string' ? s.trim().toUpperCase() : undefined);

const BACKUP_SETTINGS_FIELDS = ['streak', 'lastReadDate', 'dailyGoalKind', 'dailyGoalTarget', 'weeklyGoalTarget',
    'equippedTitle', 'questOrder'];

module.exports = { BACKUP_PATH, BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_QUESTS, MAX_BACKUP_LOG, DAY_RE, BACKUP_QUEST_FIELDS, backupQuest, backupRecordIn, upperOf, BACKUP_SETTINGS_FIELDS };
