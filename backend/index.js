const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { connectDB, getTenantDb } = require('./config/db');
const { initDatabase } = require('./config/init');
const { getModel } = require('./models/modelFactory');
const { normalizeTitle } = require('./utils/normalizeTitle');
const { fetchAniList, fetchMangaDex, fetchJikan, fetchBest, fetchGenresOnly, fetchLatestChapter } = require('./utils/metadataProxy');
const crypto = require('crypto');
const User = require('./models/User');
const MetadataCache = require('./models/MetadataCache');
const {
    hashPassword, comparePassword, generateToken, verifyToken,
    getTokenTtlMs, setAuthCookie, clearAuthCookie, readAuthCookie
} = require('./utils/auth');
const { DOCUMENT_CSP, API_CSP } = require('./utils/securityHeaders');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

/**
 * Per-request detail (timings, lookups, metadata fallbacks). Printed in development, or in
 * production with LOG_LEVEL=debug. It used to print on every request in production too,
 * login usernames included, filling the platform log with noise and personal data.
 * Warnings, errors and the reaper/admin summaries still use console directly.
 */
const debugLog = (...args) => {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') console.log(...args);
};

// Vercel terminates TLS and forwards through exactly one proxy hop. Without this,
// req.ip is the proxy's address for every caller and the rate limiter below shares
// a single bucket across all clients. A numeric hop count (rather than `true`) keeps
// express-rate-limit's permissive-trust-proxy validator satisfied.
app.set('trust proxy', 1);

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

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
// Applied by the app so they hold in local development and under any host. On Vercel the
// SPA shell is served from the CDN and never reaches this middleware, which is why
// vercel.json carries a matching set for static routes.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // The API gets the locked-down policy; anything else is the SPA shell and needs the
    // document policy. Applying the API policy to the document would block its own
    // stylesheet, favicon and bundle.
    res.setHeader('Content-Security-Policy', req.path.startsWith('/api') ? API_CSP : DOCUMENT_CSP);
    next();
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://the-akashic-records.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow same-origin/server-to-server (no Origin header) and known origins.
        //
        // An unknown origin is refused by declining to emit the CORS headers, NOT by
        // raising. Throwing here surfaced as a 500 on every request from that origin —
        // including the SPA's own document and assets when served by this app — and the
        // error path bypassed the header middleware above. Declining leaves the browser
        // to block the cross-origin read, which is the actual intent.
        callback(null, !origin || ALLOWED_ORIGINS.includes(origin));
    },
    credentials: true
}));

// Cap the body size. Nothing this API accepts is large, and the default 100kb is more
// room than any quest payload needs. The one exception is restoring a full backup
// (synopses and the reading log), which parses its own body, after authentication, with
// a larger cap; the 64kb parser would otherwise refuse it before the route ever ran.
const BACKUP_PATH = '/api/backup';
const jsonBody = express.json({ limit: '64kb' });
app.use((req, res, next) => (req.method === 'POST' && req.path === BACKUP_PATH ? next() : jsonBody(req, res, next)));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP. Protocol throttled.' }
});

// Apply rate limit to all auth routes
app.use('/api/auth', authLimiter);

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
app.use('/api/auth/login', loginLimiter);

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
app.use('/api/auth/guest', guestLimiter);

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
app.use('/api/proxy/image', imageProxyLimiter);

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

/** Most records a guest sandbox may hold, Trash included. The owner's archive has no cap. */
const GUEST_RECORD_CAP = 500;

// ─── SSRF BLOCKLIST (Permissive for Public Images) ───────────────────────────
const isInternalHostname = (hostname) => {
    // Blocks localhost, private network spaces (10.x, 192.168.x, 172.16-31.x), loopback, metadata IPs, and local domains
    const internalRegex = /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|::1|.*\.local|.*\.internal)$/i;
    return internalRegex.test(hostname);
};

// --- AUTH MIDDLEWARE ---

/**
 * Resiliently purges a guest sandbox.
 * Tries to drop the database, falls back to wiping collections if permissions are missing.
 */
const resilientPurge = async (dbConn, dbName) => {
    try {
        await dbConn.dropDatabase();
        console.log(`[PURGE] Successfully dropped database: ${dbName}`);
    } catch (err) {
        // Handle common permission errors (Atlas Error 8000 / not allowed)
        if (err.message.includes('not allowed') || err.code === 8000) {
            console.warn(`[PURGE] PERMISSION_DENIED: Cannot drop database shell for [${dbName}].`);
            console.warn(`[PURGE] FALLBACK: Wiping content only. Grant 'dbAdmin' roles for full shell removal.`);
            
            try {
                // Use native driver to bypass model collision issues
                await dbConn.db.collection('manhwas').deleteMany({});
                console.log(`[PURGE] Fallback Success: Wiped clinical data in ${dbName}`);
            } catch (wipeErr) {
                console.error(`[PURGE] Fallback Failure in [${dbName}]:`, wipeErr.message);
            }
        } else {
            console.error(`[PURGE] Critical Failure in [${dbName}]:`, err.message);
        }
    }
};

const authenticate = async (req, res, next) => {
    // The httpOnly cookie is the browser's path. The Bearer header stays supported for
    // local scripts and curl — a browser never attaches it automatically, so it carries
    // no CSRF exposure of its own.
    let token = readAuthCookie(req);
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Authentication Protocol Terminated: No Token Provided.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        clearAuthCookie(res);
        return res.status(401).json({ message: 'Authentication Protocol Terminated: Invalid Token.' });
    }

    try {
        req.user = {
            _id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };

        // --- SOVEREIGN RE-VERIFICATION ---
        // SOVEREIGN is the only role that reaches the live archive, so its claim is
        // re-read from the database rather than trusted from the token. Guests keep the
        // zero-lookup path: their tenant is a disposable sandbox keyed to their own id,
        // so a forged guest claim grants access to nothing but an empty database.
        if (req.user.role === 'SOVEREIGN') {
            await connectDB();
            const dbUser = await User.findById(decoded.id).select('role passwordChangedAt');

            if (!dbUser || dbUser.role !== 'SOVEREIGN') {
                clearAuthCookie(res);
                return res.status(401).json({ message: 'Authentication Protocol Terminated: Authority Revoked.' });
            }

            // A password change invalidates every session issued before it.
            if (dbUser.passwordChangedAt && decoded.iat * 1000 < dbUser.passwordChangedAt.getTime()) {
                clearAuthCookie(res);
                return res.status(401).json({ message: 'Authentication Protocol Terminated: Session Superseded.' });
            }
        }

        // --- MULTI-TENANCY LOGIC ---
        // SOVEREIGN -> akashic_records, GUEST -> gsb_<id>
        const dbName = req.user.role === 'SOVEREIGN' ? 'akashic_records' : `gsb_${req.user._id}`;
        req.dbConn = await getTenantDb(dbName);

        next();
    } catch (err) {
        console.error('[Auth Error]', err.message);
        res.status(500).json({ message: 'Authentication System Fault: Internal Link Severed.' });
    }
};

const checkRole = (role) => (req, res, next) => {
    if (req.user.role !== role) {
        return res.status(403).json({ message: `Forbidden: ${role} authority required.` });
    }
    next();
};

// --- DIAGNOSTICS ---
app.get('/api/health', async (req, res) => {
    try {
        const conn = await connectDB();
        const dbStatus = conn.readyState;
        const statusMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        const body = {
            status: 'Pulse Active',
            database: statusMap[dbStatus] || 'unknown',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        };
        // The probe is public (the uptime workflow pings it), so the size of the owner's
        // library is reported only to a caller holding the admin secret.
        if (secretMatches(req.headers['x-system-secret'])) {
            body.documentCount = await getModel(conn, 'Quest').countDocuments(LIVE);
        }
        res.json(body);
    } catch (err) {
        return sendError(res, 500, 'Health probe failed: archive link unavailable.', err);
    }
});

// --- AUTH ROUTES ---

// POST /api/auth/upsert-sovereign - Administrative Identity Sync (Internal)
app.post('/api/auth/upsert-sovereign', async (req, res) => {
    try {
        const { systemSecret, username, password } = req.body || {};
        if (!secretMatches(systemSecret)) {
            return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
        }
        if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ message: 'A username and a password of at least 8 characters are required.' });
        }

        await connectDB();
        const passwordHash = await hashPassword(password);

        const user = await User.findOneAndUpdate(
            { username },
            {
                username,
                passwordHash,
                role: 'SOVEREIGN',
                // Rotating the Sovereign password through this route also retires any
                // session that was already outstanding.
                passwordChangedAt: new Date(Date.now() - 1000)
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ message: 'Sovereign Identity Synchronized.', username: user.username });
    } catch (err) {
        return sendError(res, 500, 'Sovereign synchronization failed.', err);
    }
});

