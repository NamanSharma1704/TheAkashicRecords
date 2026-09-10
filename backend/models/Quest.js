const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    // Punctuation- and case-insensitive form of `title`, indexed so duplicate detection
    // is a single indexed lookup instead of loading the whole collection into Node.
    //
    // Indexed but NOT unique: this collection predates the field, and building a unique
    // index over documents that already contain near-duplicates would fail. Uniqueness is
    // still enforced by the create handler, and the index can be tightened to unique once
    // backfill_normalized_titles.js has run and purge-duplicates reports nothing.
    normalizedTitle: { type: String, index: true, default: '' },
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

module.exports = {
    QuestSchema,
    Quest: mongoose.models.Quest || mongoose.model('Quest', QuestSchema)
};
