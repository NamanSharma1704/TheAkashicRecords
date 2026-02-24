const { MongoClient } = require('mongodb');

async function debugStatuses() {
    const uri = 'mongodb://127.0.0.1:27017';
    console.log(`Connecting to ${uri}...`);
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('neo-scrolls');
        const collection = db.collection('manhwas');

        // Show some raw documents to see accurate casing/types
        const docs = await collection.find({}).limit(5).toArray();
        console.log("Sample raw documents:");
        docs.forEach(d => console.log(d._id, '->', d.status));

        const severeds = await collection.countDocuments({ status: /severed/i });
        const actives = await collection.countDocuments({ status: /active/i });
        console.log(`\nCounters:\nSevered: ${severeds}\nActive: ${actives}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

debugStatuses();
