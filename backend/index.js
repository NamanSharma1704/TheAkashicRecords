const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const Quest = require('./models/Quest');
const UserSettings = require('./models/UserSettings');
const DailyQuest = require('./models/DailyQuest');
require('dotenv').config();

const app = express();

const getTodayStr = () => new Date().toISOString().split('T')[0];

const BASE_QUESTS = [
    {
        title: 'TOWER OF GOD',
        status: 'ACTIVE',
        currentChapter: 580,
        totalChapters: 600,
        lastRead: Date.now(),
        classType: 'S-RANK',
        cover: 'https://images2.alphacoders.com/107/1079366.jpg',
        readLink: 'https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95'
    },
    {
        title: 'SOLO LEVELING',
        status: 'ACTIVE',
        currentChapter: 179,
        totalChapters: 179,
        lastRead: Date.now() - 86400000,
        classType: 'NATIONAL',
        cover: 'https://wallpaperaccess.com/full/2405389.jpg',
        readLink: 'https://sololevelingmanhwa.com/'
    },
    {
        title: 'THE BEGINNING AFTER THE END',
        status: 'IN_PROGRESS',
        currentChapter: 175,
        totalChapters: 175,
        lastRead: Date.now() - 172800000,
        classType: 'MAGE',
        cover: 'https://wallpapercave.com/wp/wp8922416.jpg',
        readLink: 'https://tapas.io/series/tbate-comic/info'
    }
];

const seedDB = async () => {
    const count = await Quest.countDocuments();
    if (count === 0) {
        console.log("Seeding Database with BASE_QUESTS...");
        await Quest.insertMany(BASE_QUESTS);
    }
};

const deduplicateDB = async () => {
    try {
        const allQuests = await Quest.find().sort({ lastRead: -1 });
        const seenTitles = new Set();
        const duplicates = [];

        for (const quest of allQuests) {
            const normalizedTitle = quest.title.trim().toLowerCase();
            if (seenTitles.has(normalizedTitle)) {
                duplicates.push(quest._id);
            } else {
                seenTitles.add(normalizedTitle);
            }
        }

        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate Manhwa. Removing...`);
            await Quest.deleteMany({ _id: { $in: duplicates } });
            console.log('Duplicates removed.');
        }
    } catch (e) {
        console.error("Deduplication failed", e);
    }
};

// Connect to Database
const initDB = async () => {
    try {
        await connectDB();
        await seedDB();
        await deduplicateDB();
    } catch (err) {
        console.error("DB Init Failure:", err);
    }
};

initDB();

// Middleware
app.use(cors());
app.use(express.json());

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
        const quests = await Quest.find().sort({ lastRead: -1 });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/quests - Create a new quest
app.post('/api/quests', async (req, res) => {
    try {
        await connectDB();
        const title = req.body.title;
        // Case-insensitive title check to prevent duplicates
        const existing = await Quest.findOne({ title: { $regex: new RegExp(`^${title.trim()}$`, "i") } });

        if (existing) {
            return res.status(409).json({ message: 'Artifact strictly classified as Duplicate.' });
        }

        const newQuest = new Quest(req.body);
        const savedQuest = await newQuest.save();
        res.status(201).json(savedQuest);
    } catch (err) {
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

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Backend Pulse Active on Port ${PORT}`));
}

module.exports = app;
