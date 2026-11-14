/* Sessions: the auth cookie, the tenant database, roles. (Split out of index.js, 2026-11-13.) */

const { connectDB, getTenantDb } = require('../config/db');
const User = require('../models/User');
const { clearAuthCookie, readAuthCookie, verifyToken } = require('../utils/auth');

const authenticate = async (req, res, next) => {
    // The httpOnly cookie is the browser's path. The Bearer header stays supported for
    // local scripts and curl — a browser never attaches it automatically, so it carries
    // no CSRF exposure of its own.
    let token = readAuthCookie(req);
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Authentication Protocol Terminated: No Token Provided.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        clearAuthCookie(res);
        return res.status(401).json({ message: 'Authentication Protocol Terminated: Invalid Token.' });
    }

    try {
        req.user = {
            _id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };

        // --- SOVEREIGN RE-VERIFICATION ---
        // SOVEREIGN is the only role that reaches the live archive, so its claim is
        // re-read from the database rather than trusted from the token. Guests keep the
        // zero-lookup path: their tenant is a disposable sandbox keyed to their own id,
        // so a forged guest claim grants access to nothing but an empty database.
        if (req.user.role === 'SOVEREIGN') {
            await connectDB();
            const dbUser = await User.findById(decoded.id).select('role passwordChangedAt');

            if (!dbUser || dbUser.role !== 'SOVEREIGN') {
                clearAuthCookie(res);
                return res.status(401).json({ message: 'Authentication Protocol Terminated: Authority Revoked.' });
            }

            // A password change invalidates every session issued before it.
            if (dbUser.passwordChangedAt && decoded.iat * 1000 < dbUser.passwordChangedAt.getTime()) {
                clearAuthCookie(res);
                return res.status(401).json({ message: 'Authentication Protocol Terminated: Session Superseded.' });
            }
        }

        // --- MULTI-TENANCY LOGIC ---
        // SOVEREIGN -> akashic_records, GUEST -> gsb_<id>
        const dbName = req.user.role === 'SOVEREIGN' ? 'akashic_records' : `gsb_${req.user._id}`;
        req.dbConn = await getTenantDb(dbName);

        next();
    } catch (err) {
        console.error('[Auth Error]', err.message);
        res.status(500).json({ message: 'Authentication System Fault: Internal Link Severed.' });
    }
};

const checkRole = (role) => (req, res, next) => {
    if (req.user.role !== role) {
        return res.status(403).json({ message: `Forbidden: ${role} authority required.` });
    }
    next();
};

module.exports = { authenticate, checkRole };
