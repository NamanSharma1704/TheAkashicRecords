
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
        shadow: 'shadow-[#f59e0b]/50',
        glow: 'shadow-[#f59e0b]/50',
        overlay: 'bg-black/80',
        starColor: '255, 255, 255',
        gradient: 'from-[#f59e0b] via-yellow-400 to-white',
        rayColor: 'rgba(245, 158, 11, 0.08)',
        accentColor: '#f59e0b',
        isDark: true
    },
    LIGHT: {
        id: 'LIGHT',
        name: 'Light Mode',
        primary: 'sky',
        accent: 'indigo',
        appBg: 'bg-slate-50',
        panelBg: 'bg-white',
        modalBg: 'bg-[#f0f9ff]',
        inputBg: 'bg-slate-100',
        baseText: 'text-slate-600',
        headingText: 'text-slate-900',
        mutedText: 'text-slate-400',
        highlightText: 'text-[#06b6d4]',
        border: 'border-[#06b6d4]',
        borderSubtle: 'border-slate-200',
        shadow: 'shadow-[#06b6d4]/20',
        glow: 'shadow-[#06b6d4]/50',
        overlay: 'bg-white/80',
        starColor: '6, 182, 212',
        gradient: 'from-[#06b6d4] to-cyan-500',
        rayColor: 'rgba(6, 182, 212, 0.15)',
        accentColor: '#06b6d4',
        isDark: false
    },
};
export const SYSTEM_LOGS = [
    { type: 'init', msg: 'System initializing...', time: 0 },
    { type: 'scan', msg: 'Scanning neural pathways...', time: 800 },
    { type: 'link', msg: 'Establishing connection to the Spire...', time: 1600 }
];
export const ITEMS_PER_FLOOR = 20;
