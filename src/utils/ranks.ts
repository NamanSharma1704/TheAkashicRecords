import { Quest, Rank } from '../core/types';

export const USER_RANKS = [
    { label: 'DRIFTER', minTitles: 0 },
    { label: 'AWAKENED', minTitles: 1 },
    { label: 'ADEPT', minTitles: 5 },
    { label: 'VANGUARD', minTitles: 15 },
    { label: 'ASCENDANT', minTitles: 30 },
    { label: 'PARAGON', minTitles: 50 },
    { label: 'SOVEREIGN', minTitles: 75 },
    { label: 'ECLIPSE', minTitles: 100 },
    { label: 'MONARCH', minTitles: 150 }
];

export const getPlayerRank = (titlesTracked: number) => {
    return [...USER_RANKS].reverse().find(r => titlesTracked >= r.minTitles) || USER_RANKS[0];
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

const QUEST_RANKS: Record<string, Rank> = {
    'S': { name: 'S', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
    'A': { name: 'A', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30' },
    'B': { name: 'B', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
    'C': { name: 'C', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    'D': { name: 'D', color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30' },
    'E': { name: 'E', color: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/30' }
};

export const getQuestRankObj = (quest: Quest) => {
    return QUEST_RANKS[calculateQuestRank(quest)] || QUEST_RANKS['E'];
};
