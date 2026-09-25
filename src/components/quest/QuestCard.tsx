import React from 'react';
import { motion } from 'motion/react';
import { Theme, Quest, Rank } from '../../core/types';
import { Fingerprint, BookOpen } from 'lucide-react';
import { getProxiedImageUrl } from '../../utils/api';
import RankSigil from './RankSigil';

interface DivineMonolithProps {
    item: Quest;
    onClick: (id: string) => void;
    index: number;
    id: string;
    theme: Theme;
    rankStyle: Rank;
}

const QuestCard = React.memo<DivineMonolithProps>(({ item, onClick, index, id, theme, rankStyle }) => {
    return (
        <motion.div 
            id={id} 
            onClick={() => onClick(item.id)}
            // A card is a control: reachable by Tab, named, and opened with Enter or Space.
            // Keyboard focus unlocks it exactly as hover does (the group-focus-visible
            // variants below), so what a pointer reveals, focus reveals too.
            role="button"
            tabIndex={0}
            aria-label={`${item.title} — rank ${rankStyle.name}, ${item.status}, chapter ${item.currentChapter}${item.totalChapters ? ` of ${item.totalChapters}` : ''}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item.id); }
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: [0, -10, 0],
                transition: {
                    y: {
                        duration: 4 + (index % 3),
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.2
                    },
                    opacity: { duration: 0.5, delay: index * 0.1 },
                    scale: { duration: 0.5, delay: index * 0.1 }
                }
            }}
            whileHover={{ 
                scale: 1.05, 
                rotateY: 5, 
                rotateX: -5,
                transition: { duration: 0.3 } 
            }}
            whileTap={{ scale: 0.95 }}
            className={`group relative cursor-pointer perspective-1000 w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)] transition-shadow duration-700 rounded-lg border border-white/5 hover:border-white/20 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 ${theme.isDark ? 'focus-visible:outline-amber-400' : 'focus-visible:outline-[#155e75]'}`}
        >
            <div className={`relative w-full h-full ${theme.panelBg} border ${theme.borderSubtle} group-hover:border-opacity-0 transition-all duration-700 ease-out overflow-hidden rounded-lg shadow-2xl`}>
                <div className={`absolute inset-0 z-20 ${theme.overlay} group-hover:opacity-0 group-focus-visible:opacity-0 transition-opacity duration-700 flex flex-col items-center justify-center backdrop-blur-[2px]`} aria-hidden="true">
                    <div className={`w-[1px] h-16 ${rankStyle.bg} opacity-50 mb-4 shadow-[0_0_15px_currentColor]`} />
                    <Fingerprint size={32} className={`${rankStyle.color} opacity-30 animate-pulse`} />
                    <div className={`mt-4 text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase transition-colors duration-700`}>Stasis Locked</div>
                </div>
                <div className="absolute inset-0 z-10 opacity-40 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-700 grayscale group-hover:grayscale-0 group-focus-visible:grayscale-0">
                    <motion.img layoutId={`cover-${item.id}`} src={getProxiedImageUrl(item.coverUrl)} alt={`Cover art for ${item.title}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    {/* Light holds its scrim high enough to sit under the whole text block. At
                        white/20 the upper lines of a long title and the class label were over
                        almost bare cover art — 2.2–2.9:1 on a typical cover. */}
                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black via-black/20' : 'from-white via-white/85 via-55%'} to-transparent transition-colors duration-700`} />
                </div>
                <div className={`absolute inset-0 border-2 ${rankStyle.border} opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500 shadow-[inset_0_0_30px_currentColor]`} />

                {/* --- UNIQUE PER-RANK SIGIL --- */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-700 delay-100 z-40">
                    <RankSigil rank={rankStyle} theme={theme} />
                </div>

                <div className="absolute inset-0 z-30 p-6 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 group-focus-visible:translate-y-0 transition-transform duration-500">
                    {/* HIDE INFO UNTIL UNLOCKED (Fade in quickly on hover) */}
                    <div className="space-y-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500">
                        <div className={`text-[9px] font-mono ${theme.isDark ? rankStyle.color : (rankStyle.colorLight || rankStyle.color)} tracking-[0.2em] uppercase border-l-2 ${rankStyle.border} pl-2`}>{item.classType}</div>

                        <h3 className={`text-2xl font-black italic bg-clip-text text-transparent bg-gradient-to-b ${theme.isDark ? 'from-white via-gray-200 to-gray-400' : 'from-black via-slate-800 to-slate-700'} leading-none line-clamp-3 md:line-clamp-4 drop-shadow-sm transition-all duration-700 tracking-tighter uppercase`}>
                            {item.title}
                        </h3>

                        <div className={`h-[1px] w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} overflow-hidden relative transition-colors duration-700`}><div className={`absolute inset-0 w-full h-full ${rankStyle.bg} -translate-x-full group-hover:translate-x-0 group-focus-visible:translate-x-0 transition-transform duration-1000 delay-100`} /></div>
                        <div className={`flex justify-between items-center text-xs md:text-sm font-mono ${theme.mutedText} group-hover:${theme.baseText} transition-colors delay-300 duration-700`}>
                            <span className="flex items-center gap-2"><BookOpen size={14} /> CH: {item.currentChapter}</span>
                            <span className={`px-2 md:px-3 py-1 border ${theme.borderSubtle} ${item.status === 'SEVERED' ? (theme.id === 'LIGHT' ? 'bg-sky-500/10 text-sky-500 border-sky-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30') : theme.isDark ? 'bg-white/5' : 'bg-black/5'} transition-colors duration-700 uppercase tracking-widest`}>{item.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* REFLECTION REMOVED PER USER REQUEST */}
        </motion.div>
    );
});

export default QuestCard;
