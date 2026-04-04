import React, { useMemo } from 'react';
import { Quest } from '../../core/types';
import SystemFrame from '../system/SystemFrame';
import { getPlayerRank } from '../../utils/ranks';
import EntityAvatar from '../system/EntityAvatar';
import { Activity, Target, Layers, Database, Sword } from 'lucide-react';

interface TowerHUDProps {
    items: Quest[];
    theme: any;
    onActivate: (id: string) => void;
    isFocused?: boolean;
    selectedFloorIndex?: number;
    itemsPerFloor?: number;
    streak?: number;
    dailyAbsorbed?: number;
}

const TowerHUD: React.FC<TowerHUDProps> = ({ items, theme, onActivate, isFocused = false, selectedFloorIndex = 0, itemsPerFloor = 5, streak = 0, dailyAbsorbed }) => {
    // 1. Memoize Stats and Data Slicing
    const { displayItems, totalManhwa, displayChapters, completedManhwa, recents, classEntries } = useMemo(() => {
        const floorStart = selectedFloorIndex * itemsPerFloor;
        const _floorItems = items.slice(floorStart, floorStart + itemsPerFloor);
        const _displayItems = isFocused ? _floorItems : items;

        const _totalManhwa = _displayItems.length;
        const _displayChapters = _displayItems.reduce((acc, item) => acc + (item.currentChapter || 0), 0);
        const _completedManhwa = _displayItems.filter(i => i.status === 'CONQUERED').length;

        const _recents = items.filter(i => i.status === 'ACTIVE').sort((a, b) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA;
        }).slice(0, 3);

        const allowedClasses = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
        const classCounts: Record<string, number> = {
            'PLAYER': 0, 'IRREGULAR': 0, 'MAGE': 0, 'CONSTELLATION': 0, 'NECROMANCER': 0
        };

        _displayItems.forEach(i => {
            const c = i.classType || 'UNKNOWN';
            if (allowedClasses.includes(c)) {
                classCounts[c] += 1;
            }
        });

        const _classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

        return {
            displayItems: _displayItems,
            totalManhwa: _totalManhwa,
            displayChapters: _displayChapters,
            completedManhwa: _completedManhwa,
            recents: _recents,
            classEntries: _classEntries
        };
    }, [items, isFocused, selectedFloorIndex, itemsPerFloor]);

    // Derived Rank (Always based on global titles) - Memoize separately for clarity
    const rawRank = useMemo(() => getPlayerRank(items.length), [items.length]);

    return (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col overflow-hidden">
            {/* 1. Global Header Safe Area (Empty space to prevent header overlap) */}
            <div className="h-16 sm:h-20 shrink-0 transition-all duration-700" />

            {/* 2. Master HUD Content Container */}
            <div className="flex-1 w-full max-w-[1920px] mx-auto px-2 sm:px-4 md:px-4 lg:px-6 xl:px-8 flex justify-between items-start gap-2 lg:gap-4 xl:gap-12 pb-6 md:pb-10 transition-all duration-700">

                {/* LEFT WING: PLAYER METRICS & RANK */}
                <aside className={`hidden lg:flex flex-col gap-3 xl:gap-8 pointer-events-auto w-[26%] xl:w-[22%] min-w-[180px] lg:min-w-[200px] xl:min-w-[320px] max-w-[360px] xl:max-w-[440px] transition-all duration-1000 ease-in-out ${isFocused ? 'translate-x-0' : 'translate-x-0 opacity-100'}`}>
                    <SystemFrame variant="brackets" theme={theme} className="bg-transparent shadow-none w-full">
                        <div className="p-1 md:p-3 lg:p-4 space-y-3 lg:space-y-4">
                            <div className="flex flex-col border-b border-gray-500/20 pb-2 gap-1 lg:gap-2 w-full">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className={`${theme.highlightText} animate-spin`} />
                                    <span className={`text-[clamp(9px,1vw,12px)] font-bold tracking-[0.2em] ${theme.headingText} font-orbitron`}>PLAYER_METRICS</span>
                                </div>
                                {isFocused && (
                                    <span className={`text-[clamp(16px,2.5vw,28px)] font-black tracking-widest ${theme.highlightText} drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] font-orbitron italic animate-pulse`}>
                                        SECTOR {selectedFloorIndex + 1}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div className="flex flex-col">
                                    <div className={`text-[clamp(8px,0.8vw,10px)] ${theme.mutedText} font-mono uppercase tracking-widest`}>Read</div>
                                    <div className={`text-[clamp(18px,2vw,32px)] font-bold font-mono tabular-nums leading-tight ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{totalManhwa}</div>
                                </div>
                                <div className="flex flex-col">
                                    <div className={`text-[clamp(8px,0.8vw,10px)] ${theme.mutedText} font-mono uppercase tracking-widest`}>Chapters</div>
                                    <div className={`text-[clamp(18px,2vw,32px)] font-bold font-mono tabular-nums leading-tight ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{displayChapters.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col">
                                    <div className={`text-[clamp(8px,0.8vw,10px)] ${theme.mutedText} font-mono uppercase tracking-widest`}>Conquired</div>
                                    <div className={`text-[clamp(18px,2vw,32px)] font-bold font-mono tabular-nums leading-tight ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'}`}>{completedManhwa}</div>
                                </div>
                                <div className="flex flex-col">
                                    <div className={`text-[clamp(8px,0.8vw,10px)] ${theme.mutedText} font-mono uppercase tracking-widest`}>Streak</div>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`text-[clamp(18px,2vw,32px)] font-bold font-mono tabular-nums leading-tight ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'}`}>{streak}</div>
                                        <Activity size={12} className={theme.highlightText} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SystemFrame>

                    {/* RANK + TITLES DISCOVERED + DIVINE MANDATE — in a bracketed box like PLAYER_METRICS */}
                    {!isFocused && (
                        <div className="flex flex-col gap-4">
                            {/* Rank card */}
                            <div className="relative group min-h-[140px] flex flex-col justify-center">
                                <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
                                <div className="p-4 md:px-10 md:py-6 flex flex-row items-center gap-4 bg-transparent transition-all overflow-visible relative z-10">
                                    <EntityAvatar theme={theme} size={70} className="shrink-0 opacity-100 drop-shadow-2xl" />
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-[clamp(8px,1vw,10px)] ${theme.highlightText} font-bold font-mono uppercase tracking-[0.3em] mb-1`}>Status: Active</span>
                                        <div className="text-[clamp(18px,2vw,30px)] font-black font-orbitron italic tracking-tighter flex items-baseline leading-none overflow-visible">
                                            <span className={`inline-block text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} py-2 pr-10 whitespace-nowrap`}>{rawRank.label}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TITLES DISCOVERED + DIVINE MANDATE — bracketed box */}
                            <SystemFrame variant="brackets" theme={theme} className="bg-transparent shadow-none w-full">
                                <div className="p-3 lg:p-4 space-y-3">
                                    {/* TITLES DISCOVERED */}
                                    <div className="space-y-1.5">
                                        <div className={`flex justify-between text-[clamp(9px,1vw,11px)] font-mono font-bold ${theme.highlightText}`}>
                                            <span className="tracking-widest">TITLES DISCOVERED</span>
                                            <span>{totalManhwa} / 1000</span>
                                        </div>
                                        <div className={`h-1.5 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} relative overflow-hidden`}>
                                            <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, (totalManhwa / 10))}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                        </div>
                                    </div>

                                    {/* DIVINE MANDATE */}
                                    {dailyAbsorbed !== undefined && (
                                        <div className={`pt-3 border-t ${theme.isDark ? 'border-white/10' : 'border-black/10'} space-y-1.5`}>
                                            <div className="flex justify-between items-center">
                                                <div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[clamp(8px,0.9vw,10px)] tracking-widest font-bold`}>
                                                    <span>⚡</span> DIVINE_MANDATE
                                                </div>
                                                <span className={`text-[clamp(7px,0.8vw,9px)] font-mono ${theme.mutedText}`}>{dailyAbsorbed >= 5 ? '✓ CONQUERED' : 'PENDING'}</span>
                                            </div>
                                            <div className={`text-[clamp(7px,0.8vw,9px)] ${theme.mutedText} font-mono tracking-widest uppercase`}>OBJECTIVE</div>
                                            <div className="flex justify-between items-end">
                                                <span className={`text-[clamp(10px,1vw,12px)] font-black italic ${theme.headingText} tracking-wide`}>ABSORB 5 STORIES</span>
                                                <span className={`${theme.highlightText} font-mono font-bold text-[clamp(12px,1.2vw,16px)]`}>{Math.min(5, dailyAbsorbed)}<span className={`${theme.mutedText} text-[clamp(9px,0.9vw,11px)]`}>/5</span></span>
                                            </div>
                                            <div className={`h-1 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} relative overflow-hidden`}>
                                                <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`} style={{ width: `${Math.min(100, (dailyAbsorbed / 5) * 100)}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SystemFrame>
                        </div>
                    )}
                </aside>

                {/* CENTER: HERO ZONE (TOWER CLEARANCE) */}
                <div className="flex-1 min-w-0" />

                {/* RIGHT WING: ACTIVE LOG & DISTRIBUTION */}
                <aside className={`hidden lg:flex flex-col gap-3 xl:gap-8 items-end pointer-events-auto w-[26%] xl:w-[22%] min-w-[180px] lg:min-w-[200px] xl:min-w-[320px] max-w-[360px] xl:max-w-[440px] text-right transition-all duration-1000 ease-in-out ${isFocused ? 'translate-x-0' : 'translate-x-0 opacity-100'}`}>

                    {/* TOP MONOLITHS */}
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-3 ${theme.highlightText} w-full justify-end`}>
                            <span className="text-[clamp(10px,1vw,12px)] font-bold tracking-[0.2em] font-orbitron uppercase">TOP_REVELATIONS</span>
                            <Layers size={14} />
                        </div>
                        <div className="flex flex-col gap-3">
                            {[...displayItems].sort((a, b) => (b.totalChapters || 0) - (a.totalChapters || 0)).slice(0, 3).map((item, i) => (
                                <div key={item.id} className="flex flex-row-reverse items-center gap-3 group cursor-pointer" onClick={() => onActivate(item.id)}>
                                    <span className={`text-[clamp(18px,2vw,32px)] font-black font-mono ${i === 0 ? theme.highlightText : 'text-gray-500'} group-hover:scale-110 transition-transform`}>0{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[clamp(10px,1vw,12px)] font-bold truncate ${theme.headingText} group-hover:${theme.highlightText} transition-colors font-orbitron uppercase`}>{item.title}</div>
                                        <div className={`text-[clamp(9px,0.9vw,11px)] font-bold font-mono tabular-nums ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'}`}>{item.totalChapters} CHAPTERS</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CLASS DISTRIBUTION */}
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-3 mt-4 ${theme.highlightText} w-full justify-end`}>
                            <span className="text-[clamp(10px,1vw,12px)] font-bold tracking-[0.2em] font-orbitron uppercase">SYNERGY_INDEX</span>
                            <Database size={14} />
                        </div>
                        <div className="space-y-4">
                            {classEntries.slice(0, 4).map(([cls, count]) => {
                                const pct = totalManhwa > 0 ? Math.round((count / totalManhwa) * 100) : 0;
                                return (
                                    <div key={cls} className="space-y-1.5">
                                        <div className="flex justify-between items-end">
                                            <span className={`text-[clamp(9px,1vw,11px)] font-mono tabular-nums ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'}`}>{count}</span>
                                            <span className={`text-[clamp(8px,0.8vw,10px)] font-bold ${theme.headingText} uppercase tracking-[0.2em] font-orbitron`}>{cls}</span>
                                        </div>
                                        <div className={`h-1 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} flex justify-end`}>
                                            <div className={`h-full transition-all duration-1000 bg-gradient-to-l ${theme.gradient} progress-bloom`} style={{ width: `${pct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ACTIVE QUESTS QUICK-NAV */}
                    <div className="w-full mt-auto">
                        <div className={`flex items-center gap-2 mb-3 ${theme.highlightText} w-full justify-end`}>
                            <span className="text-[clamp(10px,1vw,12px)] font-bold tracking-[0.2em] font-orbitron uppercase">RECENT_DATA</span>
                            <Sword size={14} />
                        </div>
                        <div className="flex flex-col gap-2">
                            {recents.map(item => (
                                <div key={item.id} onClick={() => onActivate(item.id)} className="group flex flex-row-reverse items-center gap-3 cursor-pointer p-1 transition-all">
                                    <div className="w-8 h-8 lg:w-10 lg:h-10 shrink-0 overflow-hidden border border-white/5 grayscale group-hover:grayscale-0 transition-all duration-500">
                                        <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[clamp(9px,0.9vw,11px)] font-bold truncate ${theme.headingText} group-hover:${theme.highlightText} transition-colors uppercase font-orbitron`}>{item.title}</div>
                                        <div className={`text-[clamp(8px,0.8vw,10px)] font-mono ${theme.mutedText}`}>CH. {item.currentChapter}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* 3. MOBILE ONLY DOCK (BOTTOM FLOATING BAR) */}
                <div className="lg:hidden flex absolute bottom-4 inset-x-0 pointer-events-auto justify-center z-50 px-2">
                    <SystemFrame variant="brackets" theme={theme} className="bg-black/85 backdrop-blur-xl w-full">
                        {/* ROW 1: RANK + PROGRESS */}
                        <div className={`px-4 pt-2.5 pb-1.5 flex items-center gap-3 border-b ${theme.borderSubtle}`}>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Target size={10} className={theme.highlightText} />
                                <span className={`text-[11px] font-black tracking-widest font-orbitron ${theme.highlightText} uppercase`}>{rawRank.label}</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-0.5">
                                <div className={`h-1 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} relative overflow-hidden`}>
                                    <div className={`h-full bg-gradient-to-r ${theme.gradient} transition-all duration-1000`} style={{ width: `${Math.min(100, (totalManhwa / 10))}%` }} />
                                </div>
                                <span className={`text-[7px] font-mono ${theme.mutedText} text-right`}>{totalManhwa}/1000 TITLES</span>
                            </div>
                        </div>
                        {/* ROW 2: STATS GRID */}
                        <div className="py-2 px-3 flex items-center justify-around gap-0.5">
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Titles</span>
                                <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{totalManhwa}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Active</span>
                                <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{totalManhwa - completedManhwa}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Conquered</span>
                                <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{completedManhwa}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Avg Ch</span>
                                <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{totalManhwa > 0 ? Math.round(displayChapters / totalManhwa) : 0}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Chapters</span>
                                <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'}`}>{displayChapters.toLocaleString()}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className={`text-[7px] ${theme.mutedText} font-mono uppercase tracking-tighter`}>Streak</span>
                                <div className="flex items-center gap-0.5">
                                    <span className={`text-[13px] font-bold ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'}`}>{streak}</span>
                                    <Activity size={8} className={theme.highlightText} />
                                </div>
                            </div>
                        </div>
                    </SystemFrame>
                </div>
            </div>
        </div>
    );
};

export default TowerHUD;
