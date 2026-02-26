const https = require('https');

const PRODUCTION_URL = "the-akashic-records.vercel.app";

const adminData = JSON.stringify({
    username: "Naman",
    password: "system-override-2026",
    role: "SOVEREIGN"
});

const options = {
    hostname: PRODUCTION_URL,
    port: 443,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': adminData.length
    }
};

console.log(`--- Akashic Remote Sync: Synchronizing to ${PRODUCTION_URL} ---`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (res.statusCode === 201) {
                console.log("SUCCESS: Sovereign Identity Synchronized to ATLAS.");
                console.log("Username:", data.user.username);
            } else {
                console.error("FAILURE: Archive Collision or Registry Error.");
                console.error("Status Code:", res.statusCode);
                console.error("Message:", data.message || "Unknown Registry Fault");
            }
        } catch (e) {
            console.error("FAILURE: Invalid Response from Production Archival Node.");
            console.error("Raw Response:", body.substring(0, 200));
        }
    });
});

req.on('error', (err) => {
    console.error("CRITICAL: Production Link Severed.");
    console.error(err.message);
});

req.write(adminData);
req.end();
