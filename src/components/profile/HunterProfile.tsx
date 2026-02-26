import React, { useMemo } from 'react';
import { Theme, Quest } from '../../core/types';
import SystemLogo from '../system/SystemLogo';
import EntityAvatar from '../system/EntityAvatar';
import { X, Crown, Database, Layers, Target, ChevronRight, Download, Upload, RefreshCw, LogOut } from 'lucide-react';
import { USER_RANKS } from '../../utils/ranks';
import GalaxyNebula from '../fx/GalaxyNebula';
import OmniscientField from '../fx/OmniscientField';
import NoiseOverlay from '../fx/NoiseOverlay';
import SanctuaryRing from '../fx/SanctuaryRing';
import { systemFetch } from '../../utils/auth';

interface HunterProfileProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    playerRank: any;
    onImport: (newItems: Quest[]) => void;
    onLogout: () => void;
    showNotification: (message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', confirm?: boolean) => Promise<boolean>;
}

const HunterProfile: React.FC<HunterProfileProps> = ({ isOpen, onClose, theme, items, playerRank, onImport, onLogout, showNotification }) => {
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

    const exportToCSV = async () => {
        const confirmed = await showNotification("INITIATE DATA EXTRACTION PROTOCOL?", 'INFO', true);
        if (!confirmed) return;

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

        showNotification("ARCHIVE EXTRACTED SUCCESSFULLY.", "SUCCESS");
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

                    // Robust CSV line parser (handles quotes and empty fields)
                    const fields: string[] = [];
                    let currentField = "";
                    let inQuotes = false;
                    for (let charIndex = 0; charIndex < line.length; charIndex++) {
                        const char = line[charIndex];
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) {
                            fields.push(currentField);
                            currentField = "";
                        } else {
                            currentField += char;
                        }
                    }
                    fields.push(currentField);

                    if (fields.length < 6) {
                        console.warn(`[Import] Skipping malformed line ${i + 1}: Expected 7 fields, found ${fields.length}`, line);
                        continue;
                    }

                    const clean = (s: string) => s ? s.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : "";

                    newQuests.push({
                        id: Math.random().toString(36).substring(2, 11),
                        title: clean(fields[0]),
                        currentChapter: parseInt(clean(fields[1])) || 0,
                        totalChapters: parseInt(clean(fields[2])) || 0,
                        link: clean(fields[3]),
                        coverUrl: clean(fields[4]),
                        status: clean(fields[5]) || 'ACTIVE',
                        classType: clean(fields[6] || 'PLAYER'),
                        lastUpdated: Date.now()
                    });
                }

                if (newQuests.length > 0 && onImport) {
                    onImport(newQuests);
                    showNotification(`Successfully synchronized ${newQuests.length} records.`, 'SUCCESS');
                }
            } catch (err) {
                showNotification("Data corruption detected in source file.", 'ERROR');
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
            <div className={`relative z-10 h-16 flex items-center justify-between px-6 bg-transparent shrink-0`}>
                <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className={`font-mono text-[9px] tracking-[0.2em] ${theme.mutedText} uppercase`}>SYSTEM.ROOT</span>
                        <h2 className={`font-orbitron text-base tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.id === 'LIGHT' ? 'from-sky-600 via-cyan-400 to-indigo-200' : 'from-amber-600 via-yellow-400 to-white'} transition-colors duration-700`}>HUNTER PROFILE</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onLogout} title="TERMINATE_SESSION" className={`h-9 px-4 flex items-center justify-center gap-2 border ${theme.borderSubtle} text-red-500/80 hover:text-red-500 hover:border-red-500 hover:bg-red-500/5 transition-all font-mono text-[10px] tracking-widest uppercase cursor-pointer group`}>
                        <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                    <button onClick={onClose} className={`w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText} hover:border-current transition-colors cursor-pointer`}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* CONTENT - NON SCROLLABLE STRICT LAYOUT */}
            <div className="relative z-10 flex-1 px-4 lg:px-8 py-3 lg:py-6 overflow-y-auto hide-scrollbar max-w-[1600px] mx-auto w-full flex flex-col gap-3 lg:gap-6 pb-12">

                {/* TOP HERO: RANK BADGE + IDENTITY */}
                <div className={`${theme.isDark ? 'bg-black/50' : 'bg-white/50'} backdrop-blur-md border ${theme.borderSubtle} p-3 lg:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 lg:gap-8 relative overflow-hidden shrink-0`}>
                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5`} />
                    <EntityAvatar theme={theme} size={96} className="shrink-0 scale-75 lg:scale-100" />
                    <div className="flex-1 min-w-0 relative z-10 w-full flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 lg:gap-6">
                        <div className="text-center sm:text-left flex-1">
                            <div className={`text-[10px] font-mono ${theme.highlightText} tracking-[0.3em] uppercase mb-1`}>HUNTER DESIGNATION</div>
                            <div className="text-2xl lg:text-4xl font-black italic tracking-wide flex items-baseline gap-1 mb-2 justify-center sm:justify-start">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>{playerRank.name}</span>
                            </div>
                            <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[10px] lg:text-xs font-mono font-bold ${theme.mutedText}`}>
                                <span>{totalManhwa} TITLES TRACKED</span><span className="opacity-30">•</span><span>{conquered} CONQUERED</span><span className="opacity-30">•</span><span>{totalChapters.toLocaleString()} CHAPTERS ABSORBED</span>
                            </div>
                        </div>
                        {/* Overall Completion Progress */}
                        <div className="flex flex-col items-center sm:items-end gap-1 shrink-0 mt-4 sm:mt-0">
                            <div className={`text-[8px] lg:text-[10px] font-mono ${theme.mutedText} tracking-widest uppercase`}>OVERALL COMPLETION</div>
                            <div className={`text-2xl lg:text-3xl font-black italic ${theme.highlightText} leading-none`}>{overallPct}<span className="text-sm lg:text-lg">%</span></div>
                            <div className={`h-1 lg:h-1.5 w-32 md:w-48 ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full overflow-hidden mt-1`}>
                                <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`} style={{ width: `${overallPct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RANK HISTORY */}
                <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-3 lg:p-4 w-full shrink-0`}>
                    <div className={`flex items-center gap-2 mb-2 lg:mb-4 ${theme.highlightText}`}>
                        <Crown size={14} />
                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Rank History</span>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mb-4">
                        {USER_RANKS.map((rank: any, idx: number) => {
                            const isReached = idx <= currentRankIdx;
                            const isCurrent = idx === currentRankIdx;
                            return (
                                <div key={rank.label} className="flex items-center gap-1.5 md:gap-2 mb-2">
                                    <div className={`px-2 md:px-3 py-1 md:py-1.5 font-mono text-[10px] md:text-xs font-bold tracking-widest transition-all border ${isCurrent
                                        ? `${theme.border} ${theme.highlightText} ${theme.isDark ? 'bg-amber-500/10' : 'bg-sky-500/10'} shadow-lg`
                                        : isReached
                                            ? `${theme.border} ${theme.highlightText} ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`
                                            : `${theme.borderSubtle} ${theme.mutedText} opacity-30`
                                        }`}>
                                        {rank.label}
                                    </div>
                                    {idx < USER_RANKS.length - 1 && (
                                        <ChevronRight size={12} className={isReached && idx < currentRankIdx ? theme.highlightText : theme.mutedText + ' opacity-20'} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {currentRankIdx < USER_RANKS.length - 1 && (
                        <div className="w-full">
                            <div className={`flex justify-between text-[10px] md:text-xs font-mono font-bold ${theme.mutedText} mb-2`}>
                                <span>{USER_RANKS[currentRankIdx].label} — {totalManhwa.toLocaleString()} OF</span>
                                <span className="uppercase">NEXT: {USER_RANKS[currentRankIdx + 1].label} @ {USER_RANKS[currentRankIdx + 1].minTitles.toLocaleString()} CH</span>
                            </div>
                            <div className={`h-1.5 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full`}>
                                <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`}
                                    style={{ width: `${Math.min(100, ((totalManhwa - USER_RANKS[currentRankIdx].minTitles) / (USER_RANKS[currentRankIdx + 1].minTitles - USER_RANKS[currentRankIdx].minTitles)) * 100)}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* DATA LIFECYCLE */}
                <div className="w-full flex justify-center">
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-3 lg:mb-4 ${theme.highlightText}`}>
                            <Database size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Data Lifecycle</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
                            <button onClick={exportToCSV} className={`flex items-center justify-center gap-3 p-4 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40 hover:bg-white/5' : 'bg-white/40 hover:bg-black/5'} transition-all group cursor-pointer`}>
                                <Download size={18} className={`${theme.highlightText} group-hover:scale-110 transition-transform`} />
                                <div className="text-left">
                                    <div className={`text-[9px] lg:text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Export Protocol</div>
                                    <div className={`text-xs md:text-sm font-bold ${theme.headingText} font-orbitron`}>DOWNLOAD RECORDS</div>
                                </div>
                            </button>
                            <label className={`flex items-center justify-center gap-3 p-4 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40 hover:bg-white/5' : 'bg-white/40 hover:bg-black/5'} transition-all group cursor-pointer relative`}>
                                <input type="file" accept=".csv" onChange={async (e) => {
                                    const confirmed = await showNotification("RE-SYNCHRONIZE DATABASE?", "WARNING", true);
                                    if (confirmed) handleImport(e);
                                    else e.target.value = "";
                                }} className="hidden" />
                                <Upload size={18} className={`${theme.highlightText} group-hover:scale-110 transition-transform`} />
                                <div className="text-left">
                                    <div className={`text-[9px] lg:text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Import Protocol</div>
                                    <div className={`text-xs md:text-sm font-bold ${theme.headingText} font-orbitron`}>SYNCHRONIZE DATA</div>
                                </div>
                            </label>
                            <button onClick={async () => {
                                const confirmed = await showNotification("INITIALIZE GLOBAL RE-CLASSIFICATION?", 'WARNING', true);
                                if (confirmed) {
                                    try {
                                        const res = await systemFetch('/api/admin/bulk-classify', { method: 'POST' });
                                        const contentType = res.headers.get("content-type");
                                        if (!res.ok) {
                                            const errData = contentType?.includes("application/json") ? await res.json() : null;
                                            throw new Error(errData?.error || `STATUS_${res.status}`);
                                        }
                                        const data = await res.json();
                                        await showNotification(`${data.message}. Updated ${data.updated} records.`, 'SUCCESS');
                                        window.location.reload();
                                    } catch (e: any) {
                                        console.error("Classification Failure:", e);
                                        showNotification(`CRITICAL_PROTOCOL_FAILURE`, 'ERROR');
                                    }
                                }
                            }} className={`flex items-center justify-center gap-3 p-4 border ${theme.borderSubtle} ${theme.isDark ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'bg-sky-500/5 hover:bg-sky-500/10'} transition-all group md:col-span-2 lg:col-span-1`}>
                                <RefreshCw size={18} className={`${theme.highlightText} group-hover:rotate-180 transition-transform duration-700`} />
                                <div className="text-left">
                                    <div className={`text-[9px] lg:text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>System Reset</div>
                                    <div className={`text-xs md:text-sm font-bold ${theme.highlightText} font-orbitron`}>RE-CALIBRATE</div>
                                </div>
                            </button>
                        </div>

                        {/* STATS GRID */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {[
                                { label: 'TOTAL TITLES', value: totalManhwa, color: theme.headingText },
                                { label: 'CONQUERED', value: conquered, color: theme.highlightText },
                                { label: 'IN PROGRESS', value: active, color: theme.highlightText },
                                { label: 'CH ABSORBED', value: totalChapters.toLocaleString(), color: theme.highlightText },
                            ].map(stat => (
                                <div key={stat.label} className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 lg:p-5 flex flex-col justify-center`}>
                                    <div className={`text-[9px] lg:text-[10px] font-mono ${theme.mutedText} font-bold uppercase tracking-widest mb-1.5`}>{stat.label}</div>
                                    <div className={`text-2xl lg:text-3xl font-black italic ${stat.color} leading-none`}>{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW: CLASS DISTRIBUTION + TOP SERIES + ACTIVE PROGRESS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-6">

                    {/* CLASS DISTRIBUTION */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Database size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Class Distribution</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-4 flex-1`}>
                            {classEntries.slice(0, 5).map(([cls, count]) => (
                                <div key={cls}>
                                    <div className="flex justify-between mb-1.5">
                                        <span className={`text-xs font-mono font-bold ${theme.headingText} uppercase`}>{cls}</span>
                                        <span className={`text-xs font-mono font-bold ${theme.highlightText}`}>{count}</span>
                                    </div>
                                    <div className={`h-1.5 rounded-full w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                        <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} progress-bloom`} style={{ width: `${(count / totalManhwa) * 100}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TOP SERIES */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Layers size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Top Series</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-4 flex-1`}>
                            {topSeries.map((item, i) => (
                                <div key={item.id} className="flex items-center gap-4">
                                    <span className={`text-sm font-black font-mono ${i === 0 ? theme.highlightText : theme.mutedText}`}>#{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold truncate ${theme.headingText}`}>{item.title}</div>
                                        <div className={`text-[10px] font-mono mt-0.5 ${theme.highlightText}`}>{item.currentChapter.toLocaleString()} CH</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ACTIVE P */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Target size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Active Prog</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md p-4 flex flex-col gap-4 flex-1`}>
                            {activeSeries.length === 0 && <div className={`text-xs font-mono ${theme.mutedText}`}>NO ACTIVE SERIES</div>}
                            {activeSeries.map(item => (
                                <div key={item.id}>
                                    <div className="flex justify-between mb-1.5">
                                        <span className={`text-xs font-bold ${theme.headingText} truncate max-w-[150px]`}>{item.title}</span>
                                        <span className={`text-[10px] font-mono font-bold ${item.pct >= 50 ? theme.highlightText : theme.mutedText}`}>{item.pct}%</span>
                                    </div>
                                    <div className={`h-1.5 rounded-full w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                        <div className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${theme.gradient} progress-bloom`} style={{ width: `${item.pct}%`, color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HunterProfile;