// POST /api/auth/login - Synchronize Hunter Identity
app.post('/api/auth/login', async (req, res) => {
    try {
        await connectDB();
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        debugLog(`[AUTH] Login attempt: "${username}"`);

        // Escape regex special chars to prevent ReDoS / injection
        const safeUsername = escapeRegex(username.trim());
        const user = await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } });
        if (!user) {
            // Generic message — don't reveal whether user exists
            return res.status(401).json({ message: 'Access Denied: Invalid credentials.' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Invalid credentials.' });

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        const token = generateToken(user);
        setAuthCookie(res, token, user.role);
        res.json({
            user: { id: user._id, username: user.username, role: user.role },
            expiresAt: Date.now() + getTokenTtlMs(user.role)
        });
    } catch (err) {
        return sendError(res, 500, 'Authentication system fault. Please try again.', err);
    }
});

// ─── GUEST SANDBOX CAPACITY ───────────────────────────────────────────────────
// Guest mode is a public portfolio demo and must stay frictionless, so these bounds are
// set well above real demand: they exist to cap a flood, not to gate a visitor.
const SANDBOX_SOFT_THRESHOLD = 25; // reap opportunistically from here
const SANDBOX_HARD_CAP = 60;       // refuse new sandboxes beyond this

/**
 * Count live guest sandboxes. Returns null if the cluster will not report them, in which
 * case the caller proceeds without a cap — a demo visitor is never blocked by the
 * bookkeeping failing.
 */
const countGuestSandboxes = async () => {
    try {
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        return databases.filter(d => d.name.startsWith('gsb_')).length;
    } catch (err) {
        console.warn('[GUEST_INIT] Sandbox census unavailable, proceeding uncapped:', err.message);
        return null;
    }
};

// POST /api/auth/guest - Access Sandbox Environment (Cloned from test_records)
app.post('/api/auth/guest', async (req, res) => {
    try {
        await connectDB();

        // Clear out expired sandboxes before counting, so a visitor is only ever turned
        // away by genuinely concurrent demand rather than by accumulated debris.
        let sandboxCount = await countGuestSandboxes();
        if (sandboxCount !== null && sandboxCount >= SANDBOX_SOFT_THRESHOLD) {
            console.log(`[GUEST_INIT] ${sandboxCount} sandboxes live; running an opportunistic reap.`);
            try {
                await purgeStaleSandboxes();
                sandboxCount = await countGuestSandboxes();
            } catch (reapErr) {
                console.warn('[GUEST_INIT] Opportunistic reap failed:', reapErr.message);
            }
        }

        if (sandboxCount !== null && sandboxCount >= SANDBOX_HARD_CAP) {
            console.warn(`[GUEST_INIT] Hard cap reached (${sandboxCount}). Refusing new sandbox.`);
            return res.status(503).json({
                message: 'Demo capacity is full right now. Please try again in a few minutes.'
            });
        }

        // Use timestamp in guestId to allow the Reaper to track session age
        const guestId = `g_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const guestUser = {
            _id: guestId,
            username: `G_${guestId.slice(-4).toUpperCase()}`,
            role: 'GUEST'
        };

        // --- SANDBOX INITIALIZATION ---
        // Every guest gets a fresh copy of the 'test_records' database.
        const sandboxConn = await getTenantDb(`gsb_${guestId}`);
        const templateConn = await getTenantDb('test_records');

        // Populate the sandbox immediately
        await initDatabase(() => sandboxConn, templateConn);

        const token = generateToken(guestUser);
        setAuthCookie(res, token, guestUser.role);
        res.json({
            user: { id: guestUser._id, username: guestUser.username, role: guestUser.role },
            expiresAt: Date.now() + getTokenTtlMs(guestUser.role)
        });
    } catch (err) {
        console.error('[GUEST_INIT] Failure:', err.message);
        res.status(500).json({ message: 'Sandbox Initialization Fault: Connection to archives severed.' });
    }
});

// POST /api/auth/logout - Terminate Session and Purge Sandbox
app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'GUEST') {
            console.log(`[AUTH] Purging sandbox for guest: ${req.user._id}`);
            await resilientPurge(req.dbConn, `gsb_${req.user._id}`);
        }
        clearAuthCookie(res);
        res.json({ message: 'Identity Purged.' });
    } catch (err) {
        console.error('[AUTH] Logout Failure:', err.message);
        // Drop the session even if the sandbox purge failed — a stuck sandbox is the
        // reaper's problem, but a session that survives logout is a security problem.
        clearAuthCookie(res);
        return sendError(res, 500, 'Purge protocol failed.', err);
    }
});

// PUT /api/auth/update - Update Hunter Credentials
app.put('/api/auth/update', authenticate, async (req, res) => {
    try {
        await connectDB();
        const { newUsername, currentPassword, newPassword } = req.body || {};

        // A guest has no stored credentials, and its id is not an ObjectId: findById below
        // threw a CastError and answered 500.
        if (req.user.role !== 'SOVEREIGN') {
            return res.status(403).json({ message: 'Guest sessions have no credentials to change.' });
        }
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({ message: 'Current password is required to update credentials.' });
        }
        if (newUsername !== undefined && typeof newUsername !== 'string') {
            return res.status(400).json({ message: 'Username must be text.' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'Hunter identity not found in Akashic Records.' });

        const isMatch = await comparePassword(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Current password is incorrect.' });

        if (newUsername && newUsername.trim() !== user.username) {
            // Escaped like every other username lookup here. Unescaped, the name was read as a
            // pattern: "a(" threw (a 500) and "." matched any one-character name.
            const taken = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(newUsername.trim())}$`, 'i') } });
            if (taken) return res.status(409).json({ message: 'Archive Collision: Username already taken.' });
            user.username = newUsername.trim();
        }

        if (newPassword) {
            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters.' });
            }
            user.passwordHash = await hashPassword(newPassword);
            // Retires every session issued before this instant, on every other device.
            // Backdated one second because a JWT's `iat` is floored to whole seconds —
            // without the slack, the replacement token issued below would fail its own
            // freshness check and log the caller straight back out.
            user.passwordChangedAt = new Date(Date.now() - 1000);
        }

        await user.save();

        // Issue the replacement session so the caller's own device stays signed in.
        const token = generateToken(user);
        setAuthCookie(res, token, user.role);
        res.json({
            user: { id: user._id, username: user.username, role: user.role },
            expiresAt: Date.now() + getTokenTtlMs(user.role)
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to update hunter credentials.', err);
    }
});

// GET /api/boot/initial-data - Batched fetch for instant loading
app.get('/api/boot/initial-data', authenticate, async (req, res) => {
    const start = Date.now();
    try {
        debugLog(`[PERF] Initial Data Batch Request Start: ${req.user.username}`);

        const Quest = getModel(req.dbConn, 'Quest');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = todayFor(req);

        // parallel fetch for absolute speed. The two singletons are fetched-or-created
        // atomically (see ensureUserSettings), so a first visit needs no follow-up writes.
        const [quests, settings, daily] = await Promise.all([
            // No synopses in the boot payload: they are the bulk of every record and only the
            // detail view and the editor show one, so each fetches its own (GET /api/quests/:id).
            Quest.find(LIVE).sort({ lastRead: -1 }).select('-synopsis'),
            ensureUserSettings(UserSettings, req.user._id),
            ensureDailyQuest(DailyQuest, today),
            // Trash retention, enforced here because every session boots through this route
            // (and a serverless deployment has no long-running process to schedule it on).
            // Indexed on deletedAt, so a library with nothing expired costs one index probe.
            Quest.deleteMany({ deletedAt: { $lt: new Date(Date.now() - TRASH_RETENTION_MS) } })
        ]);

        debugLog(`[PERF] Initial parallel fetch complete: ${Date.now() - start}ms`);

        // Quests seeding
        if (quests.length === 0 && req.user.role === 'GUEST') {
            await initDatabase(() => req.dbConn);
            debugLog(`[PERF] Followup completions in: ${Date.now() - start}ms`);
        }

        res.json({
            quests,
            userState: {
                streak: liveStreak(settings, today),
                lastReadDate: settings?.lastReadDate || null,
                dailyAbsorbed: daily?.absorbedIds.length || 0,
                absorbedIds: daily?.absorbedIds || []
            }
        });

        debugLog(`[PERF] Total Initial Data Duration: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[PERF] Initial Data Failure (${Date.now() - start}ms):`, err.message);
        return sendError(res, 500, 'Failed to load initial archive data.', err);
    }
});

// --- ROUTES ---

