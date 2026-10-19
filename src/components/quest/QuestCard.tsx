import React from 'react';
import { motion } from 'motion/react';
import { Theme, Quest, Rank } from '../../core/types';
import { Fingerprint, BookOpen } from 'lucide-react';
import { getProxiedImageUrl } from '../../utils/api';
import RankSigil from './RankSigil';
import CoverArt from './CoverArt';

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
            // A card is a control: focusable, named, opened with Enter or Space. What the
            // hover reveals (cover, title, status, sigil) keyboard focus reveals too, via a
            // group-focus-visible beside each group-hover. A touch screen has no hover, so
            // there (hover:none) the card shows unlocked: title, class and status visible
            // before the tap that opens it, instead of every card reading "Stasis Locked".
            role="button"
            tabIndex={0}
            aria-label={`Open ${item.title}`}
            onClick={() => onClick(item.id)}
            onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onClick(item.id);
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
            className="group relative cursor-pointer perspective-1000 w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)] transition-shadow duration-700 rounded-lg border border-white/5 hover:border-white/20 focus-visible:border-white/20"
        >
            <div className={`relative w-full h-full ${theme.panelBg} border ${theme.borderSubtle} group-hover:border-opacity-0 group-focus-visible:border-opacity-0 transition-all duration-700 ease-out overflow-hidden rounded-lg shadow-2xl`}>
                <div className={`absolute inset-0 z-20 ${theme.overlay} group-hover:opacity-0 group-focus-visible:opacity-0 [@media(hover:none)]:opacity-0 transition-opacity duration-700 flex flex-col items-center justify-center backdrop-blur-[2px]`}>
                    <div className={`w-[1px] h-16 ${rankStyle.bg} opacity-50 mb-4 shadow-[0_0_15px_currentColor]`} />
                    <Fingerprint size={32} aria-hidden="true" className={`${rankStyle.color} opacity-30 animate-pulse`} />
                    <div className={`mt-4 text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase transition-colors duration-700`}>Stasis Locked</div>
                </div>
                <div className="absolute inset-0 z-10 opacity-40 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-700 grayscale group-hover:grayscale-0 group-focus-visible:grayscale-0 [@media(hover:none)]:grayscale-0">
                    {/* The monogram plate sits under the cover: a missing or dead cover (the
                        img hides itself on error) used to leave the card an empty panel. */}
                    <CoverArt title={item.title} size="card" className="absolute inset-0" />
                    {item.coverUrl && (
                        <motion.img layoutId={`cover-${item.id}`} src={getProxiedImageUrl(item.coverUrl)} alt="" className="relative w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black via-black/20' : 'from-black via-black/20'} to-transparent transition-colors duration-700`} />
                </div>
                <div className={`absolute inset-0 border-2 ${rankStyle.border} opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500 shadow-[inset_0_0_30px_currentColor]`} />

                {/* --- UNIQUE PER-RANK SIGIL --- */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-all duration-700 delay-100 z-40">
                    <RankSigil rank={rankStyle} theme={theme} />
                </div>

                <div className="absolute inset-0 z-30 p-6 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 group-focus-visible:translate-y-0 [@media(hover:none)]:translate-y-0 transition-transform duration-500">
                    {/* HIDE INFO UNTIL UNLOCKED (Fade in quickly on hover) */}
                    <div className="space-y-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity duration-500">
                        {/* Everything below sits on the black scrim (over art or the plate) in BOTH themes,
                            so it takes dark-plate inks in both; light's page inks measured ~2:1 here. */}
                        <div className={`text-[9px] font-mono ${rankStyle.color} tracking-[0.2em] uppercase border-l-2 ${rankStyle.border} pl-2`}>{item.classType}</div>

                        <h3 className={`text-2xl font-black italic bg-clip-text text-transparent bg-gradient-to-b ${theme.isDark ? 'from-white via-gray-200 to-gray-400' : 'from-white via-gray-200 to-gray-400'} leading-none line-clamp-3 md:line-clamp-4 drop-shadow-sm transition-all duration-700 tracking-tighter uppercase`}>
                            {item.title}
                        </h3>

                        <div className="h-[1px] w-full bg-white/10 overflow-hidden relative"><div className={`absolute inset-0 w-full h-full ${rankStyle.bg} -translate-x-full group-hover:translate-x-0 group-focus-visible:translate-x-0 transition-transform duration-1000 delay-100`} /></div>
                        <div className="flex justify-between items-center text-xs md:text-sm font-mono text-gray-400 group-hover:text-gray-300 transition-colors delay-300 duration-700">
                            <span className="flex items-center gap-2"><BookOpen size={14} aria-hidden="true" /> CH: {item.currentChapter}</span>
                            <span className={`px-2 md:px-3 py-1 border ${item.status === 'SEVERED' ? 'bg-accent-soft text-accent-plate border-accent-line' : 'border-white/10 bg-white/5'} uppercase tracking-widest`}>{item.status}</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

export default QuestCard;
