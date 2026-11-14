// The modules the app has always loaded, in their original order. Most are used by the split-out
// modules now (lib/, middleware/, routes/), which require them themselves; requiring them here
// first keeps the load order exactly as it was.
const express = require('express');
require('mongoose');
const cors = require('cors');
require('express-rate-limit');
require('./config/db');
require('./config/init');
require('./utils/guestHistory');
require('./models/modelFactory');
require('./utils/normalizeTitle');
require('./utils/achievements');
require('./utils/listImport');
require('./utils/metadataProxy');
require('crypto');
require('./models/User');
require('./models/MetadataCache');
require('./utils/auth');
const { DOCUMENT_CSP, API_CSP } = require('./utils/securityHeaders');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { BACKUP_PATH } = require('./lib/backup');
const { authLimiter, guestLimiter, imageProxyLimiter, loginLimiter } = require('./middleware/limiters');

const app = express();

// Vercel terminates TLS and forwards through exactly one proxy hop. Without this,
// req.ip is the proxy's address for every caller and the rate limiter below shares
// a single bucket across all clients. A numeric hop count (rather than `true`) keeps
// express-rate-limit's permissive-trust-proxy validator satisfied.
app.set('trust proxy', 1);

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
// Applied by the app so they hold in local development and under any host. On Vercel the
// SPA shell is served from the CDN and never reaches this middleware, which is why
// vercel.json carries a matching set for static routes.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // The API gets the locked-down policy; anything else is the SPA shell and needs the
    // document policy. Applying the API policy to the document would block its own
    // stylesheet, favicon and bundle.
    res.setHeader('Content-Security-Policy', req.path.startsWith('/api') ? API_CSP : DOCUMENT_CSP);
    next();
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'https://the-akashic-records.vercel.app',
    'http://localhost:5173',
    'http://localhost:5000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow same-origin/server-to-server (no Origin header) and known origins.
        //
        // An unknown origin is refused by declining to emit the CORS headers, NOT by
        // raising. Throwing here surfaced as a 500 on every request from that origin —
        // including the SPA's own document and assets when served by this app — and the
        // error path bypassed the header middleware above. Declining leaves the browser
        // to block the cross-origin read, which is the actual intent.
        callback(null, !origin || ALLOWED_ORIGINS.includes(origin));
    },
    credentials: true
}));

const jsonBody = express.json({ limit: '64kb' });

app.use((req, res, next) => (req.method === 'POST' && req.path === BACKUP_PATH ? next() : jsonBody(req, res, next)));

// Apply rate limit to all auth routes
app.use('/api/auth', authLimiter);

app.use('/api/auth/login', loginLimiter);

app.use('/api/auth/guest', guestLimiter);

app.use('/api/proxy/image', imageProxyLimiter);

// ─── ROUTES (routes/*.js, split out 2026-11-13) ───────────────────────────────
// One router per area, mounted in this order. Within an area the routes keep the order
// they had, which matters where a literal path and a :param share a prefix
// (GET /api/quests/trash before GET /api/quests/:id).
app.use(require('./routes/health'));
app.use(require('./routes/auth'));
app.use(require('./routes/user'));
app.use(require('./routes/events'));
app.use(require('./routes/quests'));
app.use(require('./routes/import'));
app.use(require('./routes/admin'));
app.use(require('./routes/proxy'));
app.use(require('./routes/chapters'));
app.use(require('./routes/backup'));
app.use(require('./routes/covers'));

// ─── UNKNOWN ENDPOINTS ────────────────────────────────────────────────────────
// Registered after every route. Vercel sends only /api traffic here, and an unknown path
// used to get Express's default HTML page ("Cannot GET /api/…") from a JSON API.
app.use((req, res) => {
    res.status(404).json({ message: 'No such endpoint.' });
});

// ─── TERMINAL ERROR HANDLER ───────────────────────────────────────────────────
// Last line of defence. Without this, anything thrown outside a route's own try/catch
// (a malformed JSON body, for instance) reaches Express's default handler, which returns
// the message — and in development the stack — straight to the client.
//
// Registered last so it sits behind every route. Express identifies an error handler by
// its four-argument signature, so `next` must stay in the list even though it is unused.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[UNHANDLED]', err.stack || err.message || err);

    if (res.headersSent) return;

    // Body-parser failures are the client's fault; report them as such.
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Payload too large.' });
    }
    if (err.status === 400 && err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Malformed request body.' });
    }

    res.status(500).json({ message: 'System fault. The archive could not complete that request.' });
});

module.exports = app;
