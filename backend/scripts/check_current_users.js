const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Fix path

async function check() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log(`Connecting to: ${uri}`);
        await mongoose.connect(uri);

        const User = mongoose.model('User', new mongoose.Schema({ username: String }));
        const users = await User.find({});

        console.log(`Users found in [${mongoose.connection.name}]:`);
        users.forEach(u => console.log(`- ${u.username}`));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

check();
