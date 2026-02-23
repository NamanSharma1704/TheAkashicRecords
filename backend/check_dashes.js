const http = require('http');

http.get('http://localhost:5000/api/quests', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const quests = JSON.parse(data);
            const problematic = quests.filter(q =>
                (q.title && q.title.trim() === '---') ||
                (q.link && q.link.trim() === '') ||
                (!q.title)
            );
            console.log(`Found ${problematic.length} problematic quests:`);
            problematic.forEach(q => {
                console.log(`ID: ${q._id || q.id}, Title: "${q.title}", Link: "${q.link}"`);
            });
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching quests:', err.message);
});
