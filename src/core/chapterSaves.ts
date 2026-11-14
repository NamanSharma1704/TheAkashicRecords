/*
 * The chapter-save model's types and timings (moved out of App.tsx, 2026-11-13). App's
 * requestChapter owns the behaviour; see its comments.
 */

// ─── CHAPTER PROGRESS ─────────────────────────────────────────────────────────
// See requestChapter in App for the full model. A "burst" is one run of chapter changes to
// a single quest that ends in one save: merged taps, a held stepper, or a typed number.
export type ChapterPair = { current: number; total: number };
export interface ChapterBurst {
    questId: string;
    /** What the server last acknowledged. A failed save returns here. */
    confirmed: ChapterPair;
    /** Where this burst began. Undo returns here. */
    start: ChapterPair;
    /** The latest requested values, already on screen. */
    target: ChapterPair;
    typed: boolean;
    undo: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    inFlight: boolean;
    /** A save was requested while one was already in the air. */
    dirty: boolean;
    /** When saves started failing for want of a connection (null while they go through). The
     *  burst is held and retried until RETRY_GIVE_UP_MS after this. */
    failedSince: number | null;
    /** Retries so far in this outage, which picks the next wait from RETRY_STEPS_MS. */
    attempts: number;
    /** It came through an outage: a quiet "Saved" when it finally lands. */
    recovering: boolean;
}
export interface ChapterRequestOpts {
    /** 'merge' waits CHAPTER_MERGE_MS for more taps; 'now' sends at once; 'hold' waits for the stepper's release. */
    mode: 'merge' | 'now' | 'hold';
    /** Explicit total (Undo restores it). Defaults to the total on screen. */
    total?: number;
    /** Typed by hand: always offered for Undo, and allowed to raise the total. */
    typed?: boolean;
    /** This change is an Undo; its settle confirms the restore instead of offering another. */
    undo?: boolean;
}
/** Taps closer together than this merge into one save. */
export const CHAPTER_MERGE_MS = 600;
/**
 * A chapter save that fails for want of a connection is held and retried rather than undone:
 * the number stays where the reader put it. These are the waits between tries (the last one
 * repeats), and how long the outage may last before the save is given up and the number
 * returns to the last chapter the server confirmed. Retries live only while the page is open:
 * keeping them across a reload could let an old save overwrite newer progress from another
 * device. A save that only gets through after midnight counts for the new day (accepted).
 */
export const RETRY_STEPS_MS = [2000, 4000, 8000, 15000, 30000];
export const RETRY_GIVE_UP_MS = 2 * 60 * 1000;
/** Replies worth trying again: a timeout, rate limiting, or the server or its gateway down.
 *  Any other refusal (400, 403, 409) would only be refused again. */
export const isRetryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

/** A burst that moves at least this many chapters gets an Undo toast. */
export const UNDO_THRESHOLD = 5;
