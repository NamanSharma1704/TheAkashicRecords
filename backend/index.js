const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const Quest = require('./models/Quest');
const UserSettings = require('./models/UserSettings');
const DailyQuest = require('./models/DailyQuest');
require('dotenv').config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────
// QUESTS
// ─────────────────────────────────────────

// GET /api/quests
app.get('/api/quests', async (req, res) => {
    try {
        const quests = await Quest.find().sort({ lastUpdated: -1 });
        res.json(quests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/quests
app.post('/api/quests', async (req, res) => {
    try {
        const { title, link } = req.body;
        if (!title || title.trim() === '' || title.trim() === '---')
            return res.status(400).json({ message: 'Valid title is required.' });
        if (!link || link.trim() === '')
            return res.status(400).json({ message: 'Valid link (coordinates) is required.' });

        const newQuest = new Quest(req.body);
        const savedQuest = await newQuest.save();
        res.status(201).json(savedQuest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/quests/:id
app.put('/api/quests/:id', async (req, res) => {
    try {
        const updatedQuest = await Quest.findByIdAndUpdate(
            req.params.id,
            { ...req.body, lastUpdated: new Date().toISOString() },
            { new: true }
        );
        res.json(updatedQuest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/quests/:id
app.delete('/api/quests/:id', async (req, res) => {
    try {
        await Quest.findByIdAndDelete(req.params.id);
        res.json({ message: 'Quest Purged.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────
// USER SETTINGS (single doc, userId=default)
// ─────────────────────────────────────────

// GET /api/settings
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await UserSettings.findOne({ userId: 'default' });
        if (!settings) settings = await UserSettings.create({ userId: 'default' });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PATCH /api/settings  { activeQuestId?, theme? }
app.patch('/api/settings', async (req, res) => {
    try {
        const settings = await UserSettings.findOneAndUpdate(
            { userId: 'default' },
            { $set: req.body },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─────────────────────────────────────────
// DAILY QUEST — ABSORB 5 STORIES
// ─────────────────────────────────────────

// GET /api/daily  — returns today's absorbed count
app.get('/api/daily', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const doc = await DailyQuest.findOne({ date: today });
        res.json({ date: today, count: doc ? doc.absorbedIds.length : 0, ids: doc ? doc.absorbedIds : [] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/daily/absorb  { questId: string }
// Records a newly absorbed quest for today. Capped at 5. Ignores duplicates.
app.post('/api/daily/absorb', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const { questId } = req.body;
        if (!questId) return res.status(400).json({ message: 'questId required' });

        let doc = await DailyQuest.findOne({ date: today });
        if (!doc) doc = new DailyQuest({ date: today, absorbedIds: [] });

        if (!doc.absorbedIds.includes(questId)) {
            if (doc.absorbedIds.length < 5) {
                doc.absorbedIds.push(questId);
            }
        }
        await doc.save();
        res.json({ date: today, count: doc.absorbedIds.length, ids: doc.absorbedIds });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Backend Pulse Active on Port ${PORT}`));
}

module.exports = app;
