const http = require('http');

async function testGuestLogin() {
    console.log("--- Akashic Anonymous Entry Verification ---");

    const guestOptions = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/auth/guest',
        method: 'POST',
        headers: { 'Content-Length': 0 }
    };

    const guestRequest = () => new Promise((resolve, reject) => {
        const req = http.request(guestOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    console.log(`Status: ${res.statusCode}`);
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    console.error("Non-JSON Body Received:", body.substring(0, 100));
                    resolve({ status: res.statusCode, body: { message: "Invalid Response Format" } });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });

    try {
        console.log("[1/2] Requesting Anonymous Entry...");
        const res = await guestRequest();

        if (res.status === 200) {
            console.log("SUCCESS: Guest token received.");
            console.log(`Identity: ${res.body.user.username}`);
            console.log(`Role: ${res.body.user.role}`);

            if (res.body.user.role === 'GUEST') {
                console.log("[2/2] Access Protocol Validated: Sandbox Route Active.");
                console.log("\n--- VERIFICATION COMPLETE ---");
            } else {
                console.error("FAILURE: Invalid role assigned to guest.");
            }
        } else {
            console.error("FAILURE:", res.body.message);
        }
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
    }
}

testGuestLogin();
