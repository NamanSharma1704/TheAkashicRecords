import { Quest, Rank } from '../core/types';

/**
 * Player ranks, earned by EXP: chapters read. They used to count titles in the library, so
 * adding 150 records reached MONARCH without reading a chapter. The thresholds are the old
 * title steps at ~100 chapters a title, so a reader lands near the rank their library implied.
 */
export const USER_RANKS = [
    { label: 'DRIFTER', minExp: 0 },
    { label: 'AWAKENED', minExp: 100 },
    { label: 'ADEPT', minExp: 500 },
    { label: 'VANGUARD', minExp: 1500 },
    { label: 'ASCENDANT', minExp: 3000 },
    { label: 'PARAGON', minExp: 5000 },
    { label: 'SOVEREIGN', minExp: 7500 },
    { label: 'ECLIPSE', minExp: 10000 },
    { label: 'MONARCH', minExp: 15000 },
    // BEYOND MONARCH (2026-11-13): the Transcendent tiers, so the ladder does not end where the
    // owner was about to arrive (10,936 EXP at the time). Still chapters read and nothing else.
    { label: 'ABSOLUTE', minExp: 25000 },
    { label: 'PRIMORDIAL', minExp: 40000 },
    { label: 'AKASHIC', minExp: 60000 }
];

/** The first Transcendent tier's index: everything from here on is beyond MONARCH. */
export const TRANSCENDENT_FROM = 9;

/** How many ranks the profile's ladder shows at once (it slides along past MONARCH). */
export const LADDER_SPAN = 9;

/**
 * The ladder's window: nine ranks ending at the rank after yours, never before the ninth. Until
 * MONARCH it is the whole original ladder; from MONARCH on it slides, so the next tier is always
 * on it and nine labels never have to share the width twelve would need.
 */
export const ladderWindow = (rankIndex: number) => {
    const end = Math.min(USER_RANKS.length - 1, Math.max(LADDER_SPAN - 1, rankIndex + 1));
    const start = end - (LADDER_SPAN - 1);
    return { start, ranks: USER_RANKS.slice(start, end + 1) };
};

/** EXP: chapters read across the library, each record's current chapter (so reading done
 *  before the tracker existed counts too). */
export const expOf = (items: { currentChapter: number }[]) => items.reduce((sum, q) => sum + (q.currentChapter || 0), 0);

export const getPlayerRank = (exp: number) => {
    return [...USER_RANKS].reverse().find(r => exp >= r.minExp) || USER_RANKS[0];
};

/**
 * The avatar's frame evolves with rank: five stages over the first nine ranks, two ranks a stage
 * and the last one MONARCH's alone, then one for each Transcendent tier, each built on the one
 * before. Drawn by EntityAvatar (see AvatarStage.tsx).
 */
export const AVATAR_STAGES = ['DORMANT', 'FORGED', 'ARGENT', 'PRISMATIC', 'SINGULARITY', 'BINARY', 'GENESIS', 'CODEX'] as const;
const STAGE_OF_RANK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7];   // by USER_RANKS index
/** The frame stage (0-4) a rank wears; 0 for no rank or one older builds wrote. */
export const avatarStageOf = (rankLabel?: string) => {
    const i = USER_RANKS.findIndex(r => r.label === rankLabel);
    return i < 0 ? 0 : STAGE_OF_RANK[i];
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