// GET /api/user/state - Fetch streak and daily absorb
app.get('/api/user/state', authenticate, async (req, res) => {
    const start = Date.now();
    try {
        debugLog(`[PERF] User State Request Start: ${req.user.username}`);
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = todayFor(req);

        // Parallel fetch-or-create; atomic, so concurrent first requests cannot collide.
        const [settings, daily] = await Promise.all([
            ensureUserSettings(UserSettings, req.user._id),
            ensureDailyQuest(DailyQuest, today)
        ]);

        debugLog(`[PERF] Initial fetch complete: ${Date.now() - start}ms`);

        res.json({
            streak: liveStreak(settings, today),
            lastReadDate: settings.lastReadDate,
            dailyAbsorbed: daily.absorbedIds.length,
            absorbedIds: daily.absorbedIds
        });
        debugLog(`[PERF] Total User State Duration: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[PERF] User State Failure (${Date.now() - start}ms):`, err.message);
        return sendError(res, 500, 'Failed to load hunter state.', err);
    }
});

// GET /api/stats - Reading activity from the reading log, in the reader's own days.
//
// Each log entry is a signed chapter change, so a day's sum is the net chapters read: an Undo
// or a correction cancels out rather than counting twice. Streaks here are runs of days with
// net reading > 0. (The live streak in UserSettings counts any day with a forward move, so a
// day you entirely undid still extends that one; this one is the stricter record.)
app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const ReadingLog = getModel(req.dbConn, 'ReadingLog');
        const today = todayFor(req);
        const since = shiftDay(today, -370); // a year of weeks, with room to align to Sunday

        const rows = await ReadingLog.aggregate([
            { $match: { day: { $gte: since } } },
            { $group: { _id: '$day', chapters: { $sum: '$delta' } } },
            { $sort: { _id: 1 } }
        ]);
        const days = rows.filter(r => r.chapters > 0).map(r => ({ day: r._id, chapters: r.chapters }));
        const byDay = new Map(days.map(d => [d.day, d.chapters]));

        const sumDays = (from, to) => {
            let total = 0;
            for (let d = from; d <= to; d = shiftDay(d, 1)) total += byDay.get(d) || 0;
            return total;
        };

        let longestStreak = 0, run = 0, prev = null;
        for (const { day } of days) {
            run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
            longestStreak = Math.max(longestStreak, run);
            prev = day;
        }
        // A streak still counts today if you read yesterday and have not read yet today.
        let currentStreak = 0;
        for (let d = byDay.has(today) ? today : shiftDay(today, -1); byDay.get(d) > 0; d = shiftDay(d, -1)) currentStreak++;

        res.json({
            today,
            days,
            thisWeek: sumDays(shiftDay(today, -6), today),
            lastWeek: sumDays(shiftDay(today, -13), shiftDay(today, -7)),
            currentStreak,
            longestStreak,
            daysRead: days.length,
            chaptersThisYear: days.reduce((sum, d) => sum + d.chapters, 0)
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to read reading stats.', err);
    }
});

// GET /api/quests - Fetch all quests
app.get('/api/quests', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        // Synopses only on request (?full=1); see /api/boot/initial-data.
        const fields = req.query.full === '1' ? '' : '-synopsis';
        let quests = await Quest.find(LIVE).sort({ lastRead: -1 }).select(fields);

        debugLog(`[API] Quests requested by ${req.user.username}. Found: ${quests.length} documents.`);

        // Lazy-seed if DB is completely empty (common for Guest or new Sovereign)
        if (quests.length === 0) {
            debugLog('[API] Database empty. Checking lazy seeding condition...');
            // Only seed Guests, let Sovereigns migrate or add their own
            if (req.user.role === 'GUEST') {
                await initDatabase(() => req.dbConn);
                quests = await Quest.find(LIVE).sort({ lastRead: -1 }).select(fields);
            }
        }

        res.json(quests);
    } catch (err) {
        console.error('[API] Error fetching quests:', err.message);
        return sendError(res, 500, 'Failed to retrieve quest records.', err);
    }
});

// Allowed fields for quest creation/update (prevents mass assignment)
const QUEST_ALLOWED_FIELDS = ['title', 'cover', 'synopsis', 'totalChapters', 'currentChapter', 'status', 'classType', 'readLink', 'lastRead'];

const sanitizeQuestBody = (body) => {
    const safe = {};
    QUEST_ALLOWED_FIELDS.forEach(f => {
        if (body[f] !== undefined) safe[f] = body[f];
    });
    return safe;
};

// ─── QUEST VALIDATION ─────────────────────────────────────────────────────────
// The allowlist above decides WHICH fields a client may write; this decides what values.
// Before it, negative chapters, text in number fields, a `javascript:` reading link and any
// status string at all went straight into the database.
const QUEST_STATUSES = ['ACTIVE', 'PLANNED', 'CONQUERED', 'SEVERED'];
const QUEST_CLASSES = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER', 'UNKNOWN'];
const MAX_CHAPTER = 100000;
const MAX_URL = 2048;

const isWebUrl = (s) => {
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Validate and normalise a quest write. `existing` is the stored record on an update, null on
 * a create. Returns { value } (allowlisted, normalised) or { error } (the message for a 400).
 *
 * A status or class the app cannot produce is refused only when it CHANGES: records written by
 * older builds may carry legacy values, and re-saving one untouched must not start failing.
 */
const validateQuest = (raw, existing = null) => {
    const v = sanitizeQuestBody(raw || {});
    const fail = (error) => ({ error });

    if (v.title !== undefined) {
        if (typeof v.title !== 'string' || !v.title.trim()) return fail('A title is required.');
        v.title = v.title.trim();
        if (v.title.length > 300) return fail('The title is too long (300 characters at most).');
    } else if (!existing) {
        return fail('A title is required.');
    }

    for (const f of ['currentChapter', 'totalChapters']) {
        if (v[f] === undefined) continue;
        const n = typeof v[f] === 'string' && v[f].trim() !== '' ? Number(v[f]) : v[f];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_CHAPTER) {
            return fail(`${f} must be a whole number from 0 to ${MAX_CHAPTER}.`);
        }
        v[f] = n;
    }

    for (const f of ['readLink', 'cover']) {
        if (v[f] === undefined) continue;
        if (typeof v[f] !== 'string') return fail(`${f} must be text.`);
        v[f] = v[f].trim();
        if (v[f].length > MAX_URL) return fail(`${f} is too long.`);
        // A cover may still hold the app's own proxy path, as written by older builds.
        const ok = !v[f] || isWebUrl(v[f]) || (f === 'cover' && v[f].startsWith('/api/proxy/image?'));
        if (!ok) return fail(`${f === 'readLink' ? 'The reading link' : 'The cover'} must be an http(s) address.`);
    }

    if (v.synopsis !== undefined) {
        if (typeof v.synopsis !== 'string') return fail('The synopsis must be text.');
        if (v.synopsis.length > 20000) return fail('The synopsis is too long.');
    }

    for (const [f, allowed] of [['status', QUEST_STATUSES], ['classType', QUEST_CLASSES]]) {
        if (v[f] === undefined) continue;
        if (typeof v[f] !== 'string') return fail(`${f} must be text.`);
        v[f] = v[f].trim().toUpperCase();
        if (!allowed.includes(v[f]) && v[f] !== existing?.[f]) {
            return fail(`${f} must be one of: ${allowed.join(', ')}.`);
        }
    }

    if (v.lastRead !== undefined) {
        const n = Number(v.lastRead);
        if (Number.isFinite(n) && n > 0) v.lastRead = n;
        else delete v.lastRead;
    }

    // The total never sits below the chapter you are on. A chapter past a known total raises
    // it (you read it, so it exists), which is the app's own rule for a typed chapter too.
    const current = v.currentChapter ?? existing?.currentChapter ?? 0;
    const total = v.totalChapters ?? existing?.totalChapters ?? 0;
    if (total > 0 && current > total) v.totalChapters = current;

    return { value: v };
};

/**
 * A chapter moved forward today: advance the streak and absorb the quest into today's count.
 *
 * Two conditional updates instead of read-modify-save, so two saves landing together cannot
 * both extend the streak: whichever runs first moves lastReadDate to today, and the second
 * one's filters then match nothing.
 */
