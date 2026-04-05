const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { connectDB, getTenantDb } = require('./config/db');
const { initDatabase } = require('./config/init');
const { getModel } = require('./models/modelFactory');
const { fetchAniList, fetchMangaDex, fetchJikan, fetchBest, fetchGenresOnly } = require('./utils/metadataProxy');
const User = require('./models/User');
const { hashPassword, comparePassword, generateToken, verifyToken, JWT_SECRET } = require('./utils/auth');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

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

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://the-akashic-records.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server (no origin) and known origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin "${origin}" not permitted.`));
        }
    },
    credentials: true
}));

app.use(express.json());

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

// ─── SSRF BLOCKLIST (Permissive for Public Images) ───────────────────────────
const isInternalHostname = (hostname) => {
    // Blocks localhost, private network spaces (10.x, 192.168.x, 172.16-31.x), loopback, metadata IPs, and local domains
    const internalRegex = /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|::1|.*\.local|.*\.internal)$/i;
    return internalRegex.test(hostname);
};

// --- AUTH MIDDLEWARE ---
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication Protocol Terminated: No Token Provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ message: 'Authentication Protocol Terminated: Invalid Token.' });
    }

    try {
        // --- ZERO-DB AUTHENTICATION ---
        // Trust the token's payload for role-based routing and multi-tenancy.
        // This eliminates one DB lookup per request.
        req.user = {
            _id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };

        // --- MULTI-TENANCY LOGIC ---
        // SOVEREIGN -> akashic_records, GUEST -> test_records
        const dbName = req.user.role === 'SOVEREIGN' ? 'akashic_records' : 'test_records';
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
        res.status(500).json({ error: err.message });
    }
});

// --- AUTH ROUTES ---

// POST /api/auth/register - Create a new hunter (Limited use recommended)
app.post('/api/auth/register', async (req, res) => {
    try {
        await connectDB();
        const { username, password, role } = req.body;

        const existing = await User.findOne({ username });
        if (existing) return res.status(409).json({ message: 'Archive Collision: Username already registered.' });

        const passwordHash = await hashPassword(password);
        const user = await User.create({
            username,
            passwordHash,
            role: role || 'GUEST'
        });

        const token = generateToken(user);
        res.status(201).json({
            token,
            user: { id: user._id, username: user.username, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
                role: 'SOVEREIGN'
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ message: 'Sovereign Identity Synchronized.', username: user.username });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role }
        });
    } catch (err) {
        return sendError(res, 500, 'Authentication system fault. Please try again.', err);
    }
});

// POST /api/auth/guest - Access Sandbox Environment
app.post('/api/auth/guest', async (req, res) => {
    try {
        const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
        const guestUser = {
            _id: guestId,
            username: `Guest_${guestId.slice(-4).toUpperCase()}`,
            role: 'GUEST'
        };

        const token = generateToken(guestUser);
        res.json({
            token,
            user: { id: guestUser._id, username: guestUser.username, role: guestUser.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
            user.passwordHash = await hashPassword(newPassword);
        }

        await user.save();

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
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

        // 1. AGGRESSIVE DUPLICATE CHECK (Ignores punctuation, apostrophes, and casing)
        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const allQuests = await Quest.find({});
        const collision = allQuests.find(q => q.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTitle);

        if (collision) {
            return res.status(409).json({
                message: `Artifact strictly classified as Duplicate. Existing entry detected: "${collision.title}"`
            });
        }

        // 2. Allowlist fields — prevents mass assignment
        const safeBody = sanitizeQuestBody(req.body);
        const newQuest = new Quest(safeBody);
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

        for (let i = 0; i < quests.length; i++) {
            if (isAborted) break;

            const quest = quests[i];
            const oldClass = quest.classType;
            let newClass = null;

            try {
                // fetchGenresOnly: Lean AniList + MangaDex parallel fetch, NO Jikan.
                // Has its own hard 8s ceiling per source — will never hang indefinitely.
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

            const changed = newClass !== oldClass;
            if (changed) {
                quest.classType = newClass;
                await quest.save();
                updated++;
            }

            send({ type: 'progress', processed: i + 1, total: quests.length, title: quest.title, class: newClass, changed, updated });

            if (i < quests.length - 1) await sleep(400); // 400ms — only 2 APIs now, less throttle pressure
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
        const allQuests = await Quest.find({});
        const groups = {};

        allQuests.forEach(q => {
            // Aggressive normalization: lowercase and remove all non-alphanumeric
            const key = q.title.toLowerCase().replace(/[^a-z0-9]/g, '');
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

                const toKeep = matches[0];
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

// GET /api/proxy/image - Image proxy (SSRF-protected via allowlist)
app.get('/api/proxy/image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    // --- SSRF PROTECTION: Block Internal/Private Subnets, Allow Public Internet ---
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        
        // Prevent SSRF into internal networks, AWS metadata, and localhost
        if (isInternalHostname(hostname)) {
            console.warn(`[ImageProxy] SSRF BLOCKED: Rejected internal hostname "${hostname}"`);
            return res.status(403).send('Image origin located on internal/restricted network. Blocked.');
        }
    } catch {
        return res.status(400).send('Invalid URL format.');
    }

    const fetchWithTimeout = async (targetUrl, timeoutMs) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(targetUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site',
                    'Referer': new URL(targetUrl).origin + '/'
                },
                redirect: 'follow'
            });
            return response;
        } finally {
            clearTimeout(timer);
        }
    };

    try {
        let response;
        try {
            response = await fetchWithTimeout(url, 6000);
        } catch (firstErr) {
            // Retry once on timeout or network error
            console.warn(`[ImageProxy] First attempt failed (${firstErr.message}), retrying: ${url}`);
            response = await fetchWithTimeout(url, 7000);
        }

        if (!response.ok) {
            console.error(`[ImageProxy] Upstream Error: ${response.status} for ${url}`);
            return res.status(response.status).send(`Upstream server returned ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Browser: 24h cache. Vercel CDN edge: 1h (s-maxage).
        // stale-while-revalidate serves cached content while silently refreshing.
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Vary', 'Accept');

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("[ImageProxy] Critical Failure:", err.message, url);
        res.status(504).json({ error: "Failed to proxy image", message: err.message });
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

// ── Backward-compat wrappers ──────────────────────────────────────────────────
const classifyFromGenres = (genres) => {
    const scores = _genreScores(genres);
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return null;
    const priority = ['NECROMANCER', 'CONSTELLATION', 'MAGE', 'IRREGULAR', 'PLAYER'];
    return priority.find(cls => scores[cls] === maxScore) || null;
};

const inferClassFromTitle = (title) => {
    const scores = _titleScores(title);
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'IRREGULAR';
    const priority = ['NECROMANCER', 'CONSTELLATION', 'MAGE', 'IRREGULAR', 'PLAYER'];
    return priority.find(cls => scores[cls] === maxScore) || 'IRREGULAR';
};




module.exports = app;
