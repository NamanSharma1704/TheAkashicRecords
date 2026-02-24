import React, { useMemo } from 'react';
import { Theme, Quest } from '../../core/types';
import SystemLogo from '../system/SystemLogo';
import EntityAvatar from '../system/EntityAvatar';
import { X, Crown, Database, Layers, Target, ChevronRight, Download, Upload } from 'lucide-react';
import { USER_RANKS } from '../../utils/ranks';
import GalaxyNebula from '../fx/GalaxyNebula';
import OmniscientField from '../fx/OmniscientField';
import NoiseOverlay from '../fx/NoiseOverlay';
import SanctuaryRing from '../fx/SanctuaryRing';

interface HunterProfileProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    playerRank: { name: string; color: string };
    onImport?: (items: Quest[]) => void;
}

const HunterProfile: React.FC<HunterProfileProps> = ({ isOpen, onClose, theme, items, playerRank, onImport }) => {
    const totalChapters = useMemo(() => items.reduce((acc, i) => acc + (i.currentChapter || 0), 0), [items]);
    const totalManhwa = items.length;
    const conquered = useMemo(() => items.filter(i => i.status === 'CONQUERED').length, [items]);
    const active = useMemo(() => items.filter(i => i.status === 'ACTIVE').length, [items]);
    const totalPossible = useMemo(() => items.reduce((acc, i) => acc + (i.totalChapters || 0), 0), [items]);
    const overallPct = totalPossible > 0 ? Math.min(100, Math.round((totalChapters / totalPossible) * 100)) : 0;

    // Class distribution
    const classEntries = useMemo(() => {
        const allowedClasses = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
        const classCounts: Record<string, number> = {
            'PLAYER': 0, 'IRREGULAR': 0, 'MAGE': 0, 'CONSTELLATION': 0, 'NECROMANCER': 0
        };
        items.forEach(i => {
            const c = i.classType || 'UNKNOWN';
            if (allowedClasses.includes(c)) {
                classCounts[c] += 1;
            }
        });
        return Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
    }, [items]);

    // Top series by chapters read
    const topSeries = useMemo(() => [...items].sort((a, b) => (b.currentChapter || 0) - (a.currentChapter || 0)).slice(0, 5), [items]);

    // Active series with completion % 
    const activeSeries = useMemo(() => items.filter(i => i.status === 'ACTIVE' && i.totalChapters > 0 && i.currentChapter <= i.totalChapters)
        .map(i => ({ ...i, pct: Math.min(100, Math.round((i.currentChapter / i.totalChapters) * 100)) }))
        .sort((a, b) => b.pct - a.pct).slice(0, 4), [items]);

    // Current rank index for rank history
    const currentRankIdx = useMemo(() => USER_RANKS.findIndex((r: any) => r.label === playerRank.name), [playerRank]);

    const exportToCSV = () => {
        const headers = ['Title', 'Current Ch', 'Max Ch', 'Link', 'Cover URL', 'Status', 'Class'];
        const csvRows = items.map(item => [
            item.title,
            item.currentChapter,
            item.totalChapters,
            item.link,
            item.coverUrl,
            item.status,
            item.classType
        ].map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(','));

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `akashic_records_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/);
                if (lines.length < 2) throw new Error("File is empty or invalid format");

                const newQuests: Quest[] = [];
                // Simple CSV parser that handles quotes
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const matches = line.match(/(".*?"|[^,]+)/g);
                    if (!matches || matches.length < 6) continue;

                    const clean = (s: string) => s.replace(/^"|"$/g, '').replace(/""/g, '"');

                    newQuests.push({
                        id: Math.random().toString(36).substring(2, 11),
                        title: clean(matches[0]),
                        currentChapter: parseInt(clean(matches[1])) || 0,
                        totalChapters: parseInt(clean(matches[2])) || 0,
                        link: clean(matches[3]),
                        coverUrl: clean(matches[4]),
                        status: clean(matches[5]),
                        classType: clean(matches[6] || 'PLAYER'),
                        lastUpdated: Date.now()
                    });
                }

                if (newQuests.length > 0 && onImport) {
                    onImport(newQuests);
                    alert(`SYSTEM: Successfully synchronized ${newQuests.length} records.`);
                }
            } catch (err) {
                alert("SYSTEM ERROR: Data corruption detected in source file.");
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 ${theme.isDark ? 'bg-[#020202]' : 'bg-slate-50'} flex flex-col overflow-hidden transition-colors duration-700`}>
            {/* Background layers */}
            <GalaxyNebula theme={theme} />
            <OmniscientField isDivineMode={theme.id === 'LIGHT'} />
            <SanctuaryRing theme={theme} />
            <NoiseOverlay />
            <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_30%_20%,transparent_40%,rgba(0,0,0,0.5)_100%)] opacity-60" />

            {/* HEADER */}
            <div className={`relative z-10 h-16 flex items-center justify-between px-6 border-b ${theme.borderSubtle} bg-transparent shrink-0`}>
                <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className={`font-mono text-[9px] tracking-[0.2em] ${theme.mutedText} uppercase`}>SYSTEM.ROOT</span>
                        <h2 className={`font-orbitron text-base tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.id === 'LIGHT' ? 'from-sky-600 via-cyan-400 to-indigo-200' : 'from-amber-600 via-yellow-400 to-white'} transition-colors duration-700`}>HUNTER PROFILE</h2>
                    </div>
                </div>
                <button onClick={onClose} className={`w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText} hover:border-current transition-colors`}>
                    <X size={16} />
                </button>
            </div>

            {/* CONTENT */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-5xl mx-auto flex flex-col gap-6">

                    {/* TOP HERO: RANK BADGE + IDENTITY */}
                    <div className={`${theme.isDark ? 'bg-black/50' : 'bg-white/50'} backdrop-blur-md p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 relative overflow-hidden`}>
                        <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5`} />
                        {/* Avatar */}
                        <EntityAvatar theme={theme} size={96} className="shrink-0" />
                        {/* Identity */}
                        <div className="flex-1 relative z-10">
                            <div className={`text-[10px] font-mono ${theme.highlightText} tracking-[0.3em] uppercase mb-1`}>HUNTER DESIGNATION</div>
                            <div className="text-4xl font-black italic tracking-wide flex items-baseline gap-1 mb-2">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>{playerRank.name}</span>
                            </div>
                            <div className={`flex flex-wrap gap-4 text-xs font-mono ${theme.mutedText}`}>
                                <span>{totalManhwa} TITLES TRACKED</span>
                                <span className={theme.isDark ? 'text-white/20' : 'text-black/20'}>•</span>
                                <span>{conquered} CONQUERED</span>
                                <span className={theme.isDark ? 'text-white/20' : 'text-black/20'}>•</span>
                                <span>{totalChapters.toLocaleString()} CHAPTERS ABSORBED</span>
                            </div>
                        </div>
                        {/* Overall progress */}
                        <div className="shrink-0 flex flex-col items-end gap-1 relative z-10">
                            <div className={`text-[9px] font-mono ${theme.mutedText} tracking-widest uppercase`}>OVERALL COMPLETION</div>
                            <div className={`text-3xl font-black italic ${theme.highlightText}`}>{overallPct}<span className="text-lg">%</span></div>
                            <div className={`w-32 h-1.5 ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`} style={{ width: `${overallPct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                            </div>
                        </div>
                    </div>

                    {/* RANK HISTORY */}
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-3 ${theme.highlightText}`}>
                            <Crown size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Rank History</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4`}>
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                {USER_RANKS.map((rank: any, idx: number) => {
                                    const isReached = idx <= currentRankIdx;
                                    const isCurrent = idx === currentRankIdx;
                                    return (
                                        <div key={rank.label} className="flex items-center gap-1 sm:gap-2">
                                            <div className={`px-2 sm:px-3 py-1.5 border font-mono text-[10px] sm:text-xs font-bold tracking-wider transition-all ${isCurrent
                                                ? `${theme.border} ${theme.highlightText} ${theme.isDark ? 'bg-amber-500/10' : 'bg-sky-500/10'} shadow-lg`
                                                : isReached
                                                    ? `${theme.border} ${theme.highlightText} ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`
                                                    : `${theme.borderSubtle} ${theme.mutedText} opacity-40`
                                                }`}>
                                                {rank.label}
                                            </div>
                                            {idx < USER_RANKS.length - 1 && (
                                                <ChevronRight size={12} className={isReached && idx < currentRankIdx ? theme.highlightText : theme.mutedText + ' opacity-30'} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* EXP to next rank */}
                            {currentRankIdx < USER_RANKS.length - 1 && (
                                <div className="mt-4">
                                    <div className={`flex justify-between text-[9px] font-mono ${theme.mutedText} mb-1.5`}>
                                        <span>{USER_RANKS[currentRankIdx].label} — {totalManhwa.toLocaleString()} TITLES</span>
                                        <span>NEXT: {USER_RANKS[currentRankIdx + 1].label} @ {USER_RANKS[currentRankIdx + 1].minTitles.toLocaleString()} TITLES</span>
                                    </div>
                                    <div className={`h-1.5 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                        <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`}
                                            style={{ width: `${Math.min(100, ((totalManhwa - USER_RANKS[currentRankIdx].minTitles) / (USER_RANKS[currentRankIdx + 1].minTitles - USER_RANKS[currentRankIdx].minTitles)) * 100)}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DATA MANAGEMENT */}
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-3 ${theme.highlightText}`}>
                            <Database size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Data Lifecycle</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={exportToCSV}
                                className={`flex items-center justify-center gap-3 p-4 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40 hover:bg-white/5' : 'bg-white/40 hover:bg-black/5'} transition-all group cursor-pointer`}
                            >
                                <Download size={18} className={`${theme.highlightText} group-hover:scale-110 transition-transform`} />
                                <div className="text-left">
                                    <div className={`text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Export Protocol</div>
                                    <div className={`text-sm font-bold ${theme.headingText} font-orbitron`}>DOWNLOAD RECORDS</div>
                                </div>
                            </button>
                            <label className={`flex items-center justify-center gap-3 p-4 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40 hover:bg-white/5' : 'bg-white/40 hover:bg-black/5'} transition-all group cursor-pointer relative`}>
                                <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                                <Upload size={18} className={`${theme.highlightText} group-hover:scale-110 transition-transform`} />
                                <div className="text-left">
                                    <div className={`text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Import Protocol</div>
                                    <div className={`text-sm font-bold ${theme.headingText} font-orbitron`}>SYNCHRONIZE DATA</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'TOTAL TITLES', value: totalManhwa, color: theme.headingText },
                            { label: 'CONQUERED', value: conquered, color: theme.highlightText },
                            { label: 'IN PROGRESS', value: active, color: theme.highlightText },
                            { label: 'CH ABSORBED', value: totalChapters.toLocaleString(), color: theme.highlightText },
                        ].map(stat => (
                            <div key={stat.label} className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4`}>
                                <div className={`text-[9px] font-mono ${theme.mutedText} uppercase tracking-widest mb-2`}>{stat.label}</div>
                                <div className={`text-2xl font-black italic ${stat.color}`}>{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* BOTTOM ROW: CLASS DISTRIBUTION + TOP SERIES + ACTIVE PROGRESS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* CLASS DISTRIBUTION */}
                        <div>
                            <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                                <Database size={12} />
                                <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Class Distribution</span>
                            </div>
                            <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-3`}>
                                {classEntries.slice(0, 5).map(([cls, count]) => (
                                    <div key={cls}>
                                        <div className="flex justify-between mb-1">
                                            <span className={`text-xs font-mono font-bold ${theme.headingText} uppercase`}>{cls}</span>
                                            <span className={`text-xs font-mono font-bold ${theme.highlightText}`}>{count}</span>
                                        </div>
                                        <div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                            <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom`} style={{ width: `${(count / totalManhwa) * 100}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TOP SERIES */}
                        <div>
                            <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                                <Layers size={12} />
                                <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Top Series</span>
                            </div>
                            <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-3`}>
                                {topSeries.map((item, i) => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <span className={`text-sm font-black font-mono ${i === 0 ? theme.highlightText : theme.mutedText}`}>#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-xs font-bold truncate ${theme.headingText}`}>{item.title}</div>
                                            <div className={`text-[10px] font-mono ${theme.highlightText}`}>{item.currentChapter.toLocaleString()} CH</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ACTIVE COMPLETION */}
                        <div>
                            <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                                <Target size={12} />
                                <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Active Progress</span>
                            </div>
                            <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-3`}>
                                {activeSeries.length === 0 && <div className={`text-xs font-mono ${theme.mutedText}`}>NO ACTIVE SERIES</div>}
                                {activeSeries.map(item => (
                                    <div key={item.id}>
                                        <div className="flex justify-between mb-1">
                                            <span className={`text-xs font-bold ${theme.headingText} truncate max-w-[120px]`}>{item.title}</span>
                                            <span className={`text-xs font-mono font-bold ${item.pct >= 50 ? theme.highlightText : theme.mutedText}`}>{item.pct}%</span>
                                        </div>
                                        <div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                            <div className={`h-full transition-all duration-700 bg-gradient-to-r ${theme.gradient} progress-bloom`} style={{ width: `${item.pct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default HunterProfile;