/* The image proxy's guards: public http(s) only, allowed types, size and redirect caps. (Split out of index.js, 2026-11-13.) */

// ─── SSRF BLOCKLIST (Permissive for Public Images) ───────────────────────────
const isInternalHostname = (hostname) => {
    // Blocks localhost, private network spaces (10.x, 192.168.x, 172.16-31.x), loopback, metadata IPs, and local domains
    const internalRegex = /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|::1|.*\.local|.*\.internal)$/i;
    return internalRegex.test(hostname);
};

// ─── IMAGE PROXY GUARDS ───────────────────────────────────────────────────────

// Only bitmap types are relayed. image/svg+xml is deliberately excluded: the proxy is
// same-origin with the SPA, and an SVG can carry <script>, which would run against the
// app's own origin and reach the token in localStorage.
const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|jpg|pjpeg|png|gif|webp|avif|bmp|tiff|x-icon|vnd\.microsoft\.icon)$/i;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

 // 8 MB
const MAX_IMAGE_REDIRECTS = 3;

/**
 * Parse a URL and assert it points at a public http(s) host.
 * Applied to the initial target AND to every redirect hop — checking only the first
 * URL lets an attacker-controlled public host 302 the fetch into the private network.
 */
const assertPublicHttpUrl = (raw) => {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol "${parsed.protocol}"`);
    }
    if (isInternalHostname(parsed.hostname.toLowerCase())) {
        throw new Error(`Internal hostname "${parsed.hostname}" blocked`);
    }
    return parsed;
};

module.exports = { isInternalHostname, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_REDIRECTS, assertPublicHttpUrl };
