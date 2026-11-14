import { Quest } from './types';
import { unproxyImageUrl } from '../utils/api';
import { systemFetch } from '../utils/auth';

/* A quest record as the app holds it, and fetching one (moved out of App.tsx, 2026-11-13). */

export const API_URL = '/api/quests';

// Placeholder shown when the library is empty. Module scope, not component scope: as a
// per-render object literal it was a fresh reference every time, which made every useMemo
// depending on it recompute on every render.
export const DEFAULT_QUEST: Quest = {
    id: '0',
    title: 'No Active Quest',
    coverUrl: "",
    totalChapters: 0,
    currentChapter: 0,
    status: 'LOCKED',
    classType: 'UNKNOWN',
    link: ''
};

/**
 * The Hunter's Appraisal as the app holds it: a whole 1-10, or null for unrated.
 *
 * Records saved by the February build carry its old 0-10 rating, which stored 0 for "unrated"
 * and allowed tenths. Kept as they were, a 0 went back to the server with any save from the
 * editor and the whole save was refused ("The appraisal must be a whole number from 1 to 10").
 * So 0 reads as unrated and tenths round to the nearest whole; the next save writes it clean.
 */
export const appraisalOf = (r: unknown): number | null => {
    const n = typeof r === 'number' ? r : typeof r === 'string' && r.trim() ? Number(r) : NaN;
    if (!Number.isFinite(n) || n < 0.5) return null;
    return Math.min(10, Math.round(n));
};

// Helper to normalize quest data from both MongoDB and local BASE_QUESTS
export const mapQuest = (q: any): Quest => ({
    id: String(q._id || q.id || ""),
    title: q.title || "",
    // Keep the ORIGIN url in state. Proxying happens at render time instead, because
    // this value round-trips back to the database through the edit form — mapping it to
    // a proxied path here is what caused "/api/proxy/image?url=..." to be persisted as
    // the cover. unproxyImageUrl also repairs records already written that way.
    coverUrl: unproxyImageUrl(q.cover || q.coverUrl || ""),
    link: q.readLink || q.link || q.siteUrl || "",
    // Undefined, not "", when the record came from the library list (which omits synopses):
    // "" would read as "no synopsis" and an untouched edit form would save it over the real
    // one. An undefined field is dropped from the save, so the stored synopsis is never hit.
    synopsis: typeof q.synopsis === 'string' ? q.synopsis : undefined,
    currentChapter: Number(q.currentChapter) || 0,
    totalChapters: Number(q.totalChapters) || 0,
    status: (q.status || 'ACTIVE').toUpperCase(),
    classType: q.classType || "PLAYER",
    lastUpdated: q.lastRead || q.lastUpdated || Date.now(),
    newChapters: Number(q.newChapters) || 0,
    rating: appraisalOf(q.rating),
});

/** One full record, synopsis included; the library list leaves synopses out. Null on failure. */
export const fetchFullQuest = async (id: string): Promise<Quest | null> => {
    if (!id || id === DEFAULT_QUEST.id || id.startsWith('optimistic-')) return null;
    try {
        const res = await systemFetch(`${API_URL}/${id}`);
        return res.ok ? mapQuest(await res.json()) : null;
    } catch {
        return null;
    }
};
