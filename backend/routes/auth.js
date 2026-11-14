/* Sign-in, the guest sandbox, sign-out, and changing credentials. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { connectDB, getTenantDb } = require('../config/db');
const { initDatabase } = require('../config/init');
const { seedGuestHistory } = require('../utils/guestHistory');
const User = require('../models/User');
const { clearAuthCookie, comparePassword, generateToken, getTokenTtlMs, hashPassword, setAuthCookie } = require('../utils/auth');
const { escapeRegex, secretMatches, sendError } = require('../lib/common');
const { tzOf } = require('../lib/days');
const { debugLog } = require('../lib/log');
const { SANDBOX_HARD_CAP, SANDBOX_SOFT_THRESHOLD, countGuestSandboxes, purgeStaleSandboxes, resilientPurge } = require('../lib/sandboxes');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// --- AUTH ROUTES ---

// POST /api/auth/upsert-sovereign - Administrative Identity Sync (Internal)
router.post('/api/auth/upsert-sovereign', async (req, res) => {
    try {
        const { systemSecret, username, password } = req.body || {};
        if (!secretMatches(systemSecret)) {
            return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
        }
        if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ message: 'A username and a password of at least 8 characters are required.' });
        }

        await connectDB();
        const passwordHash = await hashPassword(password);

        const user = await User.findOneAndUpdate(
            { username },
            {
                username,
                passwordHash,
                role: 'SOVEREIGN',
                // Rotating the Sovereign password through this route also retires any
                // session that was already outstanding.
                passwordChangedAt: new Date(Date.now() - 1000)
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ message: 'Sovereign Identity Synchronized.', username: user.username });
    } catch (err) {
        return sendError(res, 500, 'Sovereign synchronization failed.', err);
    }
});

// POST /api/auth/login - Synchronize Hunter Identity
router.post('/api/auth/login', async (req, res) => {
    try {
        await connectDB();
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        debugLog(`[AUTH] Login attempt: "${username}"`);

        // Escape regex special chars to prevent ReDoS / injection
        const safeUsername = escapeRegex(username.trim());
        const user = await User.findOne({ username: { $regex: new RegExp(`^${safeUsername}$`, 'i') } });
        if (!user) {
            // Generic message — don't reveal whether user exists
            return res.status(401).json({ message: 'Access Denied: Invalid credentials.' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Invalid credentials.' });

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        const token = generateToken(user);
        setAuthCookie(res, token, user.role);
        res.json({
            user: { id: user._id, username: user.username, role: user.role },
            expiresAt: Date.now() + getTokenTtlMs(user.role)
        });
    } catch (err) {
        return sendError(res, 500, 'Authentication system fault. Please try again.', err);
    }
});

// POST /api/auth/guest - Access Sandbox Environment (Cloned from test_records)
router.post('/api/auth/guest', async (req, res) => {
    try {
        await connectDB();

        // Clear out expired sandboxes before counting, so a visitor is only ever turned
        // away by genuinely concurrent demand rather than by accumulated debris.
        let sandboxCount = await countGuestSandboxes();
        if (sandboxCount !== null && sandboxCount >= SANDBOX_SOFT_THRESHOLD) {
            console.log(`[GUEST_INIT] ${sandboxCount} sandboxes live; running an opportunistic reap.`);
            try {
                await purgeStaleSandboxes();
                sandboxCount = await countGuestSandboxes();
            } catch (reapErr) {
                console.warn('[GUEST_INIT] Opportunistic reap failed:', reapErr.message);
            }
        }

        if (sandboxCount !== null && sandboxCount >= SANDBOX_HARD_CAP) {
            console.warn(`[GUEST_INIT] Hard cap reached (${sandboxCount}). Refusing new sandbox.`);
            return res.status(503).json({
                message: 'Demo capacity is full right now. Please try again in a few minutes.'
            });
        }

        // Use timestamp in guestId to allow the Reaper to track session age
        const guestId = `g_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const guestUser = {
            _id: guestId,
            username: `G_${guestId.slice(-4).toUpperCase()}`,
            role: 'GUEST'
        };

        // --- SANDBOX INITIALIZATION ---
        // Every guest gets a fresh copy of the 'test_records' database.
        const sandboxConn = await getTenantDb(`gsb_${guestId}`);
        const templateConn = await getTenantDb('test_records');

        // Populate the sandbox immediately
        await initDatabase(() => sandboxConn, templateConn);

        // Then make it look lived in: recent dates and eight weeks of reading, in the guest's
        // own days (utils/guestHistory.js). A demo without it is still a working demo, so a
        // failure here is logged, never a refused sign-in. `X-Sample-History: off` asks for a
        // bare sandbox (the API suite's guests, whose checks count from nothing).
        if (String(req.headers['x-sample-history'] || '').toLowerCase() !== 'off') {
            try {
                await seedGuestHistory(sandboxConn, { tz: tzOf(req), userId: guestId });
            } catch (historyErr) {
                console.warn('[GUEST_INIT] Sample history skipped:', historyErr.message);
            }
        }

        const token = generateToken(guestUser);
        setAuthCookie(res, token, guestUser.role);
        res.json({
            user: { id: guestUser._id, username: guestUser.username, role: guestUser.role },
            expiresAt: Date.now() + getTokenTtlMs(guestUser.role)
        });
    } catch (err) {
        console.error('[GUEST_INIT] Failure:', err.message);
        res.status(500).json({ message: 'Sandbox Initialization Fault: Connection to archives severed.' });
    }
});

// POST /api/auth/logout - Terminate Session and Purge Sandbox
router.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'GUEST') {
            console.log(`[AUTH] Purging sandbox for guest: ${req.user._id}`);
            await resilientPurge(req.dbConn, `gsb_${req.user._id}`);
        }
        clearAuthCookie(res);
        res.json({ message: 'Identity Purged.' });
    } catch (err) {
        console.error('[AUTH] Logout Failure:', err.message);
        // Drop the session even if the sandbox purge failed — a stuck sandbox is the
        // reaper's problem, but a session that survives logout is a security problem.
        clearAuthCookie(res);
        return sendError(res, 500, 'Purge protocol failed.', err);
    }
});

// PUT /api/auth/update - Update Hunter Credentials
router.put('/api/auth/update', authenticate, async (req, res) => {
    try {
        await connectDB();
        const { newUsername, currentPassword, newPassword } = req.body || {};

        // A guest has no stored credentials, and its id is not an ObjectId: findById below
        // threw a CastError and answered 500.
        if (req.user.role !== 'SOVEREIGN') {
            return res.status(403).json({ message: 'Guest sessions have no credentials to change.' });
        }
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({ message: 'Current password is required to update credentials.' });
        }
        if (newUsername !== undefined && typeof newUsername !== 'string') {
            return res.status(400).json({ message: 'Username must be text.' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'Hunter identity not found in Akashic Records.' });

        const isMatch = await comparePassword(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Access Denied: Current password is incorrect.' });

        if (newUsername && newUsername.trim() !== user.username) {
            // Escaped like every other username lookup here. Unescaped, the name was read as a
            // pattern: "a(" threw (a 500) and "." matched any one-character name.
            const taken = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(newUsername.trim())}$`, 'i') } });
            if (taken) return res.status(409).json({ message: 'Archive Collision: Username already taken.' });
            user.username = newUsername.trim();
        }

        if (newPassword) {
            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters.' });
            }
            user.passwordHash = await hashPassword(newPassword);
            // Retires every session issued before this instant, on every other device.
            // Backdated one second because a JWT's `iat` is floored to whole seconds —
            // without the slack, the replacement token issued below would fail its own
            // freshness check and log the caller straight back out.
            user.passwordChangedAt = new Date(Date.now() - 1000);
        }

        await user.save();

        // Issue the replacement session so the caller's own device stays signed in.
        const token = generateToken(user);
        setAuthCookie(res, token, user.role);
        res.json({
            user: { id: user._id, username: user.username, role: user.role },
            expiresAt: Date.now() + getTokenTtlMs(user.role)
        });
    } catch (err) {
        return sendError(res, 500, 'Failed to update hunter credentials.', err);
    }
});

module.exports = router;
