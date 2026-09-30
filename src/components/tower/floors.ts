import { Quest } from '../../core/types';

/**
 * The Spire's floors, given meaning.
 *
 * A floor is no longer a page of the library (records 1–20, 21–40, …). It is a STAGE of the
 * climb: a title rests on the floor its reading progress has earned, so a record rises through
 * the Spire as you read it — sealed at the foot, enthroned once conquered. Every surface that
 * draws the tower (the 3D isles, the HUD, the floor carousel) reads these same definitions, so
 * the label on an isle and the records inside it can never disagree.
 *
 * Index 0 is the base isle, the last index the summit. `label` is the short all-caps tag the 3D
 * sprite can carry without overflowing; `name` and `meaning` are the fuller forms the HUD shows.
 */
export interface FloorDef {
    label: string;
    name: string;
    meaning: string;
}

export const FLOOR_DEFS: FloorDef[] = [
    { label: 'SEVERED', name: 'The Severed', meaning: 'Abandoned gates — the climb forsaken' },
    { label: 'SEALED', name: 'Sealed Gates', meaning: 'Untouched — the first read still awaits' },
    { label: 'THRESHOLD', name: 'The Threshold', meaning: 'Just breached · under 25%' },
    { label: 'TRIALS', name: 'The Trials', meaning: 'Into the climb · 25–49%' },
    { label: 'ASCENT', name: 'The Ascent', meaning: 'Past the midpoint · 50–74%' },
    { label: 'CREST', name: 'The Crest', meaning: 'Nearing the summit · 75–99%' },
    { label: 'VIGIL', name: 'The Vigil', meaning: 'Caught up — awaiting new chapters' },
    { label: 'THRONE', name: 'The Throne', meaning: 'Conquered — the gate cleared' },
];

export const SPIRE_FLOOR_COUNT = FLOOR_DEFS.length;

/**
 * The floor a title belongs on, by progress. Exactly one floor per title; precedence runs
 * status first (a severed or conquered gate is off the progress ladder), then completion.
 */
export function floorIndexForItem(item: Quest): number {
    const status = (item.status || '').toUpperCase();
    if (status === 'SEVERED') return 0;      // The Severed
    if (status === 'CONQUERED') return 7;    // The Throne

    const total = item.totalChapters || 0;
    const current = item.currentChapter || 0;

    // Caught up to everything released but not marked conquered — an ongoing vigil.
    if (total > 0 && current >= total) return 6; // The Vigil

    const pct = total > 0 ? current / total : 0;
    if (pct <= 0) return 1;      // Sealed Gates
    if (pct < 0.25) return 2;    // The Threshold
    if (pct < 0.5) return 3;     // The Trials
    if (pct < 0.75) return 4;    // The Ascent
    return 5;                    // The Crest (0.75–0.99)
}
