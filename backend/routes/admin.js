/* Sovereign and maintenance routes: classify, de-duplicate, reap sandboxes. (Split out of index.js, 2026-11-13.) */

const express = require('express');
const { getModel } = require('../models/modelFactory');
const { normalizeTitle } = require('../utils/normalizeTitle');
const { fetchGenresOnly } = require('../utils/metadataProxy');
const { classifyBest } = require('../lib/classify');
const { LIVE, secretMatches, sendError, sleep } = require('../lib/common');
const { debugLog } = require('../lib/log');
const { purgeStaleSandboxes } = require('../lib/sandboxes');
const { authenticate, checkRole } = require('../middleware/authenticate');

const router = express.Router();

// POST /api/admin/bulk-classify — SSE streaming progress
router.post('/api/admin/bulk-classify', authenticate, checkRole('SOVEREIGN'), async (req, res) => {
    // Switch to Server-Sent Events so the client gets live progress per title
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering in prod
    res.flushHeaders();

    const send = (data) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    };

    try {
        const Quest = getModel(req.dbConn, 'Quest');
        console.log("[Admin] Starting Full Metadata-Based SSE Classification...");
        const quests = await Quest.find(LIVE);
        let updated = 0;

        let isAborted = false;
        req.on('close', () => {
            console.log("[Admin] SSE Connection closed. Aborting classification.");
            isAborted = true;
        });

        send({ type: 'start', total: quests.length });

        const BATCH_SIZE = 3;
        for (let i = 0; i < quests.length; i += BATCH_SIZE) {
            if (isAborted) break;

            const batch = quests.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (quest, idx) => {
                const oldClass = quest.classType;
                let newClass = null;
                let changed = false;

                try {
                    const genres = await fetchGenresOnly(quest.title);
                    newClass = classifyBest(quest.title, genres, oldClass);

                    if (genres.length > 0) {
                        debugLog(`[Classify] "${quest.title}" → genres: [${genres.slice(0,4).join(', ')}] → ${newClass}`);
                    } else {
                        debugLog(`[Classify] "${quest.title}" → no metadata, title-only → ${newClass}`);
                    }
                } catch (apiErr) {
                    console.warn(`[Classify] Unexpected error for "${quest.title}": ${apiErr.message}`);
                    newClass = classifyBest(quest.title, []);
                }

                changed = newClass !== oldClass;
                if (changed) {
                    quest.classType = newClass;
                    await quest.save();
                    updated++;
                }

                // Send progress immediately as each item in the batch completes
                send({ type: 'progress', processed: i + idx + 1, total: quests.length, title: quest.title, class: newClass, changed, updated });
            }));

            // Sleep 300ms between batches to stay under MangaDex 5 RPS limit.
            // 31 batches * (400ms API + 300ms sleep) = ~22 seconds total execution.
            // Well under Vercel's 60s maxDuration.
            if (i + BATCH_SIZE < quests.length) {
                await sleep(300);
            }
        }

        console.log(`[Admin] SSE Classification complete. ${updated}/${quests.length} records updated.`);
        send({ type: 'complete', total: quests.length, updated });
        res.end();
    } catch (err) {
        console.error("[Admin] Classification Failure:", err.message);
        send({ type: 'error', message: err.message });
        res.end();
    }
});

// POST /api/admin/purge-duplicates - Deduplicate archives
router.post('/api/admin/purge-duplicates', authenticate, checkRole('SOVEREIGN'), async (req, res) => {
    try {
        const Quest = getModel(req.dbConn, 'Quest');
        console.log("[Admin] Initiating Duplicate Purge...");

        // 1. Group by title (Aggressive Normalization)
        // Only the fields the ranking below actually reads are fetched; pulling whole
        // documents meant transferring every synopsis just to compare titles.
        const allQuests = await Quest.find(LIVE)
            .select('title currentChapter lastRead')
            .lean();
        const groups = {};

        allQuests.forEach(q => {
            const key = normalizeTitle(q.title);
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        });

        let removedCount = 0;
        let processedTitles = 0;

        for (const title in groups) {
            const matches = groups[title];
            if (matches.length > 1) {
                // Keep the one with highest progress, then most recent
                matches.sort((a, b) => {
                    if (b.currentChapter !== a.currentChapter) {
                        return b.currentChapter - a.currentChapter;
                    }
                    return b.lastRead - a.lastRead;
                });

                // matches[0] is the survivor after the sort above; everything behind it goes —
                // to the Trash, not out of the database, so a wrong match is recoverable.
                const toRemove = matches.slice(1);

                for (const quest of toRemove) {
                    await Quest.updateOne({ _id: quest._id }, { deletedAt: new Date() });
                    removedCount++;
                }
                processedTitles++;
            }
        }

        res.json({ message: "Deduplication Engine Complete", removedCount, uniqueTitlesProcessed: processedTitles });
    } catch (err) {
        console.error("[Admin] Purge Failure:", err.message);
        res.status(500).json({ error: "Deduplication Engine Failure" });
    }
});

// POST /api/admin/reap-sandboxes - Invoked by the scheduled workflow.
//
// This used to be a module-scope setInterval. On Vercel the process is created per
// request and frozen between invocations, so that timer effectively never fired and the
// 2-hour guest TTL was enforced only by the browser. Driving it from an external
// schedule is the only thing that actually reaps a serverless deployment.
router.post('/api/admin/reap-sandboxes', async (req, res) => {
    if (!secretMatches(req.headers['x-system-secret'])) {
        return res.status(403).json({ message: 'Forbidden: System Authority Refused.' });
    }

    try {
        const summary = await purgeStaleSandboxes();
        res.json({ message: 'Reaper cycle complete.', ...summary });
    } catch (err) {
        return sendError(res, 500, 'Reaper cycle failed.', err);
    }
});

module.exports = router;
