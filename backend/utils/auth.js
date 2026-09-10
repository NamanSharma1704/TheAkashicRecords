const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET environment variable is not set. System cannot start.');
}

/**
 * Session lifetimes, per role.
 *
 * A guest session is pinned to the 2-hour sandbox TTL so the token cannot outlive the
 * database it points at. The Sovereign session was 30 days; a week is long enough to
 * avoid re-authenticating constantly and short enough that a leaked cookie expires.
 */
const TOKEN_TTL_MS = {
    SOVEREIGN: 7 * 24 * 60 * 60 * 1000, // 7 days
    GUEST: 2 * 60 * 60 * 1000           // 2 hours — matches the sandbox reaper
};

const getTokenTtlMs = (role) => TOKEN_TTL_MS[role] || TOKEN_TTL_MS.GUEST;

// Name of the httpOnly session cookie.
const AUTH_COOKIE = 'akashic_session';

/**
 * Hash a password using bcrypt.
 */
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Compare a password with a hash.
 */
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Generate a JWT for a user. Expiry follows the role.
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: Math.floor(getTokenTtlMs(user.role) / 1000) }
    );
};

/**
 * Verify a JWT.
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
};

// ─── SESSION COOKIE ───────────────────────────────────────────────────────────
// The token lives in an httpOnly cookie so page scripts cannot read it. That removes
// token theft from the impact of any future XSS: script on the page can still act as
// the user while the page is open, but it cannot exfiltrate a reusable credential.
//
// sameSite 'strict' is what defends the state-changing routes against CSRF — the
// browser withholds this cookie from any request originating on another site. Note
// that a visitor arriving from an external link (the portfolio) is unaffected: that
// top-level navigation only loads the SPA shell, and every API call the app then makes
// is same-site, so the cookie is attached normally.

/**
 * `secure` is decided by the request's actual scheme, which is accurate behind Vercel's
 * proxy because the app sets `trust proxy`. NODE_ENV is only a fallback: relying on it
 * alone means a host that does not set it silently drops the Secure flag. This way the
 * only requests that get a non-Secure cookie are ones genuinely arriving over http,
 * which in practice means localhost.
 */
const cookieOptions = (res) => ({
    httpOnly: true,
    secure: res?.req?.secure === true || process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
});

const setAuthCookie = (res, token, role) => {
    res.cookie(AUTH_COOKIE, token, { ...cookieOptions(res), maxAge: getTokenTtlMs(role) });
};

const clearAuthCookie = (res) => {
    // Options must match those used to set it, or the browser keeps the original cookie.
    res.clearCookie(AUTH_COOKIE, cookieOptions(res));
};

/**
 * Read the session cookie off the raw header.
 * Hand-rolled to avoid pulling in cookie-parser for a single lookup.
 */
const readAuthCookie = (req) => {
    const header = req.headers.cookie;
    if (!header) return null;

    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === AUTH_COOKIE) {
            try {
                return decodeURIComponent(part.slice(eq + 1).trim());
            } catch {
                return null; // malformed percent-encoding
            }
        }
    }
    return null;
};

module.exports = {
    JWT_SECRET,
    AUTH_COOKIE,
    TOKEN_TTL_MS,
    getTokenTtlMs,
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    setAuthCookie,
    clearAuthCookie,
    readAuthCookie
};
