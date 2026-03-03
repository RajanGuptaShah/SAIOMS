/**
 * SAIOMS — MongoDB connection via Mongoose
 */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'saioms';

async function connectDB() {
    try {
        await mongoose.connect(`${MONGO_URI}/${DB_NAME}`, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`[DB] Connected → ${MONGO_URI}/${DB_NAME}`);
    } catch (err) {
        console.error('[DB] Connection failed:', err.message);
        // Don't crash — service still works partially
        console.warn('[DB] Running without database — some features disabled.');
    }
}

module.exports = { connectDB };
