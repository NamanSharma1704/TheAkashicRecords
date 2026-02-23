import React from 'react';
import { Theme, Quest, Rank } from '../../core/types';
import { Fingerprint, BookOpen } from 'lucide-react';

interface DivineMonolithProps {
    item: Quest;
    onClick: (id: string) => void;
    index: number;
    id: string;
    theme: Theme;
    rankStyle: Rank;
}

const QuestCard = React.memo<DivineMonolithProps>(({ item, onClick, index, id, theme, rankStyle }) => {
    // Randomize duration slightly for visual variety
    const animationDuration = `${5 + (index % 3)}s`;

    return (
        <div id={id} onClick={() => onClick(item._id!)} className="group relative cursor-pointer perspective-1000 w-full" style={{ animationName: 'float-item', animationDuration: animationDuration, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: `${index * 150}ms` }}>
            <div className={`relative aspect-[9/14] ${theme.panelBg} border ${theme.borderSubtle} group-hover:border-opacity-0 transition-all duration-700 ease-out overflow-hidden transform group-hover:scale-[1.02]`}>
                <div className={`absolute inset-0 z-20 ${theme.overlay} group-hover:opacity-0 transition-opacity duration-700 flex flex-col items-center justify-center`}>
                    <div className={`w-[1px] h-16 ${rankStyle.bg} opacity-50 mb-4 shadow-[0_0_15px_currentColor]`} />
                    <Fingerprint size={32} className={`${rankStyle.color} opacity-30 animate-pulse`} />
                    <div className={`mt-4 text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase transition-colors duration-700`}>Stasis Locked</div>
                </div>
                <div className="absolute inset-0 z-10 opacity-40 group-hover:opacity-100 transition-opacity duration-700 grayscale group-hover:grayscale-0">
                    <img src={item.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black via-black/20' : 'from-white via-white/20'} to-transparent transition-colors duration-700`} />
                </div>
                <div className={`absolute inset-0 border-2 ${rankStyle.border} opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_0_30px_currentColor]`} />

                {/* --- SPINNING RUNIC DIAMOND RANK ICON --- */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-700 delay-100 z-40">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        {/* Spinning outer runic diamond border */}
                        <div className={`absolute inset-0 border border-dashed ${rankStyle.border} rotate-45 animate-[spin_8s_linear_infinite] opacity-60 transition-colors duration-700`} />
                        {/* Static central diamond base */}
                        <div className={`w-7 h-7 rotate-45 border ${rankStyle.border} ${theme.isDark ? 'bg-black/90' : 'bg-white/90'} shadow-[0_0_15px_currentColor] flex items-center justify-center transition-colors duration-700`}>
                            {/* Counter-rotated text so it stays upright */}
                            <div className="-rotate-45 flex items-center justify-center w-full h-full">
                                <span className={`text-[10px] font-black font-mono ${rankStyle.color}`}>{rankStyle.name[0]}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute inset-0 z-30 p-6 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    {/* HIDE INFO UNTIL UNLOCKED (Fade in quickly on hover) */}
                    <div className="space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className={`text-[9px] font-mono ${rankStyle.color} tracking-[0.2em] uppercase border-l-2 ${rankStyle.border} pl-2`}>{item.classType}</div>

                        <h3
                            className={`text-2xl font-black italic bg-clip-text text-transparent bg-gradient-to-b ${theme.isDark ? 'from-white via-gray-200 to-gray-400' : 'from-black via-gray-700 to-gray-500'} leading-none line-clamp-3 md:line-clamp-4 drop-shadow-sm transition-all duration-700 tracking-tighter uppercase`}
                        >
                            {item.title}
                        </h3>

                        <div className={`h-[1px] w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} overflow-hidden relative transition-colors duration-700`}><div className={`absolute inset-0 w-full h-full ${rankStyle.bg} -translate-x-full group-hover:translate-x-0 transition-transform duration-1000 delay-100`} /></div>
                        <div className={`flex justify-between items-center text-[10px] font-mono ${theme.mutedText} group-hover:${theme.baseText} transition-colors delay-300 duration-700`}>
                            <span className="flex items-center gap-1"><BookOpen size={10} /> CH: {item.currentChapter} / {item.totalChapters || '?'}</span>
                            <span className={`px-2 py-0.5 border ${theme.borderSubtle} ${item.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : theme.isDark ? 'bg-white/5' : 'bg-black/5'} transition-colors duration-700`}>{item.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* REFLECTION REMOVED PER USER REQUEST */}
        </div>
    );
});

export default QuestCard;
