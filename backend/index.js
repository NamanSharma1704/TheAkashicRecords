const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { connectDB, getTenantDb } = require('./config/db');
const { initDatabase } = require('./config/init');
const { getModel } = require('./models/modelFactory');
const { normalizeTitle } = require('./utils/normalizeTitle');
const { fetchAniList, fetchMangaDex, fetchJikan, fetchBest, fetchGenresOnly } = require('./utils/metadataProxy');
const User = require('./models/User');
const {
    hashPassword, comparePassword, generateToken, verifyToken,
    getTokenTtlMs, setAuthCookie, clearAuthCookie, readAuthCookie
} = require('./utils/auth');
const { DOCUMENT_CSP, API_CSP } = require('./utils/securityHeaders');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// Vercel terminates TLS and forwards through exactly one proxy hop. Without this,
// req.ip is the proxy's address for every caller and the rate limiter below shares
// a single bucket across all clients. A numeric hop count (rather than `true`) keeps
// express-rate-limit's permissive-trust-proxy validator satisfied.
app.set('trust proxy', 1);

const getTodayStr = () => new Date().toISOString().split('T')[0];

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
// room than any quest payload needs.
app.use(express.json({ limit: '64kb' }));

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

        const Quest = getModel(conn, 'Quest');
        const questCount = await Quest.countDocuments();

        res.json({
            status: 'Pulse Active',
            database: statusMap[dbStatus] || 'unknown',
            documentCount: questCount,
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return sendError(res, 500, 'Health probe failed: archive link unavailable.', err);
    }
});

// --- AUTH ROUTES ---

