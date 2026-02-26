const https = require('https');

const PRODUCTION_URL = "the-akashic-records.vercel.app";
const LOCAL_URL = "localhost";
const PORT = process.argv.includes('--local') ? 5000 : 443;
const HOST = process.argv.includes('--local') ? LOCAL_URL : PRODUCTION_URL;

const loginData = JSON.stringify({
    username: "Naman",
    password: "Naman@1704"
});

const loginOptions = {
    hostname: HOST,
    port: PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

async function verify() {
    console.log(`--- Performance Verification (${HOST}:${PORT}) ---`);
    const globalStart = Date.now();

    try {
        // 1. Authenticate
        console.log("[1/2] Authenticating...");
        const token = await new Promise((resolve, reject) => {
            const options = { ...loginOptions };
            const req = (PORT === 443 ? https : require('http')).request(options, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    if (res.statusCode !== 200) return reject(new Error(`Login Failed: ${res.statusCode}`));
                    const data = JSON.parse(body);
                    resolve(data.token);
                });
            });
            req.on('error', reject);
            req.write(loginData);
            req.end();
        });
        console.log(`Authenticated in ${Date.now() - globalStart}ms`);

        // 2. Fetch Initial Data (BATCHED)
        const stateStart = Date.now();
        console.log("[2/2] Fetching Initial Data (Batched Heartbeat)...");
        const stateOptions = {
            hostname: HOST,
            port: PORT,
            path: '/api/boot/initial-data',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        };

        const result = await new Promise((resolve, reject) => {
            const options = { ...stateOptions };
            const req = (PORT === 443 ? https : require('http')).get(options, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    resolve({ status: res.statusCode, body });
                });
            });
            req.on('error', reject);
        });

        const duration = Date.now() - stateStart;
        console.log(`Status: ${result.status}`);
        console.log(`Latency: ${duration}ms`);

        if (result.status === 200) {
            console.log("SUCCESS: Environment is responsive and within timeout limits.");
            console.log("Response:", result.body);
        } else {
            console.error("FAILURE: Response indicates an issue.");
            console.error("Body:", result.body.substring(0, 200));
        }

    } catch (err) {
        console.error("CRITICAL ERROR during verification:", err.message);
    }

    process.exit(0);
}

verify();
