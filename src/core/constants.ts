
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
        // Arcanum: a monochromatic AMETHYST theme — one hue across its whole value scale, the
        // same self-matching structure that makes black/white/amber cohere, but a separate
        // identity from the amber Void. Neutrals are violet-tinted so ground, ink, borders and
        // accent all belong to one family; a true aubergine near-black gives the full value
        // range (~12:1) that carries definition, and amethyst is the disciplined 10% accent.
        appBg: 'bg-[#f1edf7]',
        panelBg: 'bg-[#fcfaff]',
        modalBg: 'bg-[#f6f1fc]',
        inputBg: 'bg-[#eae3f5]',
        // Aubergine near-black for ink — the "black" of this theme, giving the black-to-white
        // value range that definition needs. Body and muted step up in lightness, still violet.
        baseText: 'text-[#463a5c]',
        headingText: 'text-[#241a33]',
        mutedText: 'text-[#655a80]',
        // Accent text is deep amethyst — ~6.5:1 on the lilac vellum, readable at every size.
        highlightText: 'text-[#5b21b6]',
        // An amethyst hairline for structural accent edges; the quiet divider is a soft
        // violet-grey so not every line shouts.
        border: 'border-[#8b5cf6]',
        borderSubtle: 'border-[#d3cae8]',
        overlay: 'bg-[#e7ddf5]/85',
        // Deep amethyst ink for the field's contour rings, grid and linework, so the HUD carries
        // the same density of visible detail the void does — violet ink drawn on lilac vellum.
        starColor: '74, 40, 120',
        gradient: 'from-[#7c3aed] to-[#a78bfa]',
        // The wordmark shimmer is amethyst too — Arcanum has one hue, no gold. Tuned for big
        // display text: a bright violet start, a luminous #a855f7 mid, deepening slightly at the
        // end so it still grounds. The lightest stop clears the 3:1 large-text floor on the
        // vellum; small labels use labelGradient below, which stays darker for 4.5:1.
        inkGradient: 'from-[#7c3aed] via-[#a855f7] to-[#6d28d9]',
        // Readable ramp for section labels at 9–11px: a bright-but-safe #7c3aed through the deep
        // ink, every stop clearing 4.5:1 on the panel.
        labelGradient: 'from-[#7c3aed] to-[#5b21b6]',
        // The accent is amethyst: a vivid violet for decorative chrome (fills, glows, progress,
        // borders, bloom-halos) and a deep amethyst ink for anything read (rank, values, accent
        // text). One hue, its own identity, carrying both vibrance and definition.
        accentColor: '#7c3aed',
        accentInk: '#5b21b6',
        // Vermilion, kept distinct from the amethyst so a warning never reads as chrome.
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
