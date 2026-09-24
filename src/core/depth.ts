import { Theme } from './types';

/**
 * Depth, as one rule instead of thirty hand-tuned shadows.
 *
 * The two themes do not disagree about how deep a thing is — they disagree about how
 * depth is *shown*. On near-black, a cast shadow has nothing to darken, so height reads
 * as emitted light: a lit top rim, and a black shadow only to seat the object. On a pale
 * page the opposite holds — a glow has nothing to brighten, so height reads as a cast
 * shadow. Same ladder, two vocabularies.
 *
 * Every shadow here is cool-tinted slate rather than pure black. Neutral black over a
 * blue-grey page reads as grime; the shadow has to belong to the surface it falls on.
 */

/**
 * How far off the page a surface sits.
 *
 * 0 flush (the page itself) · 1 a panel · 2 something lifted over panels
 * (the hero card at rest) · 3 actively raised (hover, drag, a modal).
 */
export type Level = 0 | 1 | 2 | 3;

const LIGHT_ELEVATION: Record<Level, string> = {
    0: 'none',
    // Two layers each: a tight contact shadow that pins the object to the surface, and a
    // wide ambient one that gives it size. A single blur reads as a sticker.
    1: '0 1px 2px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.08)',
    2: '0 2px 4px rgba(15,23,42,0.07), 0 8px 18px rgba(15,23,42,0.12)',
    3: '0 4px 8px rgba(15,23,42,0.08), 0 22px 40px rgba(15,23,42,0.16)',
};

const DARK_ELEVATION: Record<Level, string> = {
    0: 'none',
    // The inset hairline is the whole cue: it is the top edge catching ambient light.
    // The outer black is nearly invisible against #020202 and exists only so the object
    // does not sit perfectly flush with whatever is behind it.
    1: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.80)',
    2: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.90)',
    3: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 24px 48px rgba(0,0,0,0.95)',
};

/** Box-shadow for a surface at `level`. Ready to drop into a style object. */
export const elevation = (theme: Theme, level: Level): string =>
    (theme.isDark ? DARK_ELEVATION : LIGHT_ELEVATION)[level];

/**
 * The glow/shadow translation, in one place.
 *
 * This is the lesson the hero cone cost several rounds to learn: a coloured glow is not
 * a thing you can recolour for light mode, because on a pale page there is no headroom
 * above the background to glow *into*. The light branch therefore spends the emphasis
 * differently — a neutral cast shadow carries the presence, and the colour survives as a
 * tight saturated ring at an alpha a glow could never use.
 *
 * `rgb` is a bare "r, g, b" triplet so callers can pass a theme token straight through.
 */
export const emphasis = (theme: Theme, rgb: string, strength = 1): string =>
    theme.isDark
        ? `0 0 ${Math.round(20 * strength)}px rgba(${rgb}, ${(0.45 * strength).toFixed(3)})`
        : `0 ${Math.round(6 * strength)}px ${Math.round(16 * strength)}px rgba(15,23,42,${(0.14 * strength).toFixed(3)}),`
          + ` 0 0 0 1px rgba(${rgb}, ${(0.28 * strength).toFixed(3)})`;

/**
 * Bare "r, g, b" for the theme's decorative accent, for feeding `emphasis`.
 * Kept here so callers never hand-write the triplet next to a hex token that may move.
 */
export const accentRGB = (theme: Theme): string => {
    const h = theme.accentColor.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};
