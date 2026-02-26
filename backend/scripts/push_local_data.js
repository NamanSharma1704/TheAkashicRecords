const https = require('https');
const mongoose = require('mongoose');
const { getTenantDb } = require('../config/db');
const { getModel } = require('../models/modelFactory');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PRODUCTION_URL = "the-akashic-records.vercel.app";

const loginData = JSON.stringify({
    username: "Naman",
    password: "Naman@1704"
});

const loginOptions = {
    hostname: PRODUCTION_URL,
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

async function migrate() {
    console.log("--- Akashic Data Bridge: Local to Atlas Migration ---");

    // 1. Get Quests from Local Database
    console.log("[1/4] Retrieving Local Records...");
    const conn = await getTenantDb('akashic_records');
    const Quest = getModel(conn, 'Quest');
    const localQuests = await Quest.find({});
    console.log(`Found ${localQuests.length} local records.`);
    await conn.close();

    // 2. Authenticate with Production
    console.log("[2/4] Establishing Production Secure Link...");
    const token = await new Promise((resolve, reject) => {
        const req = https.request(loginOptions, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const data = JSON.parse(body);
                resolve(data.token);
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });

    // 3. Push to Production
    console.log(`[3/4] Migrating ${localQuests.length} records to Atlas...`);
    for (const quest of localQuests) {
        const questData = {
            title: quest.title,
            status: quest.status,
            currentChapter: quest.currentChapter,
            totalChapters: quest.totalChapters,
            lastRead: quest.lastRead,
            classType: quest.classType,
            cover: quest.cover,
            readLink: quest.readLink
        };

        const postData = JSON.stringify(questData);
        const options = {
            hostname: PRODUCTION_URL,
            port: 443,
            path: '/api/quests',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        await new Promise((resolve) => {
            const req = https.request(options, (res) => {
                console.log(`Pushing [${quest.title}] -> Status: ${res.statusCode}`);
                resolve();
            });
            req.on('error', (e) => {
                console.error(`Failed to push [${quest.title}]:`, e.message);
                resolve();
            });
            req.write(postData);
            req.end();
        });
    }

    console.log("[4/4] Migration Sequence Complete.");
    process.exit(0);
}

migrate();
