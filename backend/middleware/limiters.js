/* Rate limits. One instance each, shared by every route that uses it. (Split out of index.js, 2026-11-13.) */

const rateLimit = require('express-rate-limit');

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP. Protocol throttled.' }
});

// Password guessing gets a much tighter ceiling than the rest of the auth surface.
// There is exactly one real account, so a legitimate human never approaches 10 attempts
// in a quarter hour, while an online brute force is reduced to a crawl.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed attempts count against the budget
    message: { message: 'Too many failed attempts. Protocol throttled.' }
});

// Guest provisioning creates a database per call, so it gets its own ceiling. A visitor
// arriving from the portfolio clicks it once; 10 an hour leaves generous headroom for
// retries and shared IPs while removing the unbounded-provisioning vector.
const guestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Guest capacity reached for now. Please try again shortly.' }
});

// The image proxy is reachable without a token (browsers cannot attach an Authorization
// header to an <img> tag), so it gets its own ceiling. Sized for real library browsing —
// a full Spire scroll is well under this — while capping bulk abuse.
const imageProxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Image relay saturated. Protocol throttled.' }
});

// "Check for new chapters" fans out to MangaDex and AniList for a dozen titles per call.
const chapterSyncLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Chapter checks are limited to a few an hour. Try again later.' }
});

// Writes to a library. Guest sessions are free to start (10 an hour per address), and each
// sandbox lives on the shared cluster, so a guest's writes get a ceiling: far above a real
// reading session (a chapter burst is one save per 600ms merge window) but well below a
// script. Keyed per account, so it runs after authenticate. The owner's re-verified account
// is exempt: importing a whole library is a few hundred writes in a row.
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user._id}`,
    skip: (req) => req.user?.role === 'SOVEREIGN',
    message: { message: 'Too many changes in a short time. Wait a few minutes and try again.' }
});

// ─── LIST IMPORT (AniList, MyAnimeList) ───────────────────────────────────────
// Read-only lookups: they answer with rows shaped for the client's import pipeline, which
// merges them by title (and alias) like a CSV, so nothing is written here.
const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user._id}`,
    message: { message: 'Too many list imports in a short time. Try again in a few minutes.' }
});

// Each call can fan out to three public APIs per title, hence its own limiter.
const coverBackfillLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Cover searches are limited to a few an hour. Try again later.' }
});

module.exports = { authLimiter, loginLimiter, guestLimiter, imageProxyLimiter, chapterSyncLimiter, writeLimiter, importLimiter, coverBackfillLimiter };