const recordReading = async (req, questId) => {
    const UserSettings = getModel(req.dbConn, 'UserSettings');
    const DailyQuest = getModel(req.dbConn, 'DailyQuest');
    const today = todayFor(req);
    const yesterday = shiftDay(today, -1);
    const userId = req.user._id;

    await ensureUserSettings(UserSettings, userId);
    const extended = await UserSettings.updateOne(
        { userId, lastReadDate: yesterday },
        { $inc: { streak: 1 }, $set: { lastReadDate: today } }
    );
    if (extended.modifiedCount === 0) {
        await UserSettings.updateOne(
            { userId, lastReadDate: { $nin: [today, yesterday] } },
            { $set: { streak: 1, lastReadDate: today } }
        );
    }
    // $addToSet rather than read-push-save: two chapter saves in quick succession would
    // otherwise each read the old array and the second save drop the first id.
    await DailyQuest.updateOne(
        { date: today },
        { $setOnInsert: { date: today }, $addToSet: { absorbedIds: questId } },
        { upsert: true }
    );
};

app.post('/api/quests', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const { value: safeBody, error } = validateQuest(req.body, null);
        if (error) return res.status(400).json({ message: error });

        if (req.user.role === 'GUEST' && await Quest.estimatedDocumentCount() >= GUEST_RECORD_CAP) {
            return res.status(403).json({ message: `Guest archives hold up to ${GUEST_RECORD_CAP} records.` });
        }

        // 1. DUPLICATE CHECK (ignores punctuation, apostrophes and casing)
        const normalizedTitle = normalizeTitle(safeBody.title);

        // Fast path: a single indexed lookup. This replaced a Quest.find({}) that pulled
        // every document — synopses included — into Node on each create, once per row
        // during a CSV import.
        let collision = await Quest.findOne({ normalizedTitle, ...LIVE }).select('title');

        // Slow path, for documents written before normalizedTitle existed. It is scoped to
        // just those documents and projects only the title, and disappears entirely once
        // backend/scripts/backfill_normalized_titles.js has run.
        if (!collision) {
            const legacy = await Quest
                .find({ $or: [{ normalizedTitle: { $exists: false } }, { normalizedTitle: '' }], ...LIVE })
                .select('title')
                .lean();
            collision = legacy.find(q => normalizeTitle(q.title) === normalizedTitle) || null;
        }

        if (collision) {
            return res.status(409).json({
                message: `Artifact strictly classified as Duplicate. Existing entry detected: "${collision.title}"`
            });
        }

        // 2. Adding a title that sits in the Trash replaces the trashed copy. `title` carries a
        // unique index, so the trashed document would otherwise refuse the insert outright.
        await Quest.deleteMany({
            deletedAt: { $ne: null },
            $or: [{ normalizedTitle }, { title: safeBody.title }]
        });
        const newQuest = new Quest({ ...safeBody, normalizedTitle });
        const savedQuest = await newQuest.save();
        res.status(201).json(savedQuest);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Database Archive Collision: Title already exists in the records." });
        }
        return sendError(res, 400, 'Failed to create quest record.', err);
    }
});

// PUT /api/quests/:id - Update a quest
app.put('/api/quests/:id', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const questId = req.params.id;

        // A missing (or trashed) quest is a 404, settled before anything is counted: this used
        // to bump the streak and absorb the id, then update nothing and answer 200 with null.
        if (!isQuestId(questId)) return res.status(404).json({ message: 'Quest record not found.' });
        const existing = await Quest.findOne({ _id: questId, ...LIVE })
            .select('title currentChapter totalChapters status classType')
            .lean();
        if (!existing) return res.status(404).json({ message: 'Quest record not found.' });

        const { value: body, error } = validateQuest(req.body, existing);
        if (error) return res.status(400).json({ message: error });

        // Keep the duplicate-detection key in step with the title, and refuse a rename onto
        // another record's title (only an exact match used to be caught, by the unique index).
        if (body.title !== undefined) {
            body.normalizedTitle = normalizeTitle(body.title);
            if (body.normalizedTitle !== normalizeTitle(existing.title)) {
                const clash = await Quest
                    .findOne({ _id: { $ne: existing._id }, normalizedTitle: body.normalizedTitle, ...LIVE })
                    .select('title');
                if (clash) return res.status(409).json({ message: `Archive Collision: "${clash.title}" is already in the archive.` });
            }
        }

        const from = existing.currentChapter || 0;
        const to = body.currentChapter;
        const moved = to !== undefined && to !== from;
        // A CSV import (?import=1) replays history; it is not reading done today.
        const imported = req.query.import === '1';
        // Moving past chapters the tracker flagged as new means they are no longer new.
        if (moved && to > from) body.newChapters = 0;

        const updatedQuest = await Quest.findOneAndUpdate(
            { _id: questId, ...LIVE },
            { ...body, lastRead: Date.now() },
            { returnDocument: 'after' }
        );
        if (!updatedQuest) return res.status(404).json({ message: 'Quest record not found.' });

        // Counted only once the write has landed. Reading moves a chapter FORWARD, and only
        // that extends the streak and the day's absorbed titles: this used to fire whenever
        // the body merely contained currentChapter, which the edit form sends on every save
        // (as do the −1 button and the CSV import), so fixing a typo counted as reading today.
        if (moved && !imported) {
            try {
                if (to > from) await recordReading(req, questId);
                // Signed, so a correction nets out of the day's total in the stats.
                await getModel(req.dbConn, 'ReadingLog').create({
                    questId, title: updatedQuest.title, from, to, delta: to - from, day: todayFor(req)
                });
            } catch (statErr) {
                // The chapter is saved; losing a stat must not turn that into an error.
                console.error('[STATS] Reading not recorded:', statErr.message);
            }
        }
        res.json(updatedQuest);
    } catch (err) {
        return sendError(res, 400, 'Failed to update quest record.', err);
    }
});

// DELETE /api/quests/:id - Move a quest to the Trash (soft delete; see LIVE)
app.delete('/api/quests/:id', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const trashed = await Quest.findOneAndUpdate(
            { _id: req.params.id, ...LIVE },
            { deletedAt: new Date() },
            { returnDocument: 'after' }
        ).select('_id deletedAt');
        if (!trashed) return res.status(404).json({ message: 'Quest record not found.' });
        res.json({ message: 'Quest Purged.', id: trashed._id, deletedAt: trashed.deletedAt });
    } catch (err) {
        return sendError(res, 500, 'Failed to purge quest record.', err);
    }
});

// GET /api/quests/trash - What is in the Trash, newest first, with its purge date.
app.get('/api/quests/trash', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const trashed = await Quest.find({ deletedAt: { $ne: null } })
            .sort({ deletedAt: -1 })
            .select('title cover currentChapter totalChapters status classType deletedAt')
            .lean();
        res.json(trashed.map(q => ({ ...q, purgeAt: new Date(new Date(q.deletedAt).getTime() + TRASH_RETENTION_MS) })));
    } catch (err) {
        return sendError(res, 500, 'Failed to read the Trash.', err);
    }
});

// GET /api/quests/:id - One full record, synopsis included (the list omits synopses).
// Declared after /api/quests/trash so "trash" is never taken for an id.
app.get('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const quest = await Quest.findOne({ _id: req.params.id, ...LIVE });
        if (!quest) return res.status(404).json({ message: 'Quest record not found.' });
        res.json(quest);
    } catch (err) {
        return sendError(res, 500, 'Failed to retrieve the quest record.', err);
    }
});

// DELETE /api/quests/:id/permanent - Erase a quest from the Trash now. Only trashed quests:
// a live one has to be deleted (and so be undoable) first.
app.delete('/api/quests/:id/permanent', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const gone = await Quest.findOneAndDelete({ _id: req.params.id, deletedAt: { $ne: null } }).select('_id');
        if (!gone) return res.status(404).json({ message: 'That record is not in the Trash.' });
        res.json({ message: 'Erased.', id: gone._id });
    } catch (err) {
        return sendError(res, 500, 'Failed to erase the record.', err);
    }
});

// POST /api/quests/:id/restore - Bring a quest back out of the Trash (Undo)
app.post('/api/quests/:id/restore', authenticate, writeLimiter, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        if (!isQuestId(req.params.id)) return res.status(404).json({ message: 'Quest record not found.' });
        const trashed = await Quest.findOne({ _id: req.params.id, deletedAt: { $ne: null } }).select('title normalizedTitle');
        if (!trashed) return res.status(404).json({ message: 'Nothing to restore: the record is not in the Trash.' });

        // Restoring must not create a duplicate if the title was added again meanwhile.
        const key = trashed.normalizedTitle || normalizeTitle(trashed.title);
        const clash = await Quest.findOne({ _id: { $ne: trashed._id }, normalizedTitle: key, ...LIVE }).select('title');
        if (clash) {
            return res.status(409).json({ message: `Cannot restore: "${clash.title}" is already in the archive.` });
        }

        const restored = await Quest.findByIdAndUpdate(trashed._id, { deletedAt: null }, { returnDocument: 'after' });
        res.json(restored);
    } catch (err) {
        return sendError(res, 500, 'Failed to restore quest record.', err);
    }
});

