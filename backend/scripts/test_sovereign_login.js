const http = require('http');

async function testSovereignLogin() {
    console.log("--- Akashic Sovereign Identity Verification ---");

    const adminData = JSON.stringify({
        username: "Naman",
        password: "system-override-2026"
    });

    const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': adminData.length
        }
    };

    try {
        const res = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
            });
            req.on('error', reject);
            req.write(adminData);
            req.end();
        });

        console.log(`Status: ${res.status}`);
        if (res.status === 200) {
            console.log("SUCCESS: Sovereign authenticated.");
            console.log(`Identity: ${res.body.user.username}`);
            console.log(`Role: ${res.body.user.role}`);
            console.log("\n--- VERIFICATION COMPLETE ---");
        } else {
            console.error("FAILURE:", res.body.message);
        }
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
    }
}

testSovereignLogin();
