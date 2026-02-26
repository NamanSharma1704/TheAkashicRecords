const mongoose = require('mongoose');

// Singleton document — one per user session (keyed by userId)
const userSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: 'default' },
    activeQuestId: { type: String, default: null },
    theme: { type: String, default: 'DARK', enum: ['DARK', 'LIGHT', 'SYSTEM'] },
    streak: { type: Number, default: 0 },           // Consecutive days read
    lastReadDate: { type: String, default: null },   // ISO date string (YYYY-MM-DD) of last read day
}, {
    timestamps: true,
    collection: 'user_settings'
});

module.exports = {
    userSettingsSchema,
    UserSettings: mongoose.models.UserSettings || mongoose.model('UserSettings', userSettingsSchema)
};
