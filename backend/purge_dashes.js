const http = require('http');

const deleteQuest = (id) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api/quests/${id}`,
            method: 'DELETE'
        };

        const req = http.request(options, (res) => {
            res.on('data', () => { });
            res.on('end', () => resolve());
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
};

http.get('http://localhost:5000/api/quests', async (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', async () => {
        try {
            const quests = JSON.parse(data);
            const problematic = quests.filter(q =>
                (q.title && q.title.trim() === '---') ||
                (q.link && q.link.trim() === '') ||
                (!q.title)
            );

            console.log(`Found ${problematic.length} problematic quests to purge.`);

            for (const q of problematic) {
                const id = q.id || q._id;
                console.log(`Purging ID: ${id}...`);
                await deleteQuest(id);
            }

            console.log('Purge complete.');
        } catch (error) {
            console.error('Error:', error);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching quests:', err.message);
});
