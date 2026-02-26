const http = require('http');

async function testGuestQuests() {
    console.log("--- Akashic Sandbox Access Verification ---");

    // 1. Get Guest Token
    const guestRes = await new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/guest',
            method: 'POST'
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.end();
    });

    if (guestRes.status !== 200) {
        console.error("Failed to get guest token");
        return;
    }

    const token = guestRes.body.token;
    console.log("Guest Token Obtained.");

    // 2. Fetch Quests
    const questRes = await new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 5000,
            path: '/api/quests',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });
        req.end();
    });

    console.log(`Quests Status: ${questRes.status}`);
    if (questRes.status === 200) {
        console.log(`SUCCESS: Found ${questRes.body.length} items in sandbox.`);
        console.log("\n--- VERIFICATION COMPLETE ---");
    } else {
        console.error("FAILURE:", questRes.body);
    }
}

testGuestQuests();
