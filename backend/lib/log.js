/* Debug logging: printed in development, or in production with LOG_LEVEL=debug. (Split out of index.js, 2026-11-13.) */

/**
 * Per-request detail (timings, lookups, metadata fallbacks). Printed in development, or in
 * production with LOG_LEVEL=debug. It used to print on every request in production too,
 * login usernames included, filling the platform log with noise and personal data.
 * Warnings, errors and the reaper/admin summaries still use console directly.
 */
const debugLog = (...args) => {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') console.log(...args);
};

module.exports = { debugLog };
