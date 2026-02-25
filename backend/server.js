const app = require('./index');
const connectDB = require('./config/db');
const { initDatabase } = require('./config/init');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Local-only initialization (Side effects allowed here)
    await initDatabase(connectDB);

    app.listen(PORT, () => {
        console.log(`\n--- Local Development Pulse Active ---`);
        console.log(`Endpoint: http://localhost:${PORT}`);
        console.log(`Mode: ${process.env.NODE_ENV || 'development'}\n`);
    });
};

startServer();
