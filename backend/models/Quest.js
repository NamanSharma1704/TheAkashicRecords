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
    lastRead: { type: Number, default: Date.now },
    // New-chapter tracking (see syncChapters in index.js). `newChapters` counts chapters the
    // sync found released since you last moved this quest forward; reading resets it.
    newChapters: { type: Number, default: 0 },
    chaptersCheckedAt: { type: Date, default: null, index: true },
    chaptersUpdatedAt: { type: Date, default: null },
    // Cover backfill (see backfillCovers in index.js): when a missing cover was last looked
    // up, so a title no source knows is retried weekly rather than on every run.
    coverCheckedAt: { type: Date, default: null },
    // Soft delete. A deleted quest is kept, hidden, so the app can offer Undo and a Trash;
    // it is purged for good after the retention window (see TRASH_RETENTION_MS in index.js).
    // Every read of the library filters on `deletedAt: null`, which also matches documents
    // written before this field existed.
    deletedAt: { type: Date, default: null, index: true }
}, {
    timestamps: true,
    collection: 'manhwas'
});

module.exports = { QuestSchema };
