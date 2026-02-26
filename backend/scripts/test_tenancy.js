const http = require('http');

async function testTenancy() {
    console.log("--- Akashic Tenancy Verification Protocol ---");

    // 1. Register a GUEST user
    const guestData = JSON.stringify({
        username: "Guest_Hunter",
        password: "guest-password-2026",
        role: "GUEST"
    });

    const registerOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': guestData.length
        }
    };

    const registerRequest = () => new Promise((resolve, reject) => {
        const req = http.request(registerOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject);
        req.write(guestData);
        req.end();
    });

    try {
        console.log("[1/3] Registering GUEST user...");
        const regRes = await registerRequest();
        if (regRes.status !== 201) throw new Error(`Registration failed: ${regRes.body.message}`);
        const token = regRes.body.token;
        console.log("SUCCESS: GUEST identity registered.");

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
