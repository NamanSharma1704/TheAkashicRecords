/**
 * Canonical form of a quest title, used for duplicate detection.
 *
 * Lowercases and strips everything that is not a letter or digit, so "Solo Leveling",
 * "solo-leveling" and "Solo Leveling!" all collapse to the same key.
 *
 * Kept in one place because the value is persisted on the document as `normalizedTitle`
 * and indexed: if the create path, the update path and the backfill script ever disagreed
 * about the rule, stored keys would stop matching freshly computed ones and duplicates
 * would slip through.
 */
const normalizeTitle = (title) => String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

module.exports = { normalizeTitle };
