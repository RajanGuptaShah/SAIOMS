require('dotenv').config();
const mongoose = require('mongoose');

async function drop() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/saioms');
        console.log('Connected to DB');
        await mongoose.connection.db.dropCollection('otpdocs');
        console.log('Dropped otpdocs collection successfully');
    } catch(err) {
        console.log('Error or already dropped:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
drop();
