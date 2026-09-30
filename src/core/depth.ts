import { Theme } from './types';

/**
 * Depth, as one rule instead of thirty hand-tuned shadows.
 *
 * The two themes disagree about how depth is *shown*. On the amber Void's near-black, height reads
 * as emitted light: a lit top rim and a black shadow only to seat the object. On the bright
 * amethyst day theme the opposite holds — a glow has nothing to brighten, so height reads as a
 * real cast shadow, cool aubergine so it belongs to the violet ground rather than reading as grime.
 */

/**
 * How far off the page a surface sits.
 *
 * 0 flush (the page itself) · 1 a panel · 2 something lifted over panels
 * (the hero card at rest) · 3 actively raised (hover, drag, a modal).
 */
export type Level = 0 | 1 | 2 | 3;

// The bright day theme: a warm-white inset top rim plus cool aubergine cast layers give real
// height on the light ground.
const LIGHT_ELEVATION: Record<Level, string> = {
    0: 'none',
    1: 'inset 0 1px 0 rgba(255,253,255,0.9), 0 1px 2px rgba(40,26,60,0.10), 0 3px 8px rgba(40,26,60,0.12)',
    2: 'inset 0 1px 0 rgba(255,253,255,0.9), 0 2px 4px rgba(40,26,60,0.12), 0 10px 22px rgba(40,26,60,0.18)',
    3: 'inset 0 1px 0 rgba(255,253,255,0.95), 0 4px 10px rgba(40,26,60,0.14), 0 26px 46px rgba(40,26,60,0.24)',
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
 * Emphasis. The Void spends it as a pure glow (emitted light on black). The bright day theme
 * spends it as a saturated coloured bloom PLUS a cast shadow for height — a white glow can't
 * lighten a light ground, but a saturated amethyst one stains it and reads as a real bloom-halo.
 *
 * `rgb` is a bare "r, g, b" triplet so callers can pass a theme token straight through.
 */
export const emphasis = (theme: Theme, rgb: string, strength = 1): string =>
    theme.isDark
        ? `0 0 ${Math.round(20 * strength)}px rgba(${rgb}, ${(0.45 * strength).toFixed(3)})`
        : `0 0 ${Math.round(16 * strength)}px rgba(${rgb}, ${(0.40 * strength).toFixed(3)}),`
          + ` 0 ${Math.round(6 * strength)}px ${Math.round(16 * strength)}px rgba(40,26,60,${(0.18 * strength).toFixed(3)}),`
          + ` 0 0 0 1px rgba(${rgb}, ${(0.34 * strength).toFixed(3)})`;

/**
 * Bare "r, g, b" for the theme's decorative accent, for feeding `emphasis`.
 * Kept here so callers never hand-write the triplet next to a hex token that may move.
 */
export const accentRGB = (theme: Theme): string => {
    const h = theme.accentColor.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};
