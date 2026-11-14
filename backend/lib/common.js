/* Small shared helpers: errors, ids, the live-record filter, secrets, limits. (Split out of index.js, 2026-11-13.) */

const mongoose = require('mongoose');
const crypto = require('crypto');

// ─── SECURITY HELPERS ─────────────────────────────────────────────────────────

/**
 * Sanitize error messages for production responses.
 * Never leak raw DB/stack trace details to the client.
 */
const sendError = (res, status, publicMessage, internalErr = null) => {
    if (internalErr) console.error(`[ERROR ${status}]`, internalErr.message || internalErr);
    return res.status(status).json({ message: publicMessage });
};

/**
 * Escape regex special characters to prevent ReDoS / injection.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The library filter. Quests are soft-deleted (deletedAt set) so a delete can be undone;
 * every read of the library goes through this. `null` also matches documents written
 * before the field existed.
 */
const LIVE = Object.freeze({ deletedAt: null });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How long the Trash keeps a deleted quest before it is purged for good. */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** A route id that is not an ObjectId cannot name a quest: answer 404, not a cast error. */
const isQuestId = (id) => mongoose.isValidObjectId(id);

/**
 * Check a supplied admin secret in constant time. A plain `!==` returns as soon as a
 * character differs, which leaks how much of a guess was right through response timing.
 * Both sides are hashed first so timingSafeEqual always compares equal-length buffers.
 */
const secretMatches = (provided) => {
    const expected = process.env.SYSTEM_ADMIN_SECRET;
    if (!expected || typeof provided !== 'string' || !provided) return false;
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
};

/** Most records a guest sandbox may hold, Trash included. The owner's archive has no cap. */
const GUEST_RECORD_CAP = 500;

module.exports = { sendError, escapeRegex, LIVE, sleep, TRASH_RETENTION_MS, isQuestId, secretMatches, GUEST_RECORD_CAP };
