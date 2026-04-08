const express = require('express');
const router = express.Router();
const aggregatorLayer = require('../services/aggregator/AggregatorLayer');
const { NotFoundError, ParsingError, NetworkError, RateLimitError } = require('../services/aggregator/providers/BaseProvider');

/**
 * ReaderController - API Routes for the multi-source reader
 * 
 * DESIGN: 
 * - Canonical URLs are the primary identifiers.
 * - Deterministic hashes (id) are used for caching and state tracking.
 */

// Handle Provider Errors consistently
const handleProviderError = (err, res) => {
    console.error(`[ReaderController] Error:`, err.message);
    if (err instanceof NotFoundError) return res.status(404).json({ success: false, message: err.message });
    if (err instanceof ParsingError) return res.status(422).json({ success: false, message: "Failed to parse provider response" });
    if (err instanceof NetworkError) return res.status(502).json({ success: false, message: "Provider is currently unreachable" });
    if (err instanceof RateLimitError) return res.status(429).json({ success: false, message: "Provider rate limit reached" });

    res.status(500).json({ success: false, message: "Internal reader failure" });
};

// GET /api/reader/providers
router.get('/providers', (req, res) => {
    try {
        const providerRegistry = require('../services/aggregator/ProviderRegistry');
        const providers = providerRegistry.getProviders().map(p => ({
            name: p.name,
            baseUrl: p.baseUrl,
            version: p.version
        }));
        res.json({ success: true, count: providers.length, data: providers });
    } catch (err) {
        handleProviderError(err, res);
    }
});

// GET /api/reader/resolve?url=
router.get('/resolve', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ success: false, message: "URL is required" });

        res.json({
            success: true,
            provider: "Universal",
            url: url,
            title: "Loading Database Manhwa...",
            cover: null
        });

    } catch (err) {
        handleProviderError(err, res);
    }
});

// GET /api/reader/search?q=&provider=
router.get('/search', async (req, res) => {
    try {
        const { q, provider } = req.query;
        if (!q) return res.status(400).json({ success: false, message: "Query string 'q' is required" });

        const searchData = await aggregatorLayer.searchAll(q, provider);
        res.json({
            success: true,
            data: searchData
        });
    } catch (err) {
        handleProviderError(err, res);
    }
});

// GET /api/reader/manga/details?url=&provider=
router.get('/manga/details', async (req, res) => {
    const { url, provider } = req.query;
    try {
        if (!url || !provider) return res.status(400).json({ success: false, message: "URL and Provider are required" });

        const details = await aggregatorLayer.getMangaDetails(provider, url);
        res.json({ success: true, details });
    } catch (err) {
        handleProviderError(err, res);
    }
});

// GET /api/reader/chapter/pages?url=&provider=
router.get('/chapter/pages', async (req, res) => {
    const { url, provider } = req.query;
    try {
        if (!url || !provider) return res.status(400).json({ success: false, message: "URL and Provider are required" });

        const pages = await aggregatorLayer.getPages(provider, url);
        res.json({ success: true, pages });
    } catch (err) {
        handleProviderError(err, res);
    }
});

// --- LEGACY SUPPORT (Backward compatibility for existing frontend versions) ---

router.get('/manhwa/:id/chapters', async (req, res) => {
    const { provider, url } = req.query;
    if (url) return res.redirect(`/api/reader/manga/details?url=${encodeURIComponent(url)}&provider=${provider}`);
    res.status(400).json({ success: false, message: "URL query param is required for new provider model" });
});

router.get('/chapter/:id/pages', async (req, res) => {
    const { provider, url } = req.query;
    if (url) return res.redirect(`/api/reader/chapter/pages?url=${encodeURIComponent(url)}&provider=${provider}`);
    res.status(400).json({ success: false, message: "URL query param is required for new provider model" });
});

module.exports = router;
