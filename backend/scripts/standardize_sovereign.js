const mongoose = require('mongoose');
const { hashPassword } = require('../utils/auth');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const UserSchema = new mongoose.Schema({
    username: String,
    passwordHash: String,
    role: String
});

async function standardize() {
    console.log("--- Sovereign Identity Standardization Protocol ---");
    const uri = process.env.MONGODB_URI;
    const baseUri = uri.substring(0, uri.lastIndexOf('/'));
    const passwordHash = await hashPassword("Naman@1704");

    const dbs = ['neo-scrolls', 'akashic_records'];

    for (const dbName of dbs) {
        try {
            const conn = await mongoose.createConnection(`${baseUri}/${dbName}`).asPromise();
            const User = conn.model('User', UserSchema);

            await User.findOneAndUpdate(
                { username: 'Naman' },
                {
                    username: 'Naman',
                    passwordHash: passwordHash,
                    role: 'SOVEREIGN'
                },
                { upsert: true, new: true }
            );

            console.log(`Database [${dbName}]: Sovereign Identity Standardized.`);
            await conn.close();
        } catch (err) {
            console.error(`Error on ${dbName}:`, err.message);
        }
    }
    process.exit(0);
}

standardize();
