const { MongoClient } = require('mongodb');

async function findDb() {
    const uri = 'mongodb://127.0.0.1:27017';
    console.log(`Testing connection to ${uri}...`);
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();
        for (let db of dbs.databases) {
            const currentDb = client.db(db.name);
            const collections = await currentDb.listCollections().toArray();
            let hasManhwas = false;
            for (let col of collections) {
                if (col.name.toLowerCase().includes('manhwa')) {
                    hasManhwas = true;
                    const count = await currentDb.collection(col.name).countDocuments();
                    console.log(`Found '${col.name}' collection in DB: ${db.name}, count: ${count}`);

                    if (count > 0) {
                        const docs = await currentDb.collection(col.name).find().limit(2).toArray();
                        console.log(`Sample status: ${docs.map(d => d.status).join(', ')}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

findDb();
