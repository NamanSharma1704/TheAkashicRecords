const { getTenantDb } = require('../config/db');
const { getModel } = require('../models/modelFactory');
const { initDatabase } = require('../config/init');

async function resetSandbox() {
    console.log("--- Akashic System Maintenance: Sandbox Reset Protocol ---");

    try {
        const dbName = 'test_records';
        const conn = await getTenantDb(dbName);
        console.log(`Connected to: ${dbName}`);

        const Quest = getModel(conn, 'Quest');
        const DailyQuest = getModel(conn, 'DailyQuest');
        const UserSettings = getModel(conn, 'UserSettings');

        // 1. Wipe current sandbox data
        console.log("Purging Sandbox Archives...");
        await Quest.deleteMany({});
        await DailyQuest.deleteMany({});
        await UserSettings.deleteMany({});
        console.log("Archive Purge Complete.");

        // 2. Re-initialize with Base Records
        console.log("Reloading Base Records...");
        // initDatabase takes a function that returns a connection
        await initDatabase(() => conn);

        console.log("\n--- MAINTENANCE COMPLETE: SANDBOX SYNCHRONIZED ---");
        process.exit(0);
    } catch (err) {
        console.error("CRITICAL MAINTENANCE FAILURE:", err.message);
        process.exit(1);
    }
}

resetSandbox();
