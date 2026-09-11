/**
 * Shared plumbing for the maintenance scripts in this folder.
 *
 * Credentials come from backend/.env, never from source. These scripts previously
 * carried a literal admin password and system secret, and this repository is public —
 * anything committed here must be treated as published. Keep real values in .env
 * (gitignored) and only placeholders in .env.example.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/** Read a required variable from backend/.env, or exit with a message naming it. */
const requireEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing ${name}. Add it to backend/.env (see backend/.env.example).`);
        process.exit(1);
    }
    return value;
};

/** Credentials for the Sovereign account, from backend/.env. */
const adminCredentials = () => ({
    username: requireEnv('AKASHIC_ADMIN_USERNAME'),
    password: requireEnv('AKASHIC_ADMIN_PASSWORD'),
});

/**
 * Pull the session token out of a login/guest response.
 *
 * The API issues the session as an httpOnly `akashic_session` cookie and no longer
 * returns it in the JSON body, so reading `data.token` yields undefined. The server
 * still accepts the same value as a Bearer header, which is what these scripts send.
 */
const sessionTokenFrom = (res) => {
    const cookie = (res.headers['set-cookie'] || []).find(c => c.startsWith('akashic_session='));
    if (!cookie) return null;
    return decodeURIComponent(cookie.split(';')[0].slice('akashic_session='.length));
};

module.exports = { requireEnv, adminCredentials, sessionTokenFrom };
