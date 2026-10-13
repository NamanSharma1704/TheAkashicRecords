const mongoose = require('mongoose');

/**
 * One chapter change on a quest — the history behind the reading stats.
 *
 * `delta` is signed: moving a chapter back (a correction, or an Undo) logs a negative entry,
 * so summing a day gives the chapters actually read that day rather than every click. `day`
 * is the reader's own calendar day (their timezone, from the X-Timezone header), the same
 * day the streak counts in.
 */
const readingLogSchema = new mongoose.Schema({
    questId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, default: '' },
    from: { type: Number, required: true },
    to: { type: Number, required: true },
    delta: { type: Number, required: true },
    day: { type: String, required: true, index: true },
    at: { type: Date, default: Date.now }
}, {
    collection: 'reading_log'
});

module.exports = { readingLogSchema };
