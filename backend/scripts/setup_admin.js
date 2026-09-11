const http = require('http');
const { requireEnv, adminCredentials } = require('./scriptEnv');

/**
 * Create or reset the Sovereign account on a LOCAL backend (localhost:5000).
 *
 * This previously posted `role: "SOVEREIGN"` to /api/auth/register — the anonymous
 * privilege-escalation path that has since been closed. The supported route is
 * /api/auth/upsert-sovereign, gated on SYSTEM_ADMIN_SECRET. Credentials and the secret
 * are read from backend/.env; none are stored in this file.
 */
const adminData = JSON.stringify({
    systemSecret: requireEnv('SYSTEM_ADMIN_SECRET'),
    ...adminCredentials()
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/upsert-sovereign',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(adminData)
    }
};

console.log("--- Akashic System Setup: Initializing Sovereign ---");

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        const data = JSON.parse(body);
        if (res.statusCode === 200) {
            console.log("SUCCESS: Sovereign Identity Synchronized.");
            console.log("Username:", data.username);
        } else {
            console.error("FAILURE: Sovereign synchronisation refused.");
            console.error("Status Code:", res.statusCode);
            console.error("Message:", data.message);
        }
    });
});

req.on('error', (err) => {
    console.error("CRITICAL: Communication Link Severed. Is the backend running?");
    console.error(err.message);
});

req.write(adminData);
req.end();
