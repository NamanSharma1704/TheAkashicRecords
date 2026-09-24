
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
        accentColor: '#f59e0b',
        accentInk: '#f59e0b',
        warningInk: '#f59e0b',
        isDark: true
    },
    LIGHT: {
        id: 'LIGHT',
        name: 'Light Mode',
        primary: 'sky',
        accent: 'indigo',
        appBg: 'bg-[#e9eef5]',
        panelBg: 'bg-white',
        modalBg: 'bg-[#f0f9ff]',
        inputBg: 'bg-slate-100',
        baseText: 'text-slate-700',
        headingText: 'text-slate-900',
        mutedText: 'text-slate-600',
        highlightText: 'text-[#155e75]',
        border: 'border-[#06b6d4]',
        borderSubtle: 'border-slate-300',
        overlay: 'bg-white/80',
        // Ink for the background field, not a glow colour. The field draws contour rings
        // and linework, so on a pale page this has to be slate rather than the accent —
        // cyan at these alphas over #e9eef5 never resolved into anything.
        starColor: '71, 85, 105',
        gradient: 'from-[#06b6d4] to-cyan-500',
        accentColor: '#06b6d4',
        accentInk: '#155e75',
        // amber-800. Same meaning as dark's amber-500, four steps down so it survives the page.
        warningInk: '#92400e',
        isDark: false
    },
};
export const SYSTEM_LOGS = [
    { type: 'init', msg: 'System initializing...', time: 0 },
    { type: 'scan', msg: 'Scanning neural pathways...', time: 800 },
    { type: 'link', msg: 'Establishing connection to the Spire...', time: 1600 }
];
export const ITEMS_PER_FLOOR = 20;
