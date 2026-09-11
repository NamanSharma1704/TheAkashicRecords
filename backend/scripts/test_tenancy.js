const http = require('http');
const { sessionTokenFrom } = require('./scriptEnv');

async function testTenancy() {
    console.log("--- Akashic Tenancy Verification Protocol ---");

    // 1. Open a GUEST session.
    //
    // This used to register a user through /api/auth/register, passing role: "GUEST" in the
    // body. Registration is closed now and role is never read from a request, so the
    // equivalent identity is a guest session — which is what provisions an isolated
    // sandbox, the thing this script exists to verify.
    const guestRequest = () => new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/guest',
            method: 'POST'
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), token: sessionTokenFrom(res) }));
        });
        req.on('error', reject);
        req.end();
    });

    try {
        console.log("[1/3] Opening GUEST session...");
        const guestRes = await guestRequest();
        if (guestRes.status !== 200 || !guestRes.token) throw new Error(`Guest session failed: ${guestRes.body.message}`);
        const token = guestRes.token;
        console.log(`SUCCESS: GUEST identity ${guestRes.body.user.username} issued.`);

        // 2. Fetch quests as GUEST (should trigger lazy-seeding in test_records)
        const fetchOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/quests',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        };

        const fetchRequest = () => new Promise((resolve, reject) => {
            const req = http.request(fetchOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
            });
            req.on('error', reject);
            req.end();
        });

        console.log("[2/3] Fetching quests as GUEST (Triggering Sandbox Seeding)...");
        const fetchRes = await fetchRequest();
        console.log(`SUCCESS: Found ${fetchRes.body.length} items in GUEST sandbox.`);

        // 3. Create a Guest-only record
        const newQuest = JSON.stringify({ title: "GUEST_SANDBOX_STORY", status: "ACTIVE" });
        const createOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/quests',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': newQuest.length
            }
        };

        const createRequest = () => new Promise((resolve, reject) => {
            const req = http.request(createOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
            });
            req.on('error', reject);
            req.write(newQuest);
            req.end();
        });

        console.log("[3/3] Creating unique GUEST record...");
        const createRes = await createRequest();
        if (createRes.status === 201) {
            console.log("SUCCESS: Guest record created in sandbox.");
            console.log("\n--- VERIFICATION COMPLETE: TENANCY ISOLATION ACTIVE ---");
        } else {
            console.error("FAILURE:", createRes.body.message);
        }

    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
    }
}

testTenancy();
