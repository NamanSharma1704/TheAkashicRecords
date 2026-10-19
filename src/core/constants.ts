
import { Theme } from './types';

/**
 * The two themes the app ships: Void (dark, amber) and Arcanum (light, amethyst).
 *
 * Typed as an exact record rather than Record<string, Theme> so the header toggle and
 * any future theme switcher can only ever name a theme that exists — a missing key is a
 * compile error instead of an undefined lookup at runtime. A third theme means adding it
 * here and widening ThemeId; theme checks across the app are binary (`theme.isDark`).
 */
export type ThemeId = 'DARK' | 'LIGHT';

export const THEMES: Record<ThemeId, Theme> = {
    DARK: {
        id: 'DARK',
        appBg: 'bg-[#020202]',
        panelBg: 'bg-[#0a0a0c]',
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
        // Accent family (see Theme): amber-500 throughout.
        accentFillRGB: '245, 158, 11',
        accentSolid: '#f59e0b',
        accentIcon: '#f59e0b',
        accentSurface: '#14120e',
        accentEdge: '#f59e0b8c',
        accentOn: '#000000',
        accentPlateInk: '#f59e0b',
        isDark: true
    },
    LIGHT: {
        id: 'LIGHT',
        // Arcanum — a BRIGHT amethyst day theme, but not a flat white page. A light field reads as
        // a surface, so its immersion comes from a RICH, saturated luminous atmosphere behind the
        // content (see GalaxyNebula / IlluminatedCodex): a radiant amethyst sky with real nebula
        // depth. The ground stays bright so panels and dark violet ink read; the "feel" lives in
        // the atmosphere, not in darkness. Neutrals are violet-tinted so the whole family coheres.
        appBg: 'bg-[#e9e2f6]',
        panelBg: 'bg-[#fbf9ff]',
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
        // Accent family (see Theme): fills and lines on violet-500, icons on violet-600.
        accentFillRGB: '139, 92, 246',
        accentSolid: '#8b5cf6',
        accentIcon: '#7c3aed',
        accentSurface: '#f6f1fc',
        accentEdge: '#7c3aed73',
        accentOn: '#ffffff',
        // violet-300: the pale amethyst that reads on the near-black plates light keeps.
        accentPlateInk: '#c4b5fd',
        isDark: false
    },
};
export const SYSTEM_LOGS = [
    { type: 'init', msg: 'System initializing...', time: 0 },
    { type: 'scan', msg: 'Scanning neural pathways...', time: 800 },
    { type: 'link', msg: 'Establishing connection to the Spire...', time: 1600 }
];
export const ITEMS_PER_FLOOR = 20;
