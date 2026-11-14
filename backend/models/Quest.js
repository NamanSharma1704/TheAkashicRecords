const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    // Punctuation- and case-insensitive form of `title`, indexed so duplicate detection
    // is a single indexed lookup instead of loading the whole collection into Node.
    //
    // Indexed but NOT unique. Uniqueness among LIVE records is enforced by the create and
    // rename handlers; a unique index would also count the Trash, where a deleted copy may
    // share the key with a live one until it is purged. Every write path sets this field,
    // and the owner's archive was backfilled on 2026-11-06 (backfill_normalized_titles.js).
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
    // RELEASE RADAR: the days the source recorded releases (YYYY-MM-DD, newest first, at most
    // 40; lib/radar.js, refreshed daily when the series page asks), and the days the tracker
    // itself saw a fresh release (`foundDays`: a find of 3 chapters or fewer on a series also
    // checked within 3 days, so a backlog caught up on is never dated as a release). Which
    // source, and when it was last asked. A cache of public facts, left out of the list and the
    // backup.
    releaseDays: { type: [String], default: undefined, select: false },
    foundDays: { type: [String], default: undefined, select: false },
    releaseSource: { type: String, default: null, select: false },
    releasesFetchedAt: { type: Date, default: null, select: false },
    // Where the chapter checks found this series: each source's own id, kept the first time a
    // title search matches exactly, so later checks ask the source directly instead of
    // searching again (see checkLatestChapter in utils/metadataProxy.js). Cleared on a rename.
    // Internal: `select: false` keeps them out of every reply unless asked for (+sourceIds).
    sourceIds: {
        type: new mongoose.Schema({
            mangadex: { type: String, default: null },
            anilist: { type: Number, default: null },
            mangaupdates: { type: String, default: null },
        }, { _id: false }),
        default: undefined,
        select: false,
    },
    // When a title search last found nothing at a source, so that source is searched again
    // weekly rather than on every check. Cleared on a rename, and per source on a match.
    sourceMissedAt: {
        type: new mongoose.Schema({
            mangadex: { type: Date, default: null },
            anilist: { type: Date, default: null },
            mangaupdates: { type: Date, default: null },
        }, { _id: false }),
        default: undefined,
        select: false,
    },
    // Cover backfill (see backfillCovers in index.js): when a missing cover was last looked
    // up, so a title no source knows is retried weekly rather than on every run.
    coverCheckedAt: { type: Date, default: null },
    // The reader's own score, 1-10 (the Hunter's Appraisal); null until they give one.
    rating: { type: Number, default: null, min: 1, max: 10 },
    // When the series became CONQUERED (server-stamped; cleared if it is reopened). Records
    // conquered before this field existed have no date.
    conqueredAt: { type: Date, default: null },
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
