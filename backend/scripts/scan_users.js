const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function scan() {
    console.log("--- Akashic User Investigation Core ---");
    const uri = process.env.MONGODB_URI;
    const baseUri = uri.substring(0, uri.lastIndexOf('/'));

    const dbs = ['neo-scrolls', 'akashic_records', 'test_records'];

    for (const dbName of dbs) {
        try {
            const conn = await mongoose.createConnection(`${baseUri}/${dbName}`).asPromise();
            const User = conn.model('User', new mongoose.Schema({ username: String }));
            const user = await User.findOne({ username: 'Naman' });

            console.log(`Database: [${dbName}] -> ${user ? 'FOUND' : 'NOT FOUND'}`);
            await conn.close();
        } catch (err) {
            console.error(`Error scanning ${dbName}:`, err.message);
        }
    }
    process.exit(0);
}

scan();
