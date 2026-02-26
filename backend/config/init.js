const { getModel } = require('../models/modelFactory');

const BASE_QUESTS = [
    {
        title: 'TOWER OF GOD',
        status: 'ACTIVE',
        currentChapter: 580,
        totalChapters: 600,
        lastRead: Date.now(),
        classType: 'S-RANK',
        cover: 'https://images2.alphacoders.com/107/1079366.jpg',
        readLink: 'https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95'
    },
    {
        title: 'SOLO LEVELING',
        status: 'ACTIVE',
        currentChapter: 179,
        totalChapters: 179,
        lastRead: Date.now() - 86400000,
        classType: 'NATIONAL',
        cover: 'https://wallpaperaccess.com/full/2405389.jpg',
        readLink: 'https://sololevelingmanhwa.com/'
    },
    {
        title: 'THE BEGINNING AFTER THE END',
        status: 'IN_PROGRESS',
        currentChapter: 175,
        totalChapters: 175,
        lastRead: Date.now() - 172800000,
        classType: 'MAGE',
        cover: 'https://wallpapercave.com/wp/wp8922416.jpg',
        readLink: 'https://tapas.io/series/tbate-comic/info'
    }
];

const seedDB = async (Quest) => {
    const count = await Quest.countDocuments();
    if (count === 0) {
        console.log("Seeding Database with BASE_QUESTS...");
        await Quest.insertMany(BASE_QUESTS);
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

const initDatabase = async (getConnection) => {
    try {
        // getConnection should be a function that returns the connection object
        const conn = await getConnection();
        const Quest = getModel(conn, 'Quest');

        await seedDB(Quest);
        await deduplicateDB(Quest);
        console.log(`Database Layer Ready [${conn.name}].`);
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
};

module.exports = { initDatabase };
