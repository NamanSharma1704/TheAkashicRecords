const https = require('https');
const { requireEnv, adminCredentials } = require('./scriptEnv');

const PRODUCTION_URL = "the-akashic-records.vercel.app";

// Secret and credentials come from backend/.env. They were literals here, in a public
// repository — treat any value that was ever committed to this file as compromised.
const adminData = JSON.stringify({
    systemSecret: requireEnv('SYSTEM_ADMIN_SECRET'),
    ...adminCredentials()
});

const options = {
    hostname: PRODUCTION_URL,
    port: 443,
    path: '/api/auth/upsert-sovereign',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(adminData)
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
