/* The classes' inks, per theme (moved out of HunterProfile.tsx, 2026-11-13). */

const CLASS_COLORS: Record<string, string> = {
    NECROMANCER: 'text-purple-400',
    CONSTELLATION: 'text-violet-500',
    MAGE: 'text-blue-400',
    IRREGULAR: 'text-orange-400',
    PLAYER: 'text-emerald-400',
};

/**
 * The same hues three to four rungs down, for the light theme. The -400 set above is tuned for
 * near-black and measures 1.9:1 to 2.5:1 on a white panel; these all clear 4.5:1 on the
 * profile's tinted glass, keeping each class identifiable by colour rather than by position.
 * Amber and orange go one rung further (-800): at -700 they measured 4.2-4.4:1 there.
 */
const CLASS_COLORS_LIGHT: Record<string, string> = {
    NECROMANCER: 'text-purple-700',
    CONSTELLATION: 'text-amber-800',
    MAGE: 'text-blue-700',
    IRREGULAR: 'text-orange-800',
    PLAYER: 'text-emerald-700',
};

/** Class colour for the active theme, falling back to a readable neutral. */
export const classColor = (cls: string, isDark: boolean): string =>
    (isDark ? CLASS_COLORS[cls] : CLASS_COLORS_LIGHT[cls]) || (isDark ? 'text-gray-400' : 'text-stone-600');
