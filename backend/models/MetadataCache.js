const mongoose = require('mongoose');

// Responses from the metadata sources (AniList, MangaDex, MAL), shared by every tenant: the
// data is public, and one hit saves up to three outbound calls on every detail open and scan.
// Keyed by source and normalized title. `data` is null for a remembered miss. Each entry
// carries its own expiry, and the TTL index reaps it (Mongo's monitor runs about once a
// minute, so readers also check `expiresAt` themselves).
const metadataCacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
}, {
    collection: 'metadata_cache',
    minimize: false,
});

metadataCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.MetadataCache || mongoose.model('MetadataCache', metadataCacheSchema);
