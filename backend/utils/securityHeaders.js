/**
 * Content Security Policies, defined once.
 *
 * DOCUMENT_CSP must stay identical to the Content-Security-Policy in vercel.json. On
 * Vercel the SPA shell is served straight from the CDN and never reaches this app, so
 * that file is what protects it in production; this copy is what protects it under
 * `vercel dev`, a self-hosted Express deployment, or any other host. The test suite
 * asserts the two strings match so they cannot drift apart.
 */

// The SPA shell. Derived from what the build actually needs:
//   - script-src 'self'      : the build emits one external module script, no inline JS
//   - style-src 'unsafe-inline' : index.html has an inline <style>, and motion/framer
//                                 write inline styles on animated elements
//   - fonts.googleapis/gstatic  : index.css @imports Orbitron + Rajdhani
//   - img-src 'self' data: blob: : every remote image is relayed through /api/proxy/image
//   - connect-src 'self'     : the app talks to nothing but its own API
const DOCUMENT_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests'
].join('; ');

// API responses are JSON, never a document. Nothing should ever be loaded from one.
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

module.exports = { DOCUMENT_CSP, API_CSP };
