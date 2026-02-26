const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { connectDB, getTenantDb } = require('./config/db');
const { initDatabase } = require('./config/init');
const { getModel } = require('./models/modelFactory');
const { fetchAniList, fetchMangaDex, fetchJikan, fetchBest } = require('./utils/metadataProxy');
const User = require('./models/User');
const { hashPassword, comparePassword, generateToken, verifyToken, JWT_SECRET } = require('./utils/auth');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

const getTodayStr = () => new Date().toISOString().split('T')[0];

// Middleware
app.use(cors());
app.use(express.json());

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
        let user;
        // Check if this is a virtual guest identity
        if (decoded.id && typeof decoded.id === 'string' && decoded.id.startsWith('guest_')) {
            user = {
                _id: decoded.id,
                username: decoded.username,
                role: 'GUEST'
            };
        } else {
            user = await User.findById(decoded.id);
        }

        if (!user) return res.status(401).json({ message: 'Authentication Protocol Terminated: Subject Unknown.' });

        req.user = user;

        // --- MULTI-TENANCY LOGIC ---
        // SOVEREIGN -> akashic_records, GUEST -> test_records
        const dbName = user.role === 'SOVEREIGN' ? 'akashic_records' : 'test_records';
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
        if (systemSecret !== JWT_SECRET) {
            return res.status(403).json({ message: 'Forbidden: Secret Link Unauthorized.' });
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
            { upsert: true, new: true }
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
        const dbName = mongoose.connection ? mongoose.connection.name : 'Unknown';
        console.log(`[AUTH] Login attempt: "${username}" (DB: ${dbName})`);

        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user) {
            console.log(`[AUTH] User not found: "${username}"`);
            return res.status(401).json({ message: 'Access Denied: Subject Unknown.' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Password Mismatch.' });

        // Update last login
        user.lastLogin = Date.now();
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

app.post('/api/quests', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const { title } = req.body;
        if (!title) return res.status(400).json({ message: "Title required" });

        // 1. AGGRESSIVE DUPLICATE CHECK (Ignores punctuation, apostrophes, and casing)
        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const allQuests = await Quest.find({});
        const collision = allQuests.find(q => q.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTitle);

        if (collision) {
            return res.status(409).json({
                message: `Artifact strictly classified as Duplicate. Existing entry detected: "${collision.title}"`
            });
        }

        const newQuest = new Quest(req.body);
        const savedQuest = await newQuest.save();
        res.status(201).json(savedQuest);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Database Archive Collision: Title already exists in the records." });
        }
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/quests/:id - Update a quest
app.put('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        const UserSettings = getModel(req.dbConn, 'UserSettings');
        const DailyQuest = getModel(req.dbConn, 'DailyQuest');
        const questId = req.params.id;
        const body = req.body;

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
            { new: true }
        );
        res.json(updatedQuest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/quests/:id - Delete a quest
app.delete('/api/quests/:id', authenticate, async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        await Quest.findByIdAndDelete(req.params.id);
        res.json({ message: 'Quest Purged.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/admin/bulk-classify - Admin only migration
app.post('/api/admin/bulk-classify', authenticate, checkRole('SOVEREIGN'), async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        console.log("[Admin] Starting Bulk Classification...");
        const quests = await Quest.find({
            $or: [
                { classType: 'UNKNOWN' },
                { classType: { $exists: false } },
                { classType: '' },
                { classType: 'PLAYER' } // Re-evaluate players to see if they fit better classes
            ]
        });

        let updated = 0;
        for (const quest of quests) {
            const newClass = inferClassFromTitle(quest.title);
            if (newClass !== quest.classType) {
                quest.classType = newClass;
                await quest.save();
                updated++;
            }
        }

        res.json({ message: "Classification Synchronized", total: quests.length, updated });
    } catch (err) {
        console.error("[Admin] Classification Failure:", err.message);
        res.status(500).json({ error: "Classification Engine Failure" });
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
        } else if (source === 'MANGADEX') {
            data = await fetchMangaDex(title);
        } else if (source === 'MAL') {
            data = await fetchJikan(title);
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

// GET /api/proxy/image - Image proxy to bypass CORS/CORP blocks
app.get('/api/proxy/image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
        const fetchOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Referer': new URL(url).origin + '/'
            },
            redirect: 'follow'
        };

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            console.error(`[ImageProxy] Upstream Error: ${response.status} for ${url}`);
            return res.status(response.status).send(`Upstream server returned ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Cache images for 24 hours
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("[ImageProxy] Critical Failure:", err.message, url);
        res.status(500).json({ error: "Failed to proxy image", message: err.message });
    }
});

const inferClassFromTitle = (title) => {
    const t = title.toLowerCase();
    if (t.includes('necromancer') || t.includes('undead')) return "NECROMANCER";
    if (t.includes('mage') || t.includes('magic') || t.includes('constellation') || t.includes('star')) return "CONSTELLATION";
    if (t.includes('irregular') || t.includes('tower')) return "IRREGULAR";
    if (t.includes('return') || t.includes('reincarnat') || t.includes('wizard')) return "MAGE";
    if (t.includes('player') || t.includes('ranker') || t.includes('level')) return "PLAYER";
    return "PLAYER";
};

module.exports = app;
