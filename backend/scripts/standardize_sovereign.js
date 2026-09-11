const mongoose = require('mongoose');
// Loads backend/.env (the previous path pointed at backend/scripts/.env, which does not exist).
const { adminCredentials } = require('./scriptEnv');
const { hashPassword } = require('../utils/auth');

const UserSchema = new mongoose.Schema({
    username: String,
    passwordHash: String,
    role: String,
    // Declared so strict mode keeps it on the update below.
    passwordChangedAt: Date
});

async function standardize() {
    console.log("--- Sovereign Identity Standardization Protocol ---");
    const uri = process.env.MONGODB_URI;
    const baseUri = uri.substring(0, uri.lastIndexOf('/'));
    // From backend/.env. The username and password were literals here, in a public repo.
    const { username, password } = adminCredentials();
    const passwordHash = await hashPassword(password);

    const dbs = ['neo-scrolls', 'akashic_records'];

    for (const dbName of dbs) {
        try {
            const conn = await mongoose.createConnection(`${baseUri}/${dbName}`).asPromise();
            const User = conn.model('User', UserSchema);

            await User.findOneAndUpdate(
                { username },
                {
                    username,
                    passwordHash: passwordHash,
                    role: 'SOVEREIGN',
                    // Retire any session issued before this reset (see authenticate()).
                    passwordChangedAt: new Date(Date.now() - 1000)
                },
                { upsert: true, returnDocument: 'after' }
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
