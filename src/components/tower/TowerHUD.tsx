import { Quest } from '../../core/types';
import SystemFrame from '../system/SystemFrame';
import { getPlayerRank } from '../../utils/ranks';
import { Activity, Target, Layers, Crown, Database, Sword } from 'lucide-react';

interface TowerHUDProps {
    items: Quest[];
    theme: any;
    onActivate: (id: string) => void;
    isFocused?: boolean;
    selectedFloorIndex?: number;
    itemsPerFloor?: number;
    streak?: number;
}

const TowerHUD: React.FC<TowerHUDProps> = ({ items, theme, onActivate, isFocused = false, selectedFloorIndex = 0, itemsPerFloor = 5, streak = 0 }) => {
    // 1. Calculate Stats
    const floorStart = selectedFloorIndex * itemsPerFloor;
    const floorItems = items.slice(floorStart, floorStart + itemsPerFloor);

    // Display values based on focus
    const displayItems = isFocused ? floorItems : items;
    const totalManhwa = displayItems.length;
    // For calculating rank, we always use GLOBAL totalChapters, but for display (if focused) we use floor chapters
    const displayChapters = displayItems.reduce((acc, item) => acc + (item.currentChapter || 0), 0);

    const completedManhwa = displayItems.filter(i => i.status === 'CONQUERED').length;

    // Derived Rank (Always based on global titles)
    const rawRank = getPlayerRank(items.length);

    // 2. Recent Conquests (Top 3)
    const recents = [...displayItems].sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
    }).slice(0, 3);
    // Class distribution
    const allowedClasses = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
    const classCounts: Record<string, number> = {
        'PLAYER': 0, 'IRREGULAR': 0, 'MAGE': 0, 'CONSTELLATION': 0, 'NECROMANCER': 0
    };
    displayItems.forEach(i => {
        const c = i.classType || 'UNKNOWN';
        if (allowedClasses.includes(c)) {
            classCounts[c] += 1;
        }
    });

    const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

    return (
        <div className={`absolute inset-0 z-30 pointer-events-none pt-24 md:pt-24 px-2 md:px-8 pb-6 md:pb-8 flex flex-row items-center md:items-start justify-between overflow-hidden gap-1 md:gap-6 ${isFocused ? 'hidden md:flex' : 'flex'}`}>
            {/* LEFT: STATS PANEL */}
            <div className={`flex flex-col gap-2 md:gap-6 pointer-events-auto w-[45%] sm:w-[40%] md:w-[45%] max-w-xs transition-transform duration-700 ease-in-out ${isFocused ? 'translate-y-0' : 'translate-y-0'}`}>
                <SystemFrame variant="brackets" theme={theme} className="bg-transparent shadow-none w-full">
                    <div className="p-1 md:p-4 space-y-2 md:space-y-4">
                        <div className="flex flex-col border-b border-gray-500/30 pb-2 gap-1 md:gap-2 w-full">
                            <div className="flex items-center gap-2 md:gap-3">
                                <Activity size={12} className={`${theme.highlightText} md:w-[14px] md:h-[14px]`} />
                                <span className={`text-[8px] md:text-xs font-bold tracking-tighter sm:tracking-widest ${theme.headingText} font-orbitron`}>PLAYER_METRICS</span>
                            </div>
                            {isFocused && (
                                <span className={`text-[10px] md:text-lg font-black tracking-widest ${theme.highlightText} drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.5)] font-orbitron italic`}>
                                    SECTOR {selectedFloorIndex + 1}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 md:gap-y-4 gap-x-2">
                            <div className="flex flex-col items-start">
                                <div className={`text-[8px] md:text-xs ${theme.mutedText} font-rajdhani font-medium tracking-wide uppercase`}>Read</div>
                                <div className={`text-sm md:text-2xl font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} `}>{totalManhwa}</div>
                            </div>
                            <div className="flex flex-col items-start">
                                <div className={`text-[8px] md:text-xs ${theme.mutedText} font-rajdhani font-medium tracking-wide uppercase`}>Chapters</div>
                                <div className={`text-sm md:text-2xl font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} `}>{displayChapters.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col items-start">
                                <div className={`text-[8px] md:text-xs ${theme.mutedText} font-rajdhani font-medium tracking-wide uppercase`}>Conq.</div>
                                <div className={`text-sm md:text-2xl font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'} `}>{completedManhwa}</div>
                            </div>
                            <div className="flex flex-col items-start">
                                <div className={`text-[8px] md:text-xs ${theme.mutedText} font-rajdhani font-medium tracking-wide uppercase`}>Streak</div>
                                <div className={`text-sm md:text-2xl font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-400' : 'text-cyan-600'} `}>{streak}</div>
                            </div>
                        </div>
                    </div>
                </SystemFrame>



                {/* RANK DISPLAY - ALWAYS VISIBLE SIDE PANEL STYLE */}
                {!isFocused && (
                    <div className="flex flex-col gap-4 md:gap-6">
                        <div className="relative overflow-hidden group">
                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                            <div className={`p-1.5 md:p-3 flex flex-row items-center gap-4 md:gap-6 bg-transparent`}>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className={`text-[7px] md:text-[9px] ${theme.highlightText} font-bold font-mono uppercase tracking-tighter md:tracking-widest mb-1 opacity-100`}>Current Rank</span>
                                    <div className="text-xl md:text-2xl lg:text-3xl font-black font-manifold italic tracking-tight drop-shadow-sm flex items-baseline leading-normal min-w-0">
                                        <span className={`inline-block text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} truncate w-full`}>{rawRank.label}</span>
                                    </div>
                                </div>
                                <Crown size={isFocused ? 12 : 24} className={`shrink-0 ${theme.highlightText} drop-shadow-lg opacity-80 md:w-10 md:h-10`} />
                            </div>
                        </div>

                        {/* EXP BAR */}
                        <div className={`p-3 bg-transparent`}>
                            <div className={`flex justify-between text-[8px] md:text-xs font-mono font-bold ${theme.highlightText} mb-2`}>
                                <span className="truncate">TITLES DISCOVERED</span>
                                <span className="whitespace-nowrap">{totalManhwa} TITLES</span>
                            </div>
                            <div className={`h-1.5 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} `}>
                                <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`} style={{ width: `${Math.min(100, (totalManhwa % 50) / 0.5)}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                            </div>
                            <div className={`flex justify-between text-[10px] font-mono ${theme.mutedText} mt-1.5`}>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT: TOWER LOG & DETAILS (Always Visibile Side Layout) */}
            <div className={`pointer-events-auto flex flex-col items-end gap-2 md:gap-3 w-[45%] sm:w-[40%] md:w-72 max-w-xs transition-transform duration-700 ease-in-out ${isFocused ? 'translate-y-[0]' : 'translate-y-0'}`}>

                {/* ACTIVE QUESTS / RECENT CONQUESTS */}
                <div className="w-full">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText} w-full`}>
                        <div className={`h-[2px] w-12 md:w-20 bg-gradient-to-r from-transparent ${theme.isDark ? 'to-amber-400' : 'to-cyan-600'} opacity-50`} />
                        <span className="text-[8px] md:text-[10px] font-bold tracking-tighter md:tracking-widest text-right font-orbitron uppercase">ACTIVE QUESTS</span>
                        <Sword size={12} className="md:w-[14px] md:h-[14px]" />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        {recents.map(item => (
                            <div
                                key={item.id}
                                onClick={() => onActivate(item.id)}
                                className={`group relative h-8 md:h-14 bg-transparent transition-all overflow-hidden flex items-center justify-start pl-1 md:pl-3 pr-1 md:pr-2 cursor-pointer hover:border-${theme.primary}-500/50`}
                            >
                                <div className="w-5 md:w-10 h-full shrink-0 relative mr-1.5 md:mr-3">
                                    <img src={item.coverUrl} className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                                    <span className={`text-sm font-semibold truncate ${theme.headingText} group-hover:${theme.highlightText} transition-colors font-rajdhani`}>{item.title}</span>
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 justify-start">
                                        <span className={`font-rajdhani font-bold tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} text-xs`}>CH: {item.currentChapter}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CLASS DISTRIBUTION */}
                <div className="w-full">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText} w-full`}>
                        <div className={`h-[2px] w-12 md:w-20 bg-gradient-to-r from-transparent ${theme.isDark ? 'to-amber-400' : 'to-cyan-600'} opacity-50`} />
                        <span className="text-[10px] font-bold tracking-widest text-right font-orbitron uppercase">CLASS_DISTRIBUTION</span>
                        <Database size={14} />
                    </div>
                    {displayItems.length > 0 && (
                        <div className={`bg-transparent p-1.5 md:p-3 flex flex-col gap-1 md:gap-3`}>
                            {(() => {
                                return classEntries.slice(0, 5).map(([cls, count]) => {
                                    const pct = totalManhwa > 0 ? Math.round((count / totalManhwa) * 100) : 0;
                                    return (
                                        <div key={cls}>
                                            <div className="flex justify-between mb-1">
                                                <span className={`text-[10px] font-bold ${theme.headingText} uppercase tracking-wider font-rajdhani`}>{cls}</span>
                                                <span className={`text-[10px] font-bold font-mono tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} `}>{count}</span>
                                            </div>
                                            <div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} `}>
                                                <div className={`h-full transition-all duration-700 bg-gradient-to-r ${theme.gradient} progress-bloom `} style={{ width: `${pct}% `, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>


                {/* TOP MONOLITHS */}
                <div className="w-full">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText} w-full`}>
                        <div className={`h-[2px] w-12 md:w-20 bg-gradient-to-r from-transparent ${theme.isDark ? 'to-amber-400' : 'to-cyan-600'} opacity-50`} />
                        <span className="text-[8px] md:text-[10px] font-bold tracking-tighter md:tracking-widest text-right font-orbitron uppercase">TOP_MONOLITHS</span>
                        <Layers size={12} className="md:w-[14px] md:h-[14px]" />
                    </div>
                    {displayItems.length > 0 && (
                        <div className={`bg-transparent p-3 flex flex-col gap-3`}>
                            {[...displayItems].sort((a, b) => (b.totalChapters || 0) - (a.totalChapters || 0)).slice(0, 3).map((item, i) => (
                                <div key={item.id} className="flex items-center gap-3">
                                    <span className={`text-base font-black font-mono ${i === 0 ? theme.highlightText : theme.mutedText} `}>#{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-semibold truncate ${theme.headingText} font-rajdhani`}>{item.title}</div>
                                        <div className={`text-xs font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} `}>{item.totalChapters} CH</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* COMPLETION RATE */}
                <div className="w-full">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText} w-full`}>
                        <div className={`h-[2px] flex-1 bg-gradient-to-r from-transparent ${theme.isDark ? 'to-amber-400' : 'to-cyan-600'} opacity-50`} />
                        <span className="text-[8px] md:text-[10px] font-bold tracking-tighter md:tracking-widest text-right font-orbitron uppercase">COMPLETION_RATE</span>
                        <Target size={12} className="md:w-[14px] md:h-[14px]" />
                    </div>
                    {displayItems.filter(i => i.status === 'ACTIVE' && i.totalChapters > 0).length > 0 && (
                        <div className={`bg-transparent p-3 flex flex-col gap-3`}>
                            {[...displayItems]
                                .filter(i => i.status === 'ACTIVE' && i.totalChapters > 0)
                                .slice(0, 3)
                                .map(item => {
                                    const pct = Math.min(100, Math.round((item.currentChapter / item.totalChapters) * 100));
                                    return (
                                        <div key={item.id}>
                                            <div className="flex justify-between mb-1">
                                                <span className={`text-xs font-semibold ${theme.headingText} truncate max-w-[140px] font-rajdhani`}>{item.title}</span>
                                                <span className={`text-xs font-bold font-rajdhani tabular-nums ${theme.isDark ? 'text-amber-300' : 'text-cyan-600'} `}>{pct}%</span>
                                            </div>
                                            <div className={`h-1.5 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} `}>
                                                <div className={`h-full transition-all duration-700 ${pct >= 80 ? `bg-gradient-to-r ${theme.gradient}` : `bg-gradient-to-r ${theme.gradient}`} progress-bloom `} style={{ width: `${pct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    )}
                </div>

            </div>

        </div >
    );
};

export default TowerHUD;
