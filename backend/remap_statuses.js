const mongoose = require('mongoose');
const Quest = require('./models/Quest');
require('dotenv').config();

// Map NeoScrolls statuses -> Akashic Records statuses
const STATUS_MAP = {
    'READING': 'ACTIVE',
    'COMPLETED': 'CONQUERED',
    'PLAN_TO_READ': 'ACTIVE',
    'ON_HOLD': 'SEVERED',
    'DROPPED': 'SEVERED',
};

async function remapStatuses() {
    await mongoose.connect(process.env.MONGODB_URI);
    const all = await Quest.find();
    console.log('Total records:', all.length);
    let updated = 0;
    for (const q of all) {
        const mapped = STATUS_MAP[q.status];
        if (mapped) {
            await Quest.findByIdAndUpdate(q._id, { status: mapped });
            console.log(`  "${q.title}": ${q.status} -> ${mapped}`);
            updated++;
        }
    }
    const counts = {};
    (await Quest.find()).forEach(q => { counts[q.status] = (counts[q.status] || 0) + 1; });
    console.log('\nFinal status counts:', JSON.stringify(counts));
    console.log('Updated:', updated);
    process.exit(0);
}

remapStatuses().catch(e => { console.error(e); process.exit(1); });
