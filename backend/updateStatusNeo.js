const mongoose = require('mongoose');
const connectDB = async () => {
    return mongoose.connect('mongodb://127.0.0.1:27017/neo-scrolls');
};

const QuestSchema = new mongoose.Schema({
    status: { type: String }
}, { strict: false, collection: 'manhwas' });

const Quest = mongoose.models.Quest || mongoose.model('Quest', QuestSchema);

async function updateStatus() {
    try {
        await connectDB();
        console.log('Connected to DB: neo-scrolls');

        const result = await Quest.updateMany(
            { status: 'ACTIVE' },
            { $set: { status: 'SEVERED' } }
        );

        console.log(`Updated ${result.modifiedCount} documents from ACTIVE to SEVERED.`);

        const result2 = await Quest.updateMany(
            { status: { $in: ['Active', 'active'] } },
            { $set: { status: 'SEVERED' } }
        );
        console.log(`Updated ${result2.modifiedCount} documents from Active/active to SEVERED.`);

        const activeCount = await Quest.countDocuments({ status: { $regex: /^active$/i } });
        console.log(`Remaining active count: ${activeCount}`);

        process.exit(0);
    } catch (err) {
        console.error('Error updating status:', err);
        process.exit(1);
    }
}

updateStatus();