// POST /api/auth/register - Create a new hunter
//
// Disabled by default. This deployment is single-owner: the app has no registration UI,
// the owner's account is provisioned through /api/auth/upsert-sovereign, and visitors use
// guest mode. Left open, this route lets anyone mint accounts whose private tenant
// databases the sandbox reaper does not match and therefore never reclaims.
// Set ALLOW_REGISTRATION=true to re-enable it.
app.post('/api/auth/register', async (req, res) => {
    if (process.env.ALLOW_REGISTRATION !== 'true') {
        return res.status(403).json({ message: 'Registration is closed. Use guest access to explore the archive.' });
    }

    try {
        // `role` is deliberately NOT read from the body. authenticate() trusts the role
        // inside the JWT, so a client-supplied role here would mint a SOVEREIGN token and
        // route the caller to the live akashic_records tenant. Elevation has exactly one
        // legitimate path: POST /api/auth/upsert-sovereign, gated on SYSTEM_ADMIN_SECRET.
        const { username, password } = req.body || {};

        // Validate before touching the database — a malformed payload should not cost a connection.
        if (typeof username !== 'string' || !username.trim()) {
            return res.status(400).json({ message: 'Username is required.' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        await connectDB();
        const trimmedUsername = username.trim();

        // Login resolves usernames case-insensitively, so registration must reject
        // case-variant collisions — otherwise "Hunter" and "hunter" both exist but only
        // one of them can ever authenticate.
        const existing = await User.findOne({
            username: { $regex: new RegExp(`^${escapeRegex(trimmedUsername)}$`, 'i') }
        });
        if (existing) return res.status(409).json({ message: 'Archive Collision: Username already registered.' });

        const passwordHash = await hashPassword(password);
        const user = await User.create({
            username: trimmedUsername,
            passwordHash,
            role: 'GUEST'
        });

        const token = generateToken(user);
        setAuthCookie(res, token, user.role);
        res.status(201).json({
            user: { id: user._id, username: user.username, role: user.role },
            expiresAt: Date.now() + getTokenTtlMs(user.role)
        });
    } catch (err) {
        return sendError(res, 500, 'Registration failed. Please try again.', err);
    }
});

// POST /api/auth/upsert-sovereign - Administrative Identity Sync (Internal)
app.post('/api/auth/upsert-sovereign', async (req, res) => {
    try {
        const { systemSecret, username, password } = req.body;
        const SYSTEM_ADMIN_SECRET = process.env.SYSTEM_ADMIN_SECRET;
        if (!SYSTEM_ADMIN_SECRET || systemSecret !== SYSTEM_ADMIN_SECRET) {
            return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
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

        console.log(`[AUTH] Login attempt: "${username}"`);

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
        const { newUsername, currentPassword, newPassword } = req.body;

        if (!currentPassword) {
            return res.status(400).json({ message: 'Current password is required to update credentials.' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'Hunter identity not found in Akashic Records.' });

        const isMatch = await comparePassword(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Current password is incorrect.' });

        if (newUsername && newUsername.trim() !== user.username) {
            const taken = await User.findOne({ username: { $regex: new RegExp(`^${newUsername.trim()}$`, 'i') } });
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
        console.log(`[PERF] Initial Data Batch Request Start: ${req.user.username}`);

        const Quest = getModel(req.dbConn, 'Quest');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = getTodayStr();

        // parallel fetch for absolute speed
        const [quests, settingsResult, dailyResult] = await Promise.all([
            Quest.find().sort({ lastRead: -1 }),
            UserSettings.findOne({ userId: req.user._id }),
            DailyQuest.findOne({ date: today })
        ]);

        console.log(`[PERF] Initial parallel fetch complete: ${Date.now() - start}ms`);

        let settings = settingsResult;
        let daily = dailyResult;

        // Lazy-seeding and creation handled as post-fetch cleanup to minimize latency
        const followups = [];

        // Quests seeding
        if (quests.length === 0 && req.user.role === 'GUEST') {
            followups.push(initDatabase(() => req.dbConn));
        }

        // Settings/Daily creation
        if (!settings) followups.push(UserSettings.create({ userId: req.user._id }).then(s => settings = s));
        if (!daily) followups.push(DailyQuest.create({ date: today }).then(d => daily = d));

        if (followups.length > 0) {
            await Promise.all(followups);
            console.log(`[PERF] Followup completions in: ${Date.now() - start}ms`);
        }

        res.json({
            quests,
            userState: {
                streak: settings?.streak || 0,
                lastReadDate: settings?.lastReadDate || null,
                dailyAbsorbed: daily?.absorbedIds.length || 0,
                absorbedIds: daily?.absorbedIds || []
            }
        });

        console.log(`[PERF] Total Initial Data Duration: ${Date.now() - start}ms`);
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
        console.log(`[PERF] User State Request Start: ${req.user.username}`);
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const today = getTodayStr();

        // Parallel fetch for speed
        const [settingsResult, dailyResult] = await Promise.all([
            UserSettings.findOne({ userId: req.user._id }),
            DailyQuest.findOne({ date: today })
        ]);

        console.log(`[PERF] Initial fetch complete: ${Date.now() - start}ms`);

        let settings = settingsResult;
        let daily = dailyResult;

        // Handle missing documents in parallel if possible
        const creations = [];
        if (!settings) creations.push(UserSettings.create({ userId: req.user._id }).then(s => settings = s));
        if (!daily) creations.push(DailyQuest.create({ date: today }).then(d => daily = d));

        if (creations.length > 0) {
            await Promise.all(creations);
            console.log(`[PERF] Missing documents created: ${Date.now() - start}ms`);
        }

        res.json({
            streak: settings.streak,
            lastReadDate: settings.lastReadDate,
            dailyAbsorbed: daily.absorbedIds.length,
            absorbedIds: daily.absorbedIds
        });
        console.log(`[PERF] Total User State Duration: ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[PERF] User State Failure (${Date.now() - start}ms):`, err.message);
        return sendError(res, 500, 'Failed to load hunter state.', err);
    }
});

// GET /api/quests - Fetch all quests
app.get('/api/quests', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        let quests = await Quest.find().sort({ lastRead: -1 });

        console.log(`[API] Quests requested by ${req.user.username}. Found: ${quests.length} documents.`);

        // Lazy-seed if DB is completely empty (common for Guest or new Sovereign)
        if (quests.length === 0) {
            console.log('[API] Database empty. Checking lazy seeding condition...');
            // Only seed Guests, let Sovereigns migrate or add their own
            if (req.user.role === 'GUEST') {
                await initDatabase(() => req.dbConn);
                quests = await Quest.find().sort({ lastRead: -1 });
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

app.post('/api/quests', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const { title } = req.body;
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ message: "Title required" });
        }

        // 1. DUPLICATE CHECK (ignores punctuation, apostrophes and casing)
        const normalizedTitle = normalizeTitle(title);

        // Fast path: a single indexed lookup. This replaced a Quest.find({}) that pulled
        // every document — synopses included — into Node on each create, once per row
        // during a CSV import.
        let collision = await Quest.findOne({ normalizedTitle }).select('title');

        // Slow path, for documents written before normalizedTitle existed. It is scoped to
        // just those documents and projects only the title, and disappears entirely once
        // backend/scripts/backfill_normalized_titles.js has run.
        if (!collision) {
            const legacy = await Quest
                .find({ $or: [{ normalizedTitle: { $exists: false } }, { normalizedTitle: '' }] })
                .select('title')
                .lean();
            collision = legacy.find(q => normalizeTitle(q.title) === normalizedTitle) || null;
        }

        if (collision) {
            return res.status(409).json({
                message: `Artifact strictly classified as Duplicate. Existing entry detected: "${collision.title}"`
            });
        }

        // 2. Allowlist fields — prevents mass assignment
        const safeBody = sanitizeQuestBody(req.body);
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
app.put('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const questId = req.params.id;

        // Allowlist fields — prevents mass assignment
        const body = sanitizeQuestBody(req.body);

        // Keep the duplicate-detection key in step with the title it derives from.
        if (body.title !== undefined) {
            body.normalizedTitle = normalizeTitle(body.title);
        }

        if (body.currentChapter !== undefined) {
            const today = getTodayStr();

            let settings = await UserSettings.findOne({ userId: req.user._id });
            if (!settings) settings = await UserSettings.create({ userId: req.user._id });

            if (settings.lastReadDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                if (settings.lastReadDate === yesterdayStr) {
                    settings.streak += 1;
                } else {
                    settings.streak = 1;
                }
                settings.lastReadDate = today;
                await settings.save();
            }

            let daily = await DailyQuest.findOne({ date: today });
            if (!daily) daily = await DailyQuest.create({ date: today });
            if (!daily.absorbedIds.includes(questId)) {
                daily.absorbedIds.push(questId);
                await daily.save();
            }
        }

        const updatedQuest = await Quest.findByIdAndUpdate(
            questId,
            { ...body, lastRead: Date.now() },
            { returnDocument: 'after' }
        );
        res.json(updatedQuest);
    } catch (err) {
        return sendError(res, 400, 'Failed to update quest record.', err);
    }
});

// DELETE /api/quests/:id - Delete a quest
app.delete('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        await Quest.findByIdAndDelete(req.params.id);
        res.json({ message: 'Quest Purged.' });
    } catch (err) {
        return sendError(res, 500, 'Failed to purge quest record.', err);
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
        const quests = await Quest.find({});
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
                        console.log(`[Classify] "${quest.title}" → genres: [${genres.slice(0,4).join(', ')}] → ${newClass}`);
                    } else {
                        console.log(`[Classify] "${quest.title}" → no metadata, title-only → ${newClass}`);
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
        const allQuests = await Quest.find({})
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

                // matches[0] is the survivor after the sort above; everything behind it goes.
                const toRemove = matches.slice(1);

                for (const quest of toRemove) {
                    await Quest.findByIdAndDelete(quest._id);
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
app.get('/api/proxy/metadata', authenticate, async (req, res) => {
    const { title, source } = req.query;
    if (!title) return res.status(400).json({ error: "Title required." });

    console.log(`[Proxy] Fetching metadata for: ${title} (Source: ${source || 'AUTO'})`);

    try {
        let data = null;

        if (source === 'ANILIST') {
            data = await fetchAniList(title);
            if (!data) {
                console.log(`[Proxy] AniList miss — falling back to MangaDex for: ${title}`);
                data = await fetchMangaDex(title);
            }
            if (!data) {
                console.log(`[Proxy] MangaDex miss — falling back to MAL for: ${title}`);
                data = await fetchJikan(title);
            }
        } else if (source === 'MAL') {
            data = await fetchJikan(title);
            if (!data) {
                console.log(`[Proxy] MAL miss — falling back to MangaDex for: ${title}`);
                data = await fetchMangaDex(title);
            }
            if (!data) {
                console.log(`[Proxy] MangaDex miss — falling back to AniList for: ${title}`);
                data = await fetchAniList(title);
            }
        } else if (source === 'MANGADEX') {
            data = await fetchMangaDex(title);
            if (!data) {
                console.log(`[Proxy] MangaDex miss — falling back to AniList for: ${title}`);
                data = await fetchAniList(title);
            }
            if (!data) {
                console.log(`[Proxy] AniList miss — falling back to MAL for: ${title}`);
                data = await fetchJikan(title);
            }
        } else {
            // AUTO Logic: Parallel scoring competition
            data = await fetchBest(title);
        }

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

// The former classifyFromGenres / inferClassFromTitle wrappers were removed: nothing
// called them, and classifyBest above supersedes both by combining the two score sets
// rather than choosing between them.








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
    const SYSTEM_ADMIN_SECRET = process.env.SYSTEM_ADMIN_SECRET;
    const provided = req.headers['x-system-secret'];

    if (!SYSTEM_ADMIN_SECRET || provided !== SYSTEM_ADMIN_SECRET) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }

    try {
        const summary = await purgeStaleSandboxes();
        res.json({ message: 'Reaper cycle complete.', ...summary });
    } catch (err) {
        return sendError(res, 500, 'Reaper cycle failed.', err);
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
