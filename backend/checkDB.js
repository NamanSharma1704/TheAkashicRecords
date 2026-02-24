const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Quest = require('./models/Quest');

async function checkStatus() {
    try {
        await connectDB();
        const count = await Quest.countDocuments();
        const first = await Quest.findOne();

        console.log(`Connected to DB: ${mongoose.connection.name}`);
        console.log(`Document count: ${count}`);
        if (first) console.log(`First doc status: ${first.status}`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkStatus();
