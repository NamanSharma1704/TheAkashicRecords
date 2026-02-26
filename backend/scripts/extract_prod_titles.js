const https = require('https');

const PRODUCTION_URL = "the-akashic-records.vercel.app";

const loginData = JSON.stringify({
    username: "Naman",
    password: "Naman@1704"
});

const loginOptions = {
    hostname: PRODUCTION_URL,
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

async function check() {
    console.log("--- Extracting Production Quest Titles ---");

    const token = await new Promise((resolve, reject) => {
        const req = https.request(loginOptions, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const data = JSON.parse(body);
                resolve(data.token);
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });

    const questOptions = {
        hostname: PRODUCTION_URL,
        port: 443,
        path: '/api/quests',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    https.get(questOptions, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            const quests = JSON.parse(body);
            console.log("Production Quest Titles (First 10):");
            quests.slice(0, 10).forEach(q => console.log(`- ${q.title}`));
            console.log(`... and ${quests.length - 10} more.`);
            process.exit(0);
        });
    });
}

check();
