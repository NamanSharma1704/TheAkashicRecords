import { Quest } from '../core/types';

// Rank thresholds are based on number of TITLES tracked (library size)
export const USER_RANKS = [
    { label: 'DORMANT', minTitles: 0, color: 'text-stone-400', bg: 'bg-stone-500/20', border: 'border-stone-500/30' },
    { label: 'AWAKENED', minTitles: 3, color: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/30' },
    { label: 'INITIATE', minTitles: 7, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
    { label: 'HUNTER', minTitles: 15, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    { label: 'ELITE', minTitles: 25, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
    { label: 'ASCENDANT', minTitles: 40, color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30' },
    { label: 'SOVEREIGN', minTitles: 60, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]' },
    { label: 'NATIONAL', minTitles: 85, color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.6)]' },
    { label: 'MONARCH', minTitles: 120, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', glow: 'shadow-[0_0_25px_rgba(192,38,211,0.7)]' },
];

// Player rank is determined by how many titles they have tracked
export const getPlayerRank = (titleCount: number) => {
    return [...USER_RANKS].reverse().find(r => titleCount >= r.minTitles) || USER_RANKS[0];
};

export const getThemedRankStyle = (theme: string, isRankS: boolean = false) => {
    switch (theme) {
        case 'LIGHT': return isRankS ? 'text-amber-600' : 'text-slate-800';
        case 'SYSTEM': return isRankS ? 'text-amber-400' : 'text-cyan-400';
        case 'DARK': return isRankS ? 'text-amber-400' : 'text-cyan-400';
        default: return isRankS ? 'text-amber-400' : 'text-cyan-400';
    }
};

export const calculateQuestRank = (quest: Quest) => {
    const chapters = quest.totalChapters || 0;
    if (chapters > 500) return 'S';
    if (chapters > 200) return 'A';
    if (chapters > 100) return 'B';
    if (chapters > 50) return 'C';
    if (chapters > 20) return 'D';
    return 'E';
};
