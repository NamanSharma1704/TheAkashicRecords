const mongoose = require('mongoose');

// Singleton document — one per user session (keyed by userId)
const userSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: 'default' },
    activeQuestId: { type: String, default: null },
    theme: { type: String, default: 'DARK', enum: ['DARK', 'LIGHT', 'SYSTEM'] },
    streak: { type: Number, default: 0 },           // Consecutive days read
    lastReadDate: { type: String, default: null },   // ISO date string (YYYY-MM-DD) of last read day
    // When titles were first evaluated for this archive. Until then, an evaluation grants what
    // the records already earn as "recognised" rather than announcing each one.
    achievementsSeededAt: { type: Date, default: null },
    // The title shown under the hunter's name (an achievement key), or none.
    equippedTitle: { type: String, default: null },
    // Quests. Daily: read in N different series (SERIES), or read N chapters (CHAPTERS), today.
    // Weekly: read N chapters between Monday and Sunday. Days are the reader's own.
    dailyGoalKind: { type: String, enum: ['SERIES', 'CHAPTERS'], default: 'SERIES' },
    dailyGoalTarget: { type: Number, default: 5 },
    weeklyGoalTarget: { type: Number, default: 50 },
    // The ACTIVE QUESTS list order (quest ids), so every device shows the same one. Empty
    // until the reader first drags a row (or a browser hands up the order it kept locally).
    questOrder: { type: [String], default: [] },
}, {
    timestamps: true,
    collection: 'user_settings'
});

module.exports = { userSettingsSchema };
