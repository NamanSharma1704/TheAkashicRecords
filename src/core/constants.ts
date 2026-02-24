export const BASE_QUESTS = [
    {
        id: '1',
        title: 'TOWER OF GOD',
        status: 'ACTIVE',
        currentChapter: 580,
        totalChapters: 600,
        lastRead: Date.now(),
        classType: 'S-RANK',
        cover: 'https://images2.alphacoders.com/107/1079366.jpg',
        readLink: 'https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95'
    },
    {
        id: '2',
        title: 'SOLO LEVELING',
        status: 'ACTIVE',
        currentChapter: 179,
        totalChapters: 179,
        lastRead: Date.now() - 86400000,
        classType: 'NATIONAL',
        cover: 'https://wallpaperaccess.com/full/2405389.jpg',
        readLink: 'https://sololevelingmanhwa.com/'
    },
    {
        id: '3',
        title: 'THE BEGINNING AFTER THE END',
        status: 'IN_PROGRESS',
        currentChapter: 175,
        totalChapters: 175,
        lastRead: Date.now() - 172800000,
        classType: 'MAGE',
        cover: 'https://wallpapercave.com/wp/wp8922416.jpg',
        readLink: 'https://tapas.io/series/tbate-comic/info'
    }
];
import { Theme } from './types';

export const THEMES: Record<string, Theme> = {
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
        mutedText: 'text-gray-500',
        highlightText: 'text-[#f59e0b]',
        border: 'border-[#f59e0b]',
        borderSubtle: 'border-white/10',
        shadow: 'shadow-[#f59e0b]/50',
        glow: 'shadow-[#f59e0b]/50',
        overlay: 'bg-black/80',
        starColor: '255, 255, 255',
        gradient: 'from-[#f59e0b] via-yellow-400 to-white',
        rayColor: 'rgba(245, 158, 11, 0.08)',
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
        isDark: false
    },
    SYSTEM: {
        id: 'SYSTEM',
        name: 'System Mode',
        primary: 'bg-slate-900',
        accent: 'bg-cyan-500',
        appBg: 'bg-slate-950',
        panelBg: 'bg-slate-900/80',
        modalBg: 'bg-slate-950/95',
        inputBg: 'bg-black/50',
        baseText: 'text-slate-300',
        headingText: 'text-cyan-50',
        mutedText: 'text-slate-500',
        highlightText: 'text-cyan-400',
        border: 'border-cyan-900/50',
        borderSubtle: 'border-cyan-950/50',
        shadow: 'shadow-[0_0_15px_rgba(0,0,0,0.5)]',
        glow: 'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
        overlay: 'bg-black/60',
        starColor: '34, 211, 238', // Cyan-400 RGB
        gradient: 'from-cyan-400 to-blue-500',
        rayColor: 'from-cyan-500/10',
        isDark: true
    },
    BLOOD: {
        id: 'BLOOD',
        name: 'Blood Mode',
        primary: 'bg-stone-950',
        accent: 'bg-red-500',
        appBg: 'bg-black',
        panelBg: 'bg-stone-900/80',
        modalBg: 'bg-stone-950/95',
        inputBg: 'bg-black/50',
        baseText: 'text-stone-300',
        headingText: 'text-red-50',
        mutedText: 'text-stone-500',
        highlightText: 'text-red-500',
        border: 'border-red-900/30',
        borderSubtle: 'border-red-950/50',
        shadow: 'shadow-[0_0_15px_rgba(0,0,0,0.5)]',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
        overlay: 'bg-black/70',
        starColor: '248, 113, 113', // Red-400 RGB
        gradient: 'from-red-500 to-rose-600',
        rayColor: 'from-red-500/10',
        isDark: true
    }
};
export const SYSTEM_LOGS = [
    { type: 'init', msg: 'System initializing...', time: 0 },
    { type: 'scan', msg: 'Scanning neural pathways...', time: 800 },
    { type: 'link', msg: 'Establishing connection to the Spire...', time: 1600 }
];
export const ITEMS_PER_FLOOR = 20;
