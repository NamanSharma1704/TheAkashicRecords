const mongoose = require('mongoose');

const questSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    coverUrl: { type: String, default: "" },
    currentChapter: { type: Number, default: 0 },
    totalChapters: { type: Number, default: null },
    status: { type: String, default: 'READING' },
    classType: { type: String, default: 'PLAYER' },
    link: { type: String, default: "" },
    synopsis: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    lastUpdated: { type: String, default: () => new Date().toISOString() }
}, {
    timestamps: true,
    collection: 'manhwas' // Shared with NeoScrolls project
});

module.exports = mongoose.model('Quest', questSchema);

