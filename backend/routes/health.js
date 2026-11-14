/* GET /api/health. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { connectDB } = require('../config/db');
const { getModel } = require('../models/modelFactory');
const { LIVE, secretMatches, sendError } = require('../lib/common');

const router = express.Router();

// --- DIAGNOSTICS ---
router.get('/api/health', async (req, res) => {
    try {
        const conn = await connectDB();
        const dbStatus = conn.readyState;
        const statusMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        const body = {
            status: 'Pulse Active',
            database: statusMap[dbStatus] || 'unknown',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        };
        // The probe is public (the uptime workflow pings it), so the size of the owner's
        // library is reported only to a caller holding the admin secret.
        if (secretMatches(req.headers['x-system-secret'])) {
            body.documentCount = await getModel(conn, 'Quest').countDocuments(LIVE);
        }
        res.json(body);
    } catch (err) {
        return sendError(res, 500, 'Health probe failed: archive link unavailable.', err);
    }
});

module.exports = router;
