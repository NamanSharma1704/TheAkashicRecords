
import { Theme } from './types';

/**
 * The two themes the app ships: Void (dark, amber) and Aureic (light, cyan).
 *
 * Typed as an exact record rather than Record<string, Theme> so the header toggle and
 * any future theme switcher can only ever name a theme that exists — a missing key is a
 * compile error instead of an undefined lookup at runtime.
 *
 * Two further themes, SYSTEM (cyan on slate) and BLOOD (red on black), were defined here
 * but never reachable: currentTheme only ever holds 'DARK' or 'LIGHT', and every theme
 * check in the codebase is a binary `theme.id === 'LIGHT'`. They were removed rather than
 * left as decoration; re-adding one means adding it here and widening ThemeId.
 */
export type ThemeId = 'DARK' | 'LIGHT';

export const THEMES: Record<ThemeId, Theme> = {
    DARK: {
        id: 'DARK',
        name: 'Dark Mode',
        primary: 'amber',
        accent: 'yellow',
        appBg: 'bg-[#020202]',
        panelBg: 'bg-[#0a0a0c]',
        modalBg: 'bg-[#030305]',
        inputBg: 'bg-black/50',
        baseText: 'text-gray-300',
        headingText: 'text-white',
        mutedText: 'text-gray-400',
        highlightText: 'text-[#f59e0b]',
        border: 'border-[#f59e0b]',
        borderSubtle: 'border-white/10',
        overlay: 'bg-black/80',
        starColor: '255, 255, 255',
        gradient: 'from-[#f59e0b] via-yellow-400 to-white',
        inkGradient: 'from-[#f59e0b] via-yellow-400 to-white',
        labelGradient: 'from-[#f59e0b] to-amber-300',
        accentColor: '#f59e0b',
        accentInk: '#f59e0b',
        warningInk: '#f59e0b',
        isDark: true
    },
    // Aureic — the light theme, an illuminated-manuscript surface: gold and lapis ink on warm
    // vellum. The cyan version was cold and washed; the all-gold version was warm and cohesive
    // but topped out on contrast, so headline detail stayed soft. This is the illuminated
    // answer — a WARM parchment ground and warm ink for reading, a deep LAPIS accent that pops
    // hard on the page and carries the chrome, rank, borders and definition, and GOLD kept for
    // the hero marks (logo, tower, wordmark shimmer). Depth comes from real cast shadows and
    // ambient occlusion (see depth.ts), never the glow a pale page kills. Gold on ultramarine
    // on vellum: the canonical pairing, and an archive of the stars in blue and gold.
    LIGHT: {
        id: 'LIGHT',
        name: 'Light Mode',
        primary: 'violet',
        accent: 'violet',
        // Arcanum — a BRIGHT amethyst day theme, but not a flat white page. A light field reads as
        // a surface, so its immersion comes from a RICH, saturated luminous atmosphere behind the
        // content (see GalaxyNebula / IlluminatedCodex): a radiant amethyst sky with real nebula
        // depth. The ground stays bright so panels and dark violet ink read; the "feel" lives in
        // the atmosphere, not in darkness. Neutrals are violet-tinted so the whole family coheres.
        appBg: 'bg-[#e9e2f6]',
        panelBg: 'bg-[#fbf9ff]',
        modalBg: 'bg-[#f6f1fc]',
        inputBg: 'bg-[#eae3f5]',
        // Aubergine near-black ink for the value range that carries definition; body and muted
        // step up in lightness, still violet.
        baseText: 'text-[#463a5c]',
        headingText: 'text-[#241a33]',
        mutedText: 'text-[#655a80]',
        // Deep amethyst accent text — readable at every size on the bright ground.
        highlightText: 'text-[#5b21b6]',
        border: 'border-[#8b5cf6]',
        borderSubtle: 'border-[#d3cae8]',
        overlay: 'bg-[#e7ddf5]/85',
        // Deep amethyst ink for any HUD linework drawn on the bright ground.
        starColor: '74, 40, 120',
        gradient: 'from-[#7c3aed] to-[#a78bfa]',
        // Display-text gradient: bright violet start, luminous #a855f7 mid, deep end.
        inkGradient: 'from-[#7c3aed] via-[#a855f7] to-[#6d28d9]',
        // Section-label ramp, readable on the bright panel.
        labelGradient: 'from-[#7c3aed] to-[#5b21b6]',
        accentColor: '#7c3aed',
        accentInk: '#5b21b6',
        warningInk: '#b0431a',
        isDark: false
    },
};
export const SYSTEM_LOGS = [
    { type: 'init', msg: 'System initializing...', time: 0 },
    { type: 'scan', msg: 'Scanning neural pathways...', time: 800 },
    { type: 'link', msg: 'Establishing connection to the Spire...', time: 1600 }
];
export const ITEMS_PER_FLOOR = 20;
