import { Quest } from '../../core/types';

/**
 * How the Spire orders records: a floor's carousel, the search results, and the Command
 * Matrix all use these, and share one remembered choice (localStorage `akashic_spire_sort`).
 */
export type SpireSort = 'RECENT' | 'TITLE' | 'PROGRESS' | 'APPRAISAL' | 'NEW';

export const SPIRE_SORTS: { value: SpireSort; label: string }[] = [
    { value: 'RECENT', label: 'Recent' },
    { value: 'TITLE', label: 'Title' },
    { value: 'PROGRESS', label: 'Progress' },
    { value: 'APPRAISAL', label: 'Appraisal' },
    { value: 'NEW', label: 'New chapters' },
];

const recency = (q: Quest) => new Date(q.lastUpdated || 0).getTime();
const progressOf = (q: Quest) => (q.totalChapters > 0 ? q.currentChapter / q.totalChapters : 0);

export const SPIRE_COMPARE: Record<SpireSort, (a: Quest, b: Quest) => number> = {
    RECENT: (a, b) => recency(b) - recency(a),
    TITLE: (a, b) => a.title.localeCompare(b.title),
    PROGRESS: (a, b) => progressOf(b) - progressOf(a) || recency(b) - recency(a),
    // Unrated records go last, then by title.
    APPRAISAL: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title),
    NEW: (a, b) => (b.newChapters ?? 0) - (a.newChapters ?? 0) || recency(b) - recency(a),
};
