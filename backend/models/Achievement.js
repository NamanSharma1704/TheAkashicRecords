const mongoose = require('mongoose');

/**
 * A title the System granted (see utils/achievements.js for the catalogue). One document per
 * earned title; a title never earned has none. Earned is permanent: a later correction that
 * drops below the bar does not take a title back.
 *
 * `recognised` marks a title found in records that predate titles: the first evaluation of
 * an archive grants everything it already qualifies for, quietly, and says so once.
 */
const achievementSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    unlockedAt: { type: Date, required: true },
    recognised: { type: Boolean, default: false }
}, {
    collection: 'achievements'
});

module.exports = { achievementSchema };
