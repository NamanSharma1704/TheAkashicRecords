const app = require('./index');
const { connectDB } = require('./config/db');
const port = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`[PULSE] System Online: Port ${port}`);
        });
    } catch (err) {
        console.error("[CRITICAL] Core Link Failed:", err.message);
        process.exit(1);
    }
};

startServer();
