/* The metadata and image proxies. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { sendError } = require('../lib/common');
const { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_REDIRECTS, assertPublicHttpUrl } = require('../lib/imageGuards');
const { debugLog } = require('../lib/log');
const { MAX_META_TITLE, lookupMetadata } = require('../lib/metadata');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/api/proxy/metadata', authenticate, async (req, res) => {
    const { title, source } = req.query;
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: "Title required." });
    if (title.length > MAX_META_TITLE) return res.status(400).json({ error: "Title too long." });

    debugLog(`[Proxy] Metadata for: ${title} (Source: ${source || 'AUTO'})`);

    try {
        const { data, cached } = await lookupMetadata(title.trim(), source);
        res.set('X-Metadata-Cache', cached ? 'HIT' : 'MISS');
        if (data) {
            res.json(data);
        } else {
            res.status(404).json({ error: "Archive record not found." });
        }
    } catch (err) {
        console.error("[Proxy] Critical Failure:", err.message);
        res.status(500).json({ error: "Communication with archives severed." });
    }
});

// GET /api/proxy/image - Image relay (SSRF-guarded, type-restricted, size-capped)
router.get('/api/proxy/image', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).send("URL required");

    // Block use as an open proxy from other sites. Browsers label a same-page <img>
    // request "same-origin"; a hotlink from an attacker's page is labelled "cross-site".
    // The header is absent on non-browser clients and very old browsers, so only an
    // explicit cross-site label is rejected — the rate limiter covers the rest.
    if (req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).send('Image relay is not available to third-party origins.');
    }

    try {
        assertPublicHttpUrl(url);
    } catch (err) {
        console.warn(`[ImageProxy] REJECTED: ${err.message}`);
        return res.status(403).send('Image origin rejected: invalid or restricted target.');
    }

    const buildReferer = (targetUrl, customReferer) => {
        if (customReferer) return customReferer;
        const h = new URL(targetUrl).hostname.toLowerCase();
        if (h.includes('mangabuddy') || h.includes('mbcdns')) return 'https://mangabuddy.com/';
        if (h.includes('asurascans')) return 'https://asurascans.com/';
        if (h.includes('mgeko')) return 'https://www.mgeko.cc/';
        return new URL(targetUrl).origin + '/';
    };

    // MangaDex answers 403 to a request dressed as a browser: its API rules ask clients to
    // identify themselves and not spoof one. Its covers (uploads.mangadex.org, and the
    // mangadex.network nodes it can redirect to) are fetched as what this is, a server, with
    // no Referer. Every other host keeps the browser-like request some of them insist on.
    const isMangaDex = (targetUrl) => /(^|\.)mangadex\.(org|network)$/i.test(new URL(targetUrl).hostname);

    const fetchOnce = async (targetUrl, timeoutMs, customReferer) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(targetUrl, {
                signal: controller.signal,
                headers: isMangaDex(targetUrl)
                    ? {
                        'User-Agent': 'AkashicRecords/1.0 (+https://the-akashic-records.vercel.app)',
                        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
                    }
                    : {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Sec-Fetch-Dest': 'image',
                        'Sec-Fetch-Mode': 'no-cors',
                        'Sec-Fetch-Site': 'cross-site',
                        'Referer': buildReferer(targetUrl, customReferer)
                    },
                // Manual, so each hop can be re-validated against the SSRF guard.
                redirect: 'manual'
            });
        } finally {
            clearTimeout(timer);
        }
    };

    /**
     * Follow redirects by hand, re-running the public-host assertion on every Location.
     */
    const fetchFollowingSafeRedirects = async (startUrl, timeoutMs, customReferer) => {
        let currentUrl = startUrl;
        for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
            const response = await fetchOnce(currentUrl, timeoutMs, customReferer);

            const isRedirect = response.status >= 300 && response.status < 400;
            if (!isRedirect) return { response, finalUrl: currentUrl };

            const location = response.headers.get('location');
            if (!location) return { response, finalUrl: currentUrl };

            // Resolve relative Location values against the current hop.
            currentUrl = assertPublicHttpUrl(new URL(location, currentUrl).toString()).toString();
        }
        throw new Error(`Exceeded ${MAX_IMAGE_REDIRECTS} redirects`);
    };

    try {
        let result;
        try {
            result = await fetchFollowingSafeRedirects(url, 6000, req.query.referer);
        } catch (firstErr) {
            // A blocked redirect target is a decision, not a transient fault — do not retry it.
            if (/blocked|Unsupported protocol|Exceeded/.test(firstErr.message)) {
                console.warn(`[ImageProxy] SSRF BLOCKED on redirect: ${firstErr.message}`);
                return res.status(403).send('Image origin rejected: restricted redirect target.');
            }
            // Retry once on timeout or network error
            console.warn(`[ImageProxy] First attempt failed (${firstErr.message}), retrying: ${url}`);
            result = await fetchFollowingSafeRedirects(url, 7000, req.query.referer);
        }

        const { response } = result;

        if (!response.ok) {
            console.error(`[ImageProxy] Upstream Error: ${response.status} for ${url}`);
            return res.status(response.status).send(`Upstream server returned ${response.status}`);
        }

        // Refuse anything that is not a bitmap image. Without this the relay will echo
        // attacker-controlled text/html back on the app's own origin.
        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
        if (!ALLOWED_IMAGE_TYPES.test(contentType)) {
            console.warn(`[ImageProxy] BLOCKED non-image content-type "${contentType}" from ${url}`);
            return res.status(415).send('Upstream response was not a supported image type.');
        }

        // Bail before buffering when the upstream declares an oversized body.
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
            return res.status(413).send('Upstream image exceeds the relay size limit.');
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            return res.status(413).send('Upstream image exceeds the relay size limit.');
        }

        res.setHeader('Content-Type', contentType);
        // Content-Type is now allowlisted; nosniff stops the browser second-guessing it.
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Browser: 24h cache. Vercel CDN edge: 1h (s-maxage).
        // stale-while-revalidate serves cached content while silently refreshing.
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Vary', 'Accept');

        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("[ImageProxy] Critical Failure:", err.message, url);
        return sendError(res, 504, 'Failed to relay image from origin.', err);
    }
});

module.exports = router;