// POST /api/admin/bulk-classify — SSE streaming progress
app.post('/api/admin/bulk-classify', authenticate, checkRole('SOVEREIGN'), async (req, res) => {
    // Switch to Server-Sent Events so the client gets live progress per title
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering in prod
    res.flushHeaders();

    const send = (data) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    };

    try {
        const Quest = getModel(req.dbConn, 'Quest');
        console.log("[Admin] Starting Full Metadata-Based SSE Classification...");
        const quests = await Quest.find(LIVE);
        let updated = 0;

        let isAborted = false;
        req.on('close', () => {
            console.log("[Admin] SSE Connection closed. Aborting classification.");
            isAborted = true;
        });

        send({ type: 'start', total: quests.length });

        const BATCH_SIZE = 3;
        for (let i = 0; i < quests.length; i += BATCH_SIZE) {
            if (isAborted) break;

            const batch = quests.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (quest, idx) => {
                const oldClass = quest.classType;
                let newClass = null;
                let changed = false;

                try {
                    const genres = await fetchGenresOnly(quest.title);
                    newClass = classifyBest(quest.title, genres, oldClass);

                    if (genres.length > 0) {
                        debugLog(`[Classify] "${quest.title}" → genres: [${genres.slice(0,4).join(', ')}] → ${newClass}`);
                    } else {
                        debugLog(`[Classify] "${quest.title}" → no metadata, title-only → ${newClass}`);
                    }
                } catch (apiErr) {
                    console.warn(`[Classify] Unexpected error for "${quest.title}": ${apiErr.message}`);
                    newClass = classifyBest(quest.title, []);
                }

                changed = newClass !== oldClass;
                if (changed) {
                    quest.classType = newClass;
                    await quest.save();
                    updated++;
                }

                // Send progress immediately as each item in the batch completes
                send({ type: 'progress', processed: i + idx + 1, total: quests.length, title: quest.title, class: newClass, changed, updated });
            }));

            // Sleep 300ms between batches to stay under MangaDex 5 RPS limit.
            // 31 batches * (400ms API + 300ms sleep) = ~22 seconds total execution.
            // Well under Vercel's 60s maxDuration.
            if (i + BATCH_SIZE < quests.length) {
                await sleep(300);
            }
        }

        console.log(`[Admin] SSE Classification complete. ${updated}/${quests.length} records updated.`);
        send({ type: 'complete', total: quests.length, updated });
        res.end();
    } catch (err) {
        console.error("[Admin] Classification Failure:", err.message);
        send({ type: 'error', message: err.message });
        res.end();
    }
});

// POST /api/admin/purge-duplicates - Deduplicate archives
app.post('/api/admin/purge-duplicates', authenticate, checkRole('SOVEREIGN'), async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        console.log("[Admin] Initiating Duplicate Purge...");

        // 1. Group by title (Aggressive Normalization)
        // Only the fields the ranking below actually reads are fetched; pulling whole
        // documents meant transferring every synopsis just to compare titles.
        const allQuests = await Quest.find(LIVE)
            .select('title currentChapter lastRead')
            .lean();
        const groups = {};

        allQuests.forEach(q => {
            const key = normalizeTitle(q.title);
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        });

        let removedCount = 0;
        let processedTitles = 0;

        for (const title in groups) {
            const matches = groups[title];
            if (matches.length > 1) {
                // Keep the one with highest progress, then most recent
                matches.sort((a, b) => {
                    if (b.currentChapter !== a.currentChapter) {
                        return b.currentChapter - a.currentChapter;
                    }
                    return b.lastRead - a.lastRead;
                });

                // matches[0] is the survivor after the sort above; everything behind it goes —
                // to the Trash, not out of the database, so a wrong match is recoverable.
                const toRemove = matches.slice(1);

                for (const quest of toRemove) {
                    await Quest.updateOne({ _id: quest._id }, { deletedAt: new Date() });
                    removedCount++;
                }
                processedTitles++;
            }
        }

        res.json({ message: "Deduplication Engine Complete", removedCount, uniqueTitlesProcessed: processedTitles });
    } catch (err) {
        console.error("[Admin] Purge Failure:", err.message);
        res.status(500).json({ error: "Deduplication Engine Failure" });
    }
});
// ─── METADATA (cached) ────────────────────────────────────────────────────────

const META_SOURCES = ['ANILIST', 'MAL', 'MANGADEX'];
const META_HIT_TTL_MS = 3 * 24 * 60 * 60 * 1000;
// Short on purpose: a miss can be a source's outage or rate limit rather than a title no
// one knows, and a long-remembered miss would hide the cover and synopsis for days.
const META_MISS_TTL_MS = 30 * 60 * 1000;
const MAX_META_TITLE = 200;


/** One live lookup: the chosen source first and the others as fallbacks, or AUTO's
 *  parallel scoring across all three. */
const fetchMetadataFrom = async (title, source) => {
    const order = {
        ANILIST: [['AniList', fetchAniList], ['MangaDex', fetchMangaDex], ['MAL', fetchJikan]],
        MAL: [['MAL', fetchJikan], ['MangaDex', fetchMangaDex], ['AniList', fetchAniList]],
        MANGADEX: [['MangaDex', fetchMangaDex], ['AniList', fetchAniList], ['MAL', fetchJikan]],
    }[source];
    if (!order) return fetchBest(title);
    for (const [name, fetcher] of order) {
        const data = await fetcher(title);
        if (data) return data;
        debugLog(`[Proxy] ${name} miss for: ${title}`);
    }
    return null;
};

/**
 * Metadata for a title, from the shared cache while it is fresh, otherwise live (and then
 * cached). A cache fault never fails the lookup: it just falls through to the sources.
 * Returns `{ data, cached }`; `data` is null when no source knows the title.
 */
const lookupMetadata = async (title, source) => {
    const src = META_SOURCES.includes(source) ? source : 'AUTO';
    // normalizeTitle keeps only a-z0-9, so a title in another script would collapse to "".
    const key = `${src}|${normalizeTitle(title) || title.trim().toLowerCase()}`;
    await connectDB();
    try {
        const hit = await MetadataCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
        if (hit) return { data: hit.data, cached: true };
    } catch (err) {
        console.warn('[MetaCache] read failed:', err.message);
    }
    const data = await fetchMetadataFrom(title, src);
    try {
        await MetadataCache.updateOne(
            { key },
            { $set: { data: data || null, expiresAt: new Date(Date.now() + (data ? META_HIT_TTL_MS : META_MISS_TTL_MS)) } },
            { upsert: true },
        );
    } catch (err) {
        console.warn('[MetaCache] write failed:', err.message);
    }
    return { data, cached: false };
};

app.get('/api/proxy/metadata', authenticate, async (req, res) => {
    const { title, source } = req.query;
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: "Title required." });
    if (title.length > MAX_META_TITLE) return res.status(400).json({ error: "Title too long." });

    debugLog(`[Proxy] Metadata for: ${title} (Source: ${source || 'AUTO'})`);

    try {
        const { data, cached } = await lookupMetadata(title.trim(), source);
        res.set('X-Metadata-Cache', cached ? 'HIT' : 'MISS');
        if (data) {
            res.json(data);
        } else {
            res.status(404).json({ error: "Archive record not found." });
        }
    } catch (err) {
        console.error("[Proxy] Critical Failure:", err.message);
        res.status(500).json({ error: "Communication with archives severed." });
    }
});

// ─── IMAGE PROXY GUARDS ───────────────────────────────────────────────────────

// Only bitmap types are relayed. image/svg+xml is deliberately excluded: the proxy is
// same-origin with the SPA, and an SVG can carry <script>, which would run against the
// app's own origin and reach the token in localStorage.
const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|jpg|pjpeg|png|gif|webp|avif|bmp|tiff|x-icon|vnd\.microsoft\.icon)$/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_IMAGE_REDIRECTS = 3;

/**
 * Parse a URL and assert it points at a public http(s) host.
 * Applied to the initial target AND to every redirect hop — checking only the first
 * URL lets an attacker-controlled public host 302 the fetch into the private network.
 */
