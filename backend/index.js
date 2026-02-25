const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initDatabase } = require('./config/init');
const Quest = require('./models/Quest');
const UserSettings = require('./models/UserSettings');
const DailyQuest = require('./models/DailyQuest');
const { fetchAniList, fetchMangaDex, fetchJikan, fetchBest } = require('./utils/metadataProxy');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

const getTodayStr = () => new Date().toISOString().split('T')[0];

// Middleware
app.use(cors());
app.use(express.json());

// --- DIAGNOSTICS ---
app.get('/api/health', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const dbStatus = mongoose.connection.readyState;
        const statusMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        await connectDB();
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

// --- ROUTES ---

// GET /api/user/state - Fetch streak and daily absorb
app.get('/api/user/state', async (req, res) => {
    try {
        await connectDB();
        let settings = await UserSettings.findOne({ userId: 'default' });
        if (!settings) settings = await UserSettings.create({ userId: 'default' });

        const today = getTodayStr();
        let daily = await DailyQuest.findOne({ date: today });
        if (!daily) daily = await DailyQuest.create({ date: today });

        res.json({
            streak: settings.streak,
            lastReadDate: settings.lastReadDate,
            dailyAbsorbed: daily.absorbedIds.length,
            absorbedIds: daily.absorbedIds
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/quests - Fetch all quests
app.get('/api/quests', async (req, res) => {
    try {
        await connectDB();
        let quests = await Quest.find().sort({ lastRead: -1 });

        console.log(`[API] Quests requested. Found: ${quests.length} documents.`);

        // Lazy-seed if DB is completely empty (common on first production run)
        if (quests.length === 0) {
            console.log('[API] Database empty. Attempting lazy seeding...');
            await initDatabase(connectDB);
            quests = await Quest.find().sort({ lastRead: -1 });
            console.log(`[API] Seeding complete. New count: ${quests.length}`);
        }

        res.json(quests);
    } catch (err) {
        console.error('[API] Error fetching quests:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/quests', async (req, res) => {
    try {
        await connectDB();
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
app.put('/api/quests/:id', async (req, res) => {
    try {
        await connectDB();
        const questId = req.params.id;
        const body = req.body;

        if (body.currentChapter !== undefined) {
            const today = getTodayStr();

            let settings = await UserSettings.findOne({ userId: 'default' });
            if (!settings) settings = await UserSettings.create({ userId: 'default' });

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
app.delete('/api/quests/:id', async (req, res) => {
    try {
        await connectDB();
        await Quest.findByIdAndDelete(req.params.id);
        res.json({ message: 'Quest Purged.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/admin/bulk-classify - Admin only migration
app.post('/api/admin/bulk-classify', async (req, res) => {
    try {
        await connectDB();
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
app.post('/api/admin/purge-duplicates', async (req, res) => {
    try {
        await connectDB();
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
app.get('/api/proxy/metadata', async (req, res) => {
    const { title, source } = req.query;
    if (!title) return res.status(400).json({ error: "Title required." });

    console.log(`[Proxy] Fetching metadata for: ${title} (Source: ${source || 'AUTO'})`);

    try {
        await connectDB();
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
                // Removed Referer as many sites block hotlinking if Referer is present but "wrong"
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
