const mongoose = require('mongoose');

// Singleton document — one per user session (keyed by userId)
const userSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: 'default' },
    activeQuestId: { type: String, default: null },
    theme: { type: String, default: 'DARK', enum: ['DARK', 'LIGHT', 'SYSTEM'] },
}, {
    timestamps: true,
    collection: 'user_settings'
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);
