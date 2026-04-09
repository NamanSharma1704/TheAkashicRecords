const { getModel } = require('../models/modelFactory');

/**
 * Clones all manhwas from a template database to a target database connection.
 * @param {object} targetConn - The mongoose connection for the target guest sandbox.
 * @param {object} templateConn - The mongoose connection for the template database (e.g., test_records).
 */
const cloneFromTemplate = async (targetConn, templateConn) => {
    try {
        const SourceQuest = getModel(templateConn, 'Quest');
        const TargetQuest = getModel(targetConn, 'Quest');

        const templateQuests = await SourceQuest.find({});
        
        if (templateQuests.length > 0) {
            console.log(`[INIT] Cloning ${templateQuests.length} quests from [${templateConn.name}] to [${targetConn.name}]...`);
            
            // Prepare documents for insertion: Remove IDs to avoid collisions in the new DB
            const cleanedQuests = templateQuests.map(q => {
                const obj = q.toObject();
                delete obj._id;
                delete obj.__v;
                delete obj.createdAt;
                delete obj.updatedAt;
                return obj;
            });

            await TargetQuest.insertMany(cleanedQuests);
            console.log(`[INIT] Sandbox synchronization complete.`);
        } else {
            console.log(`[INIT] Template database [${templateConn.name}] is empty. Sandbox starts fresh.`);
        }
    } catch (err) {
        console.error("[INIT] Cloning failure:", err.message);
    }
};

const deduplicateDB = async (Quest) => {
    try {
        const allQuests = await Quest.find().sort({ lastRead: -1 });
        const seenTitles = new Set();
        const duplicates = [];

        for (const quest of allQuests) {
            const normalizedTitle = quest.title.trim().toLowerCase();
            if (seenTitles.has(normalizedTitle)) {
                duplicates.push(quest._id);
            } else {
                seenTitles.add(normalizedTitle);
            }
        }

        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate Manhwa. Removing...`);
            await Quest.deleteMany({ _id: { $in: duplicates } });
            console.log('Duplicates removed.');
        }
    } catch (e) {
        console.error("Deduplication failed", e);
    }
};

/**
 * Initialize a database connection.
 * @param {function} getConnection - Function to get the connection.
 * @param {object} templateConn - Optional template connection to clone from.
 */
const initDatabase = async (getConnection, templateConn = null) => {
    try {
        const conn = await getConnection();
        const Quest = getModel(conn, 'Quest');

        // If a template is provided, we clone from it.
        // Otherwise, we just ensure it exists and deduplicate.
        if (templateConn) {
            const count = await Quest.countDocuments();
            if (count === 0) {
                await cloneFromTemplate(conn, templateConn);
            }
        }

        await deduplicateDB(Quest);
        console.log(`Database Layer Ready [${conn.name}].`);
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
};

module.exports = { initDatabase, cloneFromTemplate };

