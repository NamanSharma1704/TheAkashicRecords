const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Global is used here to maintain a cached connection across hot-reloads
 * in development and serverless function invocations in production.
 */
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        if (!process.env.MONGODB_URI) {
            throw new Error('Please define the MONGODB_URI environment variable inside your Vercel Dashboard');
        }

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            console.log('MongoDB Synchronized.');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('Database Sync Failure:', e.message);
        // Important: in serverless, we don't want to process.exit(1) as it kills the instance
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
