const http = require('http');

const adminData = JSON.stringify({
    username: "Naman",
    password: "system-override-2026",
    role: "SOVEREIGN"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': adminData.length
    }
};

console.log("--- Akashic System Setup: Initializing Sovereign ---");

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        const data = JSON.parse(body);
        if (res.statusCode === 201) {
            console.log("SUCCESS: Sovereign Identity Synchronized.");
            console.log("Username:", data.user.username);
            console.log("Token:", data.token);
        } else {
            console.error("FAILURE: Archive Collision or Registry Error.");
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