const assertPublicHttpUrl = (raw) => {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol "${parsed.protocol}"`);
    }
    if (isInternalHostname(parsed.hostname.toLowerCase())) {
        throw new Error(`Internal hostname "${parsed.hostname}" blocked`);
    }
    return parsed;
};

// GET /api/proxy/image - Image relay (SSRF-guarded, type-restricted, size-capped)
app.get('/api/proxy/image', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).send("URL required");

    // Block use as an open proxy from other sites. Browsers label a same-page <img>
    // request "same-origin"; a hotlink from an attacker's page is labelled "cross-site".
    // The header is absent on non-browser clients and very old browsers, so only an
    // explicit cross-site label is rejected — the rate limiter covers the rest.
    if (req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).send('Image relay is not available to third-party origins.');
    }

    try {
        assertPublicHttpUrl(url);
    } catch (err) {
        console.warn(`[ImageProxy] REJECTED: ${err.message}`);
        return res.status(403).send('Image origin rejected: invalid or restricted target.');
    }

    const buildReferer = (targetUrl, customReferer) => {
        if (customReferer) return customReferer;
        const h = new URL(targetUrl).hostname.toLowerCase();
        if (h.includes('mangabuddy') || h.includes('mbcdns')) return 'https://mangabuddy.com/';
        if (h.includes('asurascans')) return 'https://asurascans.com/';
        if (h.includes('mgeko')) return 'https://www.mgeko.cc/';
        return new URL(targetUrl).origin + '/';
    };

    const fetchOnce = async (targetUrl, timeoutMs, customReferer) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(targetUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site',
                    'Referer': buildReferer(targetUrl, customReferer)
                },
                // Manual, so each hop can be re-validated against the SSRF guard.
                redirect: 'manual'
            });
        } finally {
            clearTimeout(timer);
        }
    };

    /**
     * Follow redirects by hand, re-running the public-host assertion on every Location.
     */
    const fetchFollowingSafeRedirects = async (startUrl, timeoutMs, customReferer) => {
        let currentUrl = startUrl;
        for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
            const response = await fetchOnce(currentUrl, timeoutMs, customReferer);

            const isRedirect = response.status >= 300 && response.status < 400;
            if (!isRedirect) return { response, finalUrl: currentUrl };

            const location = response.headers.get('location');
            if (!location) return { response, finalUrl: currentUrl };

            // Resolve relative Location values against the current hop.
            currentUrl = assertPublicHttpUrl(new URL(location, currentUrl).toString()).toString();
        }
        throw new Error(`Exceeded ${MAX_IMAGE_REDIRECTS} redirects`);
    };

    try {
        let result;
        try {
            result = await fetchFollowingSafeRedirects(url, 6000, req.query.referer);
        } catch (firstErr) {
            // A blocked redirect target is a decision, not a transient fault — do not retry it.
            if (/blocked|Unsupported protocol|Exceeded/.test(firstErr.message)) {
                console.warn(`[ImageProxy] SSRF BLOCKED on redirect: ${firstErr.message}`);
                return res.status(403).send('Image origin rejected: restricted redirect target.');
            }
            // Retry once on timeout or network error
            console.warn(`[ImageProxy] First attempt failed (${firstErr.message}), retrying: ${url}`);
            result = await fetchFollowingSafeRedirects(url, 7000, req.query.referer);
        }

        const { response } = result;

        if (!response.ok) {
            console.error(`[ImageProxy] Upstream Error: ${response.status} for ${url}`);
            return res.status(response.status).send(`Upstream server returned ${response.status}`);
        }

        // Refuse anything that is not a bitmap image. Without this the relay will echo
        // attacker-controlled text/html back on the app's own origin.
        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
        if (!ALLOWED_IMAGE_TYPES.test(contentType)) {
            console.warn(`[ImageProxy] BLOCKED non-image content-type "${contentType}" from ${url}`);
            return res.status(415).send('Upstream response was not a supported image type.');
        }

        // Bail before buffering when the upstream declares an oversized body.
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
            return res.status(413).send('Upstream image exceeds the relay size limit.');
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            return res.status(413).send('Upstream image exceeds the relay size limit.');
        }

        res.setHeader('Content-Type', contentType);
        // Content-Type is now allowlisted; nosniff stops the browser second-guessing it.
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Browser: 24h cache. Vercel CDN edge: 1h (s-maxage).
        // stale-while-revalidate serves cached content while silently refreshing.
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Vary', 'Accept');

        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("[ImageProxy] Critical Failure:", err.message, url);
        return sendError(res, 504, 'Failed to relay image from origin.', err);
    }
});


// ─── INTERNAL SCORERS ─────────────────────────────────────────────────────────
// Both return a Record<class, number> so they can be additively combined.

const _genreScores = (genres) => {
    const scores = { NECROMANCER: 0, CONSTELLATION: 0, MAGE: 0, IRREGULAR: 0, PLAYER: 0 };
    if (!genres || genres.length === 0) return scores;

    const g = genres.map(x => x.toLowerCase());
    const has = (kw) => g.some(genre => genre.includes(kw));

    // PLAYER — explicit game/system mechanics
    if (has('game'))                     scores.PLAYER += 8;
    if (has('rpg'))                      scores.PLAYER += 8;
    if (has('video game'))               scores.PLAYER += 8;
    if (has('virtual reality'))          scores.PLAYER += 6;
    if (has('level'))                    scores.PLAYER += 5;
    if (has('system'))                   scores.PLAYER += 5;
    if (has('dungeon'))                  scores.PLAYER += 5;
    if (has('user registration'))        scores.PLAYER += 6;
    if (has('guild'))                    scores.PLAYER += 4;
    if (has('tournament'))               scores.PLAYER += 3;

    // IRREGULAR — isekai / regression / transmigration
    if (has('isekai'))                   scores.IRREGULAR += 9;
    if (has('reincarnation'))            scores.IRREGULAR += 9;
    if (has('regression'))               scores.IRREGULAR += 9;
    if (has('transmigration'))           scores.IRREGULAR += 9;
    if (has('time travel'))              scores.IRREGULAR += 7;
    if (has('time loop'))                scores.IRREGULAR += 7;
    if (has('transported to another'))   scores.IRREGULAR += 8;
    if (has('villainess'))               scores.IRREGULAR += 6;
    if (has('second chance'))            scores.IRREGULAR += 6;
    if (has('tower'))                    scores.IRREGULAR += 5;
    if (has('overpowered main character')) scores.IRREGULAR += 3;

    // MAGE — explicit magic/sorcery tags (note: bare 'fantasy' is very generic, only +1)
    if (has('magic system'))             scores.MAGE += 8;
    if (has('magic'))                    scores.MAGE += 7;
    if (has('alchemy'))                  scores.MAGE += 7;
    if (has('sorcery'))                  scores.MAGE += 8;
    if (has('wizard'))                   scores.MAGE += 8;
    if (has('witchcraft'))               scores.MAGE += 8;
    if (has('elemental'))                scores.MAGE += 5;
    if (has('mana'))                     scores.MAGE += 5;
    if (has('spirit'))                   scores.MAGE += 4;
    if (has('contract'))                 scores.MAGE += 4;
    if (has('familiar'))                 scores.MAGE += 4;
    if (has('enchant'))                  scores.MAGE += 5;
    // "fantasy" alone is too vague — minimal weight so title signals can override
    if (has('fantasy') && !has('isekai') && !has('reincarnation')) scores.MAGE += 1;

    // CONSTELLATION — divine / mythological / cosmic
    if (has('mythology'))                scores.CONSTELLATION += 9;
    if (has('gods'))                     scores.CONSTELLATION += 8;
    if (has('divine'))                   scores.CONSTELLATION += 8;
    if (has('celestial'))                scores.CONSTELLATION += 8;
    if (has('cosmic'))                   scores.CONSTELLATION += 8;
    if (has('religion'))                 scores.CONSTELLATION += 6;
    if (has('prophecy'))                 scores.CONSTELLATION += 7;
    if (has('fate'))                     scores.CONSTELLATION += 5;
    if (has('chosen one'))               scores.CONSTELLATION += 6;
    if (has('heaven'))                   scores.CONSTELLATION += 5;
    if (has('saint'))                    scores.CONSTELLATION += 5;
    if (has('angel'))                    scores.CONSTELLATION += 5;
    if (has('dragon'))                   scores.CONSTELLATION += 4;

    // NECROMANCER — death / dark arts / horror / underworld
    if (has('necromancy'))               scores.NECROMANCER += 10;
    if (has('undead'))                   scores.NECROMANCER += 9;
    if (has('horror'))                   scores.NECROMANCER += 7;
    if (has('gore'))                     scores.NECROMANCER += 6;
    if (has('zombie'))                   scores.NECROMANCER += 8;
    if (has('skeleton'))                 scores.NECROMANCER += 8;
    if (has('dark fantasy'))             scores.NECROMANCER += 6;
    if (has('supernatural') && has('horror')) scores.NECROMANCER += 5;
    if (has('demons') && has('horror'))  scores.NECROMANCER += 5;
    if (has('psychological') && has('horror')) scores.NECROMANCER += 5;
    if (has('survival') && has('horror')) scores.NECROMANCER += 4;
    if (has('shadow'))                   scores.NECROMANCER += 5;
    if (has('death'))                    scores.NECROMANCER += 4;

    return scores;
};

const _titleScores = (title) => {
    const t = title.toLowerCase();
    const scores = { NECROMANCER: 0, CONSTELLATION: 0, MAGE: 0, IRREGULAR: 0, PLAYER: 0 };

    // Weight tiers:
    //   10 = class-defining single word (necromancer, wizard, isekai)
    //    6 = strong supporting word (shadow, lich, tower)
    //    3 = ambiguous but relevant (dark, return, awakened)

    // NECROMANCER keywords
    [['necromancer', 10], ['necromancy', 10], ['necro', 10], ['undead', 10], ['lich', 10],
     ['death knight', 10], ['zombie', 9], ['skeleton', 9], ['dark lord', 8],
     ['shadow monarch', 8], ['death god', 8], ['demon king', 6], ['bone', 6],
     ['corpse', 6], ['grave', 6], ['reaper', 6], ['wraith', 6], ['phantom', 6],
     ['abyss', 5], ['cursed', 4], ['shadow', 5], ['hollow', 4], ['shade', 5],
     ['requiem', 6], ['soul stealer', 8], ['revenant', 8]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.NECROMANCER += w; });

    // CONSTELLATION keywords
    [['constellation', 10], ['celestial', 10], ['mythology', 10], ['divine', 8],
     ['cosmic', 8], ['god', 6], ['goddess', 8], ['angel', 7], ['archangel', 8],
     ['oracle', 8], ['saint', 7], ['holy', 6], ['sacred', 6], ['heaven', 6],
     ['ascend', 5], ['transcend', 5], ['immortal', 5], ['eternal', 5],
     ['dragon god', 8], ['prophecy', 7], ['fated', 5], ['chosen', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.CONSTELLATION += w; });

    // IRREGULAR keywords
    [['isekai', 10], ['reincarnation', 10], ['reincarnate', 10], ['transmigrat', 10],
     ['regression', 10], ['regress', 9], ['returner', 8], ['time loop', 9],
     ['time travel', 9], ['second life', 8], ['second chance', 8], ['restart', 7],
     ['irregular', 10], ['villainess', 8], ['return', 4], ['otherworld', 7],
     ['tower', 5], ['invincible', 5], ['strongest', 5], ['overpowered', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.IRREGULAR += w; });

    // MAGE keywords
    [['wizard', 10], ['mage', 10], ['sorcerer', 10], ['witch', 10], ['archmage', 10],
     ['arch mage', 10], ['witchcraft', 10], ['magician', 8], ['sorcery', 10],
     ['enchant', 7], ['alchemy', 9], ['alchemist', 9], ['arcane', 8],
     ['spell', 6], ['magic', 7], ['potion', 6], ['familiar', 6],
     ['grimoire', 7], ['elemental', 6], ['summoner', 6], ['mystic', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.MAGE += w; });

    // PLAYER keywords
    [['player', 10], ['ranker', 9], ['leveling', 10], ['levelling', 10],
     ['level up', 9], ['hunter', 7], ['dungeon', 7], ['guild', 7],
     ['raider', 7], ['mmorpg', 10], ['game', 7], ['rpg', 10],
     ['solo', 5], ['rank', 4], ['awakener', 6], ['boss', 5]
    ].forEach(([kw, w]) => { if (t.includes(kw)) scores.PLAYER += w; });

    return scores;
};

// Combined classifier — adds genre + title scores so neither is silently discarded.
// Example: "Return of the Necromancer" with genres ["Action","Fantasy"]:
//   NECROMANCER = genre:0 + title:10 = 10  ✓ wins
//   MAGE        = genre:1 + title:0  = 1
const classifyBest = (title, genres, oldClass) => {
    const gs = _genreScores(genres || []);
    const ts = _titleScores(title || '');

    const PRIORITY = ['NECROMANCER', 'CONSTELLATION', 'MAGE', 'IRREGULAR', 'PLAYER'];
    let best = 'PLAYER', bestScore = 0;
    for (const cls of PRIORITY) {
        const combined = gs[cls] + ts[cls];
        if (combined > bestScore) { bestScore = combined; best = cls; }
    }
    
    // If we confidently scored something, return it.
    // Otherwise, retain the old class. If no old class exists, default to PLAYER.
    if (bestScore > 0) return best;
    return oldClass || 'PLAYER';
};

// ─── STALE SANDBOX REAPER ─────────────────────────────────────────────────────

/**
 * Identifies and drops gsb_* guest sandbox databases older than 2 hours.
 * Returns a summary so the caller can report what it did.
 */
const purgeStaleSandboxes = async () => {
    console.log('[REAPER] Starting maintenance check...');
    await connectDB();

    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    let inspected = 0;
    let purged = 0;

    for (const dbInfo of databases) {
        if (dbInfo.name.startsWith('gsb_')) {
            inspected++;
            const parts = dbInfo.name.split('_');
            // parts[0] = gsb, parts[1] = g, parts[2] = <base36_timestamp>
            const timestamp = parseInt(parts[2], 36);

            if (!isNaN(timestamp) && (now - timestamp) > TWO_HOURS_MS) {
                console.log(`[REAPER] Purging stale sandbox: ${dbInfo.name}`);
                const conn = await getTenantDb(dbInfo.name);
                await resilientPurge(conn, dbInfo.name);
                purged++;
            }
        }
    }

    console.log(`[REAPER] Cycle complete. Inspected ${inspected}, purged ${purged}.`);
    return { inspected, purged };
};

// POST /api/admin/reap-sandboxes - Invoked by the scheduled workflow.
//
// This used to be a module-scope setInterval. On Vercel the process is created per
// request and frozen between invocations, so that timer effectively never fired and the
// 2-hour guest TTL was enforced only by the browser. Driving it from an external
// schedule is the only thing that actually reaps a serverless deployment.
app.post('/api/admin/reap-sandboxes', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }

    try {
        const summary = await purgeStaleSandboxes();
        res.json({ message: 'Reaper cycle complete.', ...summary });
    } catch (err) {
        return sendError(res, 500, 'Reaper cycle failed.', err);
    }
});

// ─── NEW-CHAPTER TRACKING ─────────────────────────────────────────────────────

/** Statuses worth checking: a CONQUERED or SEVERED series has nothing you are waiting for. */
const SYNC_STATUSES = ['ACTIVE', 'PLANNED'];

/**
 * Check up to `limit` series for newly released chapters, least recently checked first, so
 * repeated runs walk the whole library (the hourly workflow takes a slice each time). When a
 * source shows more chapters than the stored total, the total is raised and the difference
 * added to `newChapters`, which the app shows as "+N NEW" until you read on. Totals are never
 * lowered: a source is often behind the site you actually read on.
 *
 * Two series at a time with a pause between pairs: MangaDex allows about 5 requests a second
 * and each series costs it two (search, aggregate).
 */
const syncChapters = async (conn, limit) => {
    const Quest = getModel(conn, 'Quest');
    const due = await Quest.find({ ...LIVE, status: { $in: SYNC_STATUSES } })
        .sort({ chaptersCheckedAt: 1, _id: 1 }) // never checked (null) sorts first
        .limit(limit)
        .select('title totalChapters')
        .lean();

    const updated = [];
    for (let i = 0; i < due.length; i += 2) {
        await Promise.all(due.slice(i, i + 2).map(async (q) => {
            const latest = await fetchLatestChapter(q.title).catch(() => null);
            const total = q.totalChapters || 0;
            const set = { chaptersCheckedAt: new Date() };
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
            await Quest.updateOne({ _id: q._id }, added > 0 ? { $set: set, $inc: { newChapters: added } } : { $set: set });
        }));
        if (i + 2 < due.length) await sleep(400);
    }
    return { checked: due.length, updated };
};

// POST /api/quests/sync-chapters - Check your own library now (the app's "check" button).
// Each call fans out to public APIs, hence its own limiter.
app.post('/api/quests/sync-chapters', chapterSyncLimiter, authenticate, async (req, res) => {
    try {
        res.json(await syncChapters(req.dbConn, 12));
    } catch (err) {
        return sendError(res, 500, 'Chapter check failed.', err);
    }
});

// POST /api/admin/sync-chapters - The scheduled workflow's call, for the owner's archive.
app.post('/api/admin/sync-chapters', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 30);
        const conn = await getTenantDb(process.env.SYNC_TENANT || 'akashic_records');
        res.json({ message: 'Chapter sync complete.', ...(await syncChapters(conn, limit)) });
    } catch (err) {
        return sendError(res, 500, 'Chapter sync failed.', err);
    }
});

// ─── FULL BACKUP ──────────────────────────────────────────────────────────────

const BACKUP_FORMAT = 'akashic-records-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_QUESTS = 5000;
const MAX_BACKUP_LOG = 100000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/backup - Everything a library holds, as one JSON document: every record with its
// synopsis (Trash included), the reading log behind the stats, and the streak. The CSV
// export stays the spreadsheet view; this is the one that restores completely.
app.get(BACKUP_PATH, authenticate, async (req, res) => {
    try {
        const [quests, readingLog, settings] = await Promise.all([
            getModel(req.dbConn, 'Quest').find({})
                .select('-__v -normalizedTitle -chaptersCheckedAt -coverCheckedAt')
                .lean(),
            getModel(req.dbConn, 'ReadingLog').find({}).select('-__v -_id').sort({ at: 1 }).lean(),
            getModel(req.dbConn, 'UserSettings').findOne({ userId: req.user._id })
                .select('-_id streak lastReadDate activeQuestId')
                .lean(),
        ]);
        res.json({
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            quests,
            readingLog,
            settings: settings || null,
        });
    } catch (err) {
        return sendError(res, 500, 'Backup failed.', err);
    }
});

/**
 * POST /api/backup - Restore a backup by MERGING it into the library, never by replacing it,
 * so restoring an old file cannot cost anything read since:
 *   - a title the library lacks is added (a record trashed in the backup lands in the Trash);
 *   - a title it has moves forward only (chapter, total) and gains a cover, synopsis or
 *     link only where its own is empty; a trashed copy the backup has live comes back out;
 *   - reading-log entries are added unless the same move is already recorded;
 *   - the streak is taken only when the backup's last reading day is the later one.
 * Every record goes through validateQuest, as any write does.
 */
app.post(BACKUP_PATH, authenticate, writeLimiter, express.json({ limit: '4mb' }), async (req, res) => {
    const b = req.body || {};
    if (b.format !== BACKUP_FORMAT || b.version !== BACKUP_VERSION || !Array.isArray(b.quests)) {
        return res.status(400).json({ message: 'That file is not an Akashic Records backup.' });
    }
    const log = Array.isArray(b.readingLog) ? b.readingLog : [];
    if (b.quests.length > MAX_BACKUP_QUESTS || log.length > MAX_BACKUP_LOG) {
        return res.status(400).json({ message: 'That backup is larger than this archive accepts.' });
    }

    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const ReadingLog = getModel(req.dbConn, 'ReadingLog');
        const UserSettings = getModel(req.dbConn, 'UserSettings');

        const existing = await Quest.find({})
            .select('title normalizedTitle currentChapter totalChapters cover synopsis readLink deletedAt')
            .lean();
        const byNorm = new Map(existing.map((q) => [q.normalizedTitle || normalizeTitle(q.title), q]));
        const idMap = new Map(); // the backup's record id -> the id it has here
        let room = req.user.role === 'GUEST' ? Math.max(0, GUEST_RECORD_CAP - existing.length) : Infinity;

        const inserts = [];
        const updates = [];
        let skipped = 0;
        for (const raw of b.quests) {
            const { value: v, error } = validateQuest(raw, null);
            if (error) { skipped++; continue; }
            const norm = normalizeTitle(v.title);
            const trashedInBackup = !!raw.deletedAt && !Number.isNaN(Date.parse(raw.deletedAt));
            const have = byNorm.get(norm);
            if (have) {
                if (raw._id) idMap.set(String(raw._id), have._id);
                const set = {};
                if ((v.currentChapter ?? 0) > (have.currentChapter ?? 0)) set.currentChapter = v.currentChapter;
                if ((v.totalChapters ?? 0) > (have.totalChapters ?? 0)) set.totalChapters = v.totalChapters;
                for (const f of ['cover', 'synopsis', 'readLink']) if (v[f] && !have[f]) set[f] = v[f];
                if (have.deletedAt && !trashedInBackup) set.deletedAt = null;
                if (Object.keys(set).length) {
                    updates.push({ updateOne: { filter: { _id: have._id }, update: { $set: set } } });
                    Object.assign(have, set);
                }
                continue;
            }
            if (room <= 0) { skipped++; continue; }
            const _id = new mongoose.Types.ObjectId();
            const doc = { _id, ...v, normalizedTitle: norm, deletedAt: trashedInBackup ? new Date(raw.deletedAt) : null };
            inserts.push(doc);
            byNorm.set(norm, doc);
            if (raw._id) idMap.set(String(raw._id), _id);
            room--;
        }

        let added = inserts.length;
        if (inserts.length) {
            try {
                await Quest.insertMany(inserts, { ordered: false });
            } catch (err) {
                // A record refused here (a title another one already holds, say) is skipped;
                // its reading-log entries are dropped with it rather than left pointing nowhere.
                const failed = (err.writeErrors || []).map((w) => inserts[w.index ?? w.err?.index]?._id).filter(Boolean);
                if (!failed.length) throw err;
                const gone = new Set(failed.map(String));
                for (const [k, id] of idMap) if (gone.has(String(id))) idMap.delete(k);
                added -= failed.length;
                skipped += failed.length;
            }
        }
        if (updates.length) await Quest.bulkWrite(updates, { ordered: false });

        // Reading log: same record, same moment, same move = already recorded.
        const rows = [];
        for (const e of log) {
            const questId = idMap.get(String(e?.questId));
            const from = Number(e?.from), to = Number(e?.to), delta = Number(e?.delta);
            const at = new Date(e?.at);
            if (!questId || ![from, to, delta].every(Number.isInteger) || !DAY_RE.test(String(e?.day)) || Number.isNaN(at.getTime())) continue;
            rows.push({ questId, title: String(e.title || '').slice(0, 300), from, to, delta, day: e.day, at });
        }
        const keyOf = (r) => `${r.questId}|${+new Date(r.at)}|${r.from}|${r.to}`;
        const seen = new Set((await ReadingLog.find({ questId: { $in: [...new Set(rows.map((r) => r.questId))] } })
            .select('questId at from to').lean()).map(keyOf));
        const fresh = rows.filter((r) => !seen.has(keyOf(r)) && seen.add(keyOf(r)));
        if (fresh.length) await ReadingLog.insertMany(fresh, { ordered: false });

        // Streak: only when the backup has read more recently than this library.
        let streakRestored = false;
        const s = b.settings;
        if (s && DAY_RE.test(String(s.lastReadDate)) && Number.isInteger(s.streak) && s.streak >= 0) {
            await ensureUserSettings(UserSettings, req.user._id);
            const r = await UserSettings.updateOne(
                { userId: req.user._id, $or: [{ lastReadDate: null }, { lastReadDate: { $lt: s.lastReadDate } }] },
                { $set: { streak: s.streak, lastReadDate: s.lastReadDate } },
            );
            streakRestored = r.modifiedCount > 0;
        }

        res.json({ added, updated: updates.length, skipped, logEntries: fresh.length, streakRestored });
    } catch (err) {
        return sendError(res, 500, 'Restore failed.', err);
    }
});

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

// Each call can fan out to three public APIs per title, hence its own limiter.
const coverBackfillLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Cover searches are limited to a few an hour. Try again later.' }
});

// POST /api/quests/backfill-covers - "Find missing covers" in the profile.
app.post('/api/quests/backfill-covers', coverBackfillLimiter, authenticate, async (req, res) => {
    try {
        res.json(await backfillCovers(req.dbConn, 8));
    } catch (err) {
        return sendError(res, 500, 'Cover search failed.', err);
    }
});

// POST /api/admin/backfill-covers - The scheduled workflow's call, for the owner's archive.
app.post('/api/admin/backfill-covers', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);
        const conn = await getTenantDb(process.env.SYNC_TENANT || 'akashic_records');
        res.json({ message: 'Cover backfill complete.', ...(await backfillCovers(conn, limit)) });
    } catch (err) {
        return sendError(res, 500, 'Cover backfill failed.', err);
    }
});

// ─── TERMINAL ERROR HANDLER ───────────────────────────────────────────────────
// Last line of defence. Without this, anything thrown outside a route's own try/catch
// (a malformed JSON body, for instance) reaches Express's default handler, which returns
// the message — and in development the stack — straight to the client.
//
// Registered last so it sits behind every route. Express identifies an error handler by
// its four-argument signature, so `next` must stay in the list even though it is unused.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[UNHANDLED]', err.stack || err.message || err);

    if (res.headersSent) return;

    // Body-parser failures are the client's fault; report them as such.
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Payload too large.' });
    }
    if (err.status === 400 && err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Malformed request body.' });
    }

    res.status(500).json({ message: 'System fault. The archive could not complete that request.' });
});

module.exports = app;
