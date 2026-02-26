const https = require('https');

const PRODUCTION_URL = "the-akashic-records.vercel.app";

const adminData = JSON.stringify({
    systemSecret: "akashic-secret-key-system-override-v1",
    username: "Naman",
    password: "Naman@1704"
});

const options = {
    hostname: PRODUCTION_URL,
    port: 443,
    path: '/api/auth/upsert-sovereign',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': adminData.length
    }
};

console.log(`--- Akashic Identity Reset: Standardizing Sovereign on ${PRODUCTION_URL} ---`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (res.statusCode === 200) {
                console.log("SUCCESS: Sovereign Identity Standardized locally and remotely.");
                console.log("New Access Key Active for:", data.username);
            } else {
                console.error("FAILURE: System Access Fault.");
                console.error("Status Code:", res.statusCode);
                console.error("Message:", data.message || "Unknown Registry Error");
            }
        } catch (e) {
            console.error("FAILURE: Protocol Desynchronization.");
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
