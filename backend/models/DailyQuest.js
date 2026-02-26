const mongoose = require('mongoose');

// Tracks which quest IDs were added each day for the ABSORB 5 STORIES daily quest.
// One document per day. TTL index auto-deletes entries after 7 days.
const dailyQuestSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // "YYYY-MM-DD"
    absorbedIds: { type: [String], default: [] },         // quest _id's added that day
    createdAt: { type: Date, default: Date.now }
}, {
    collection: 'daily_quests'
});

// Auto-delete after 7 days (604800 seconds)
dailyQuestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = {
    dailyQuestSchema,
    DailyQuest: mongoose.models.DailyQuest || mongoose.model('DailyQuest', dailyQuestSchema)
};
