const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cover: { type: String, default: "" },
    synopsis: { type: String, default: "" },
    totalChapters: { type: Number, default: 0 },
    currentChapter: { type: Number, default: 0 },
    status: { type: String, default: 'PLANNED' },
    classType: { type: String, default: 'UNKNOWN' },
    readLink: { type: String, default: "" },
    lastRead: { type: Number, default: Date.now }
}, {
    timestamps: true,
    collection: 'manhwas'
});

module.exports = mongoose.models.Quest || mongoose.model('Quest', QuestSchema);
