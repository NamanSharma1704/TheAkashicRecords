const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const Quest = require('./models/Quest');
const UserSettings = require('./models/UserSettings');
const DailyQuest = require('./models/DailyQuest');
require('dotenv').config();

const app = express();

const getTodayStr = () => new Date().toISOString().split('T')[0];

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
        const { title } = req.body;
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

module.exports = app;
