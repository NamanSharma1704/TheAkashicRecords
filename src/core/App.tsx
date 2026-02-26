import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Quest } from './types';
import SystemFrame from '../components/system/SystemFrame';
import StatBox from '../components/system/StatBox';
import SystemLogo from '../components/system/SystemLogo';
import ScrambleText from '../components/system/ScrambleText';
import { Cpu, Sword, Activity, Target, Hash, ExternalLink, Terminal, Sun, Moon, Plus, Flame, LayoutTemplate, Zap, Crown } from 'lucide-react';
import { getPlayerRank, getThemedRankStyle, calculateQuestRank } from '../utils/ranks';
import { THEMES, ITEMS_PER_FLOOR } from './constants';

import SystemConsole from '../components/system/SystemConsole';
import BootScreen from '../components/system/BootScreen';
import BackgroundController from '../components/fx/BackgroundController';
import EntityAvatar from '../components/system/EntityAvatar';
import SystemNotification from '../components/system/SystemNotification';

import { getProxiedImageUrl } from '../utils/api';
import { saveAuthData, clearAuthData, systemFetch, isAuthenticated } from '../utils/auth';
import LoginScreen from '../components/system/LoginScreen';
import { User } from './types';

const API_URL = '/api/quests';

// Helper to normalize quest data from both MongoDB and local BASE_QUESTS
const mapQuest = (q: any): Quest => ({
    id: String(q._id || q.id || ""),
    title: q.title || "",
    coverUrl: getProxiedImageUrl(q.cover || q.coverUrl || ""),
    link: q.readLink || q.link || q.siteUrl || "",
    synopsis: q.synopsis || "",
    currentChapter: Number(q.currentChapter) || 0,
    totalChapters: Number(q.totalChapters) || 0,
    status: (q.status || 'ACTIVE').toUpperCase(),
    classType: q.classType || "PLAYER",
    lastUpdated: q.lastRead || q.lastUpdated || Date.now()
});

// ----------------------------------------------------------------------
// LAZY LOADED HEAVY COMPONENTS 
// ----------------------------------------------------------------------
const ManhwaDetail = lazy(() => import('../components/quest/ManhwaDetail'));
const HunterProfile = lazy(() => import('../components/profile/HunterProfile'));
const DivineSpire = lazy(() => import('../components/tower/DivineSpire'));
const SystemGateModal = lazy(() => import('../components/system/SystemGateModal'));

// Loading Fallback Strategy
const HeavyLoader = ({ theme }: { theme: any }) => (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className={`w-16 h-16 border-2 border-dashed ${theme.id === 'LIGHT' ? 'border-sky-500' : 'border-amber-500'} rounded-full animate-spin`} />
    </div>
);

// --- APP ---
const App: React.FC = () => {
    console.log("App Version v25 Loaded");
    const [booting, setBooting] = useState<boolean>(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const checkMobile = () => setIsMobile(window.innerWidth < 768);

        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkMobile, 100);
        };

        checkMobile();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);
    const [currentTheme, setCurrentTheme] = useState<string>('DARK');
    const theme = THEMES[currentTheme as keyof typeof THEMES];

    const [library, setLibrary] = useState<Quest[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [userState, setUserState] = useState({ streak: 0, dailyAbsorbed: 0 });
    const [isAuth, setIsAuth] = useState<boolean>(isAuthenticated());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSpireOpen, setIsSpireOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
    const [editingItem, setEditingItem] = useState<Quest | null>(null);

    // --- SCROLL HANDLING STATE ---
    const [isHUDVisible, setIsHUDVisible] = useState(true);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);

    useEffect(() => {
        if (booting || !isAuth) return;

        let timeout: ReturnType<typeof setTimeout>;
        let lastScrollY = 0;
        const mainScrollArea = document.getElementById('main-scroll-area');

        // Start initial timeout to hide HUD
        timeout = setTimeout(() => {
            setIsHUDVisible(false);
        }, 2000);

        const handleScroll = () => {
            const currentScrollY = mainScrollArea ? mainScrollArea.scrollTop : window.scrollY;

            // Handle Header Visibility (hide on scroll down, show on scroll up)
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsHeaderVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setIsHeaderVisible(true);
            }
            lastScrollY = currentScrollY;

            // Show HUD immediately on scroll
            setIsHUDVisible(true);

            // Clear existing timeout
            clearTimeout(timeout);

            // Set timeout to hide HUD after 2 seconds of no scrolling
            timeout = setTimeout(() => {
                setIsHUDVisible(false);
            }, 2000);
        };

        if (mainScrollArea) {
            mainScrollArea.addEventListener('scroll', handleScroll, { passive: true });
        } else {
            window.addEventListener('scroll', handleScroll, { passive: true }); // Fallback
        }

        return () => {
            if (mainScrollArea) {
                mainScrollArea.removeEventListener('scroll', handleScroll);
            } else {
                window.addEventListener('scroll', handleScroll);
            }
            clearTimeout(timeout);
        };
    }, [booting, isAuth]);

    // --- SYSTEM NOTIFICATION STATE ---
    const [sysNote, setSysNote] = useState<{
        isOpen: boolean;
        message: string;
        type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
        confirm: boolean;
        resolve?: (val: boolean) => void;
    }>({ isOpen: false, message: "", type: 'INFO', confirm: false });

    const showSystemNotification = (message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', confirm: boolean = false): Promise<boolean> => {
        return new Promise((resolve) => {
            setSysNote({ isOpen: true, message, type, confirm, resolve });
        });
    };

    const handleSysNoteClose = (result: boolean) => {
        if (sysNote.resolve) sysNote.resolve(result);
        setSysNote(prev => ({ ...prev, isOpen: false }));
    };

    const handleLoginSuccess = (user: User, token: string) => {
        saveAuthData({ user, token });
        setIsAuth(true);
        // Data fetching will be triggered by useEffect
    };

    const handleLogout = async () => {
        const confirmed = await showSystemNotification("TERMINATE_SESSION: Are you sure?", "WARNING", true);
        if (confirmed) {
            clearAuthData();
            setIsAuth(false);
            setLibrary([]);
        }
    };

    useEffect(() => {
        if (isAuth) {
            fetchInitialData();
        }
    }, [isAuth]);

    const fetchInitialData = async () => {
        const start = Date.now();
        try {
            console.log("[SYSTEM] Initiating High-Performance Boot Sequence...");
            const res = await systemFetch('/api/boot/initial-data');

            if (!res.ok) throw new Error(`PROTOCOL_ERROR: ${res.status}`);

            const { quests, userState: stats } = await res.json();

            // Prepare all data first for a single batch update
            if (Array.isArray(quests)) {
                const mappedData = quests.map(mapQuest);

                // Determine active ID before setting states
                let newActiveId = activeId;
                if (!activeId && mappedData.length > 0) {
                    const topActive = mappedData
                        .filter(i => i.status === 'ACTIVE')
                        .sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime())[0];
                    newActiveId = topActive ? topActive.id : mappedData[0].id;
                }

                // Batch the updates
                setLibrary(mappedData);
                if (newActiveId !== activeId) setActiveId(newActiveId);
                if (stats) setUserState(stats);
            }

            console.log(`[SYSTEM] Sync Complete. Duration: ${Date.now() - start}ms`);
        } catch (e: any) {
            console.error("BOOT_SYNC_FAILURE:", e.message);
            // Fallback to empty state to prevent UI crash
            setLibrary([]);
        }
    };

    // Migration / Integrity Check removed since we use MongoDB now

    const DEFAULT_QUEST: Quest = {
        id: '0',
        title: 'No Active Quest',
        coverUrl: "",
        totalChapters: 0,
        currentChapter: 0,
        status: 'LOCKED',
        classType: 'UNKNOWN',
        link: ''
    };

    const activeQuest = useMemo(() => {
        return library.find(q => q.id === activeId) || library[0] || DEFAULT_QUEST;
    }, [library, activeId]);

    const progressPercent = useMemo(() => Math.min(100, Math.round((activeQuest.currentChapter / (activeQuest.totalChapters || 1)) * 100)), [activeQuest]);
    const totalChaptersRead = useMemo(() => library.reduce((acc, item) => acc + (item.currentChapter || 0), 0), [library]);

    // Separate Rank Logic for User
    const playerRank = useMemo(() => {
        const rawPlayerRank = getPlayerRank(library.length);
        const rankStyle = getThemedRankStyle(currentTheme, rawPlayerRank.label === 'Sovereign' || rawPlayerRank.label === 'Eclipse' || rawPlayerRank.label === 'Monarch');
        return { ...rawPlayerRank, name: rawPlayerRank.label, style: rankStyle };
    }, [library.length, currentTheme]);

    const activeQuests = useMemo(() => {
        const filtered = library.filter(item => item.status === 'ACTIVE').sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()).slice(0, 5);
        console.log("[Rendering] Sidebar Active Quests count:", filtered.length);
        return filtered;
    }, [library]);
    const spireItems = useMemo(() => {
        return [...library].sort((a, b) => {
            const idA = a.id || '';
            const idB = b.id || '';
            return idA.localeCompare(idB);
        });
    }, [library]);

    const handleActivate = (id: string) => {
        // Find item and set as selected for detail view
        const item = library.find(i => i.id === id);
        if (item) {
            setSelectedQuest(item);
            setIsDetailOpen(true);
        }
    }

    const handleLogClick = async (id: string) => {
        setActiveId(id);
        const now = new Date().toISOString();
        // OPTIMISTIC UPDATE: Immediate UI Feedback
        setLibrary(prev => prev.map(item => item.id === id ? { ...item, lastUpdated: now } : item));

        try {
            const res = await systemFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ lastUpdated: now })
            });
            const updated = await res.json();
            const mappedUpdated = mapQuest(updated);
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            console.error("Update failed", e);
        }
    };

    const handleSetActiveQuest = async (id: string) => {
        setActiveId(id);
        const now = Date.now();
        // OPTIMISTIC UPDATE
        setLibrary(prev => prev.map(item => item.id === id ? { ...item, status: 'ACTIVE', lastUpdated: new Date(now).toISOString() } : item));

        try {
            const res = await systemFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'ACTIVE', lastRead: now })
            });
            const updated = await res.json();
            const mappedUpdated = mapQuest(updated);
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            console.error("Set active failed", e);
        }
    };

    const handleSave = async (data: Partial<Quest>) => {
        const targetId = data.id || (editingItem ? editingItem.id : null);
        const isEditing = !!targetId;
        const url = isEditing ? `${API_URL}/${targetId}` : API_URL;
        const method = isEditing ? 'PUT' : 'POST';

        // 1. CLEAN BODY: Remove internal fields and map to backend schema
        const body: any = {};

        // Map all fields in data to body, using special mapping for schema mismatches
        Object.entries(data).forEach(([key, value]) => {
            if (['id', '_id', '__v', 'lastRead', 'lastUpdated', 'cover', 'readLink'].includes(key)) return;

            if (key === 'coverUrl') body.cover = value;
            else if (key === 'link') body.readLink = value;
            else if (['currentChapter', 'totalChapters'].includes(key)) body[key] = Number(value) || 0;
            else body[key] = value;
        });

        console.log(`[handleSave] ${method} to ${url}`, {
            originalData: data,
            mappedBody: body
        });

        try {
            const res = await systemFetch(url, {
                method,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Save failure');
            }

            const saved = await res.json();
            const mappedSaved = mapQuest(saved);

            if (isEditing) {
                setLibrary(prev => prev.map(q => q.id === mappedSaved.id ? mappedSaved : q));
                // Update selectedQuest if it's the one we just edited
                if (selectedQuest?.id === mappedSaved.id) {
                    setSelectedQuest(mappedSaved);
                }
            } else {
                setLibrary(prev => [mappedSaved, ...prev]);
                handleActivate(mappedSaved.id);
            }
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (e: any) {
            console.error("Save failure:", e);
            showSystemNotification(`SAVE_PROTOCOL_FAILED: ${e.message}`, 'ERROR');
        }
    };

    const handleImportQuests = async (newItems: Quest[]) => {
        setBooting(true);
        let count = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const item of newItems) {
            try {
                const existing = library.find(q => q.title.toLowerCase().trim() === item.title.toLowerCase().trim());

                if (existing) {
                    // SMART MERGE: Only update if the CSV progress is ahead or equal
                    const shouldUpdate = item.totalChapters >= existing.totalChapters;

                    if (shouldUpdate) {
                        const { id: _, ...data } = item;
                        await handleSave({ ...data, id: existing.id });
                        updatedCount++;
                    } else {
                        skippedCount++;
                        console.log(`[Import] Skipping outdated record: ${item.title} (CSV: ${item.totalChapters} < Library: ${existing.totalChapters})`);
                    }
                } else {
                    const { id: _, ...data } = item;
                    await handleSave(data);
                    count++;
                }
            } catch (e) {
                console.error(`[Import] Failed to process: ${item.title}`, e);
            }
        }
        await fetchInitialData();
        setBooting(false);
        showSystemNotification(`Archive Reputed. ${count} New Origins Formed. ${updatedCount} Records Enhanced. ${skippedCount} Outdated Clusters Ignored.`, 'SUCCESS');
    };

    const updateProgress = async (amt: number) => {
        if (!activeQuest.id) return;
        const next = activeQuest.totalChapters > 0
            ? Math.min(Math.max(0, activeQuest.currentChapter + amt), activeQuest.totalChapters)
            : Math.max(0, activeQuest.currentChapter + amt);

        // OPTIMISTIC UPDATE: Zero-Latency
        setLibrary(prev => prev.map(q => q.id === activeId ? { ...q, currentChapter: next } : q));

        try {
            const res = await systemFetch(`${API_URL}/${activeId}`, {
                method: 'PUT',
                body: JSON.stringify({ currentChapter: next, lastUpdated: new Date().toISOString() })
            });
            const updated = await res.json();
            setLibrary(prev => prev.map(q => q.id === activeId ? mapQuest(updated) : q));
            // De-prioritized refresh to prevent UI stutter during rapid clicks
            setTimeout(() => {
                fetchInitialData().catch(console.error);
            }, 500);
        } catch (e) {
            console.error("Progress update failed", e);
        }
    };

    const deleteQuest = async () => {
        if (editingItem) {
            const confirmed = await showSystemNotification(`PURGE ARTIFACT "${editingItem.title}"?`, 'WARNING', true);
            if (!confirmed) return;

            try {
                await systemFetch(`${API_URL}/${editingItem.id}`, { method: 'DELETE' });
                setLibrary(prev => prev.filter(i => i.id !== editingItem.id));
                setIsModalOpen(false);
            } catch (e) {
                console.error("Deletion failure", e);
                showSystemNotification("PURGE_PROTOCOL_FAILED. ARCHIVE CORE STABLE.", "ERROR");
            }
        }
    };
    const toggleTheme = () => { const newTheme = currentTheme === 'LIGHT' ? 'DARK' : 'LIGHT'; setCurrentTheme(newTheme); };

    const memoizedHeader = useMemo(() => (
        <header className={`fixed top-0 w-full z-40 bg-transparent h-16 px-6 flex items-center justify-between transition-all duration-700 ease-in-out ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <SystemLogo theme={theme} className="w-full h-full" />
                </div>
                <div className="flex flex-col leading-none">
                    <div className="flex gap-2 items-baseline">
                        <span className={`font-mono text-[10px] tracking-[0.2em] ${theme.headingText} font-bold transition-colors duration-700`}>SYSTEM.ROOT</span>
                    </div>
                    <ScrambleText
                        text="AKASHIC"
                        className="font-orbitron text-lg tracking-[0.3em] font-bold drop-shadow-sm transition-colors duration-700"
                        animatedGradient={true}
                        gradientColors={currentTheme === 'LIGHT' ? "from-sky-500 to-cyan-500" : "from-amber-600 via-yellow-400 to-white"}
                    />
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={toggleTheme} className={`w-8 h-8 flex items-center justify-center border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded transition-colors duration-700`}>
                    {currentTheme === 'LIGHT' ? <Sun size={14} className="text-sky-600 transition-colors duration-700" /> : <Moon size={14} className="text-amber-400 transition-colors duration-700" />}
                </button>
                <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className={`hidden lg:flex px-4 py-1.5 border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors duration-700 font-mono text-[10px] tracking-widest items-center gap-2 cursor-pointer`}>
                    <Plus size={12} /> CREATE_GATE
                </button>
            </div>
        </header>
    ), [theme, currentTheme, isHeaderVisible]);

    const memoizedMain = useMemo(() => (
        <main className="absolute inset-0 top-16 bottom-10 overflow-y-auto lg:overflow-hidden overflow-x-hidden hide-scrollbar px-4 z-10">
            <div className="max-w-[1400px] mx-auto flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 pt-3 lg:pt-4 pb-6 lg:pb-4 lg:min-h-0">
                {/* LEFT COLUMN: ACTIVE CARD & STATS */}
                <div className="flex-none lg:flex-1 flex flex-col gap-2 lg:gap-3 lg:min-h-0 order-1">
                    {/* Hero card — fixed h on mobile, flex-1 on desktop */}
                    <div className="h-[320px] sm:h-[400px] md:h-[450px] lg:h-auto lg:flex-1 lg:min-h-0 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square opacity-100 pointer-events-none z-0">
                            <div className={`absolute inset-0 border ${theme.isDark ? 'border-white/30' : 'border-black/30'} rounded-full animate-[spin_60s_linear_infinite] transition-colors duration-700`} />
                            <div className={`absolute inset-[5%] border border-dashed ${theme.isDark ? 'border-white/30' : 'border-black/30'} rounded-full animate-[spin_40s_linear_infinite_reverse] transition-colors duration-700`} />
                        </div>

                        <div className="w-full h-full">
                            <SystemFrame variant="full" theme={theme} className={`shadow-2xl ${theme.shadow} transition-shadow duration-700`}>
                                <div className="absolute inset-0 z-0 group">
                                    <img src={activeQuest.coverUrl} alt="Background" className={`w-full h-full object-cover object-[50%_5%] ${theme.isDark ? 'opacity-90 mix-blend-normal grayscale-0' : 'opacity-70 mix-blend-normal grayscale-0'} transition-all duration-700`} referrerPolicy="no-referrer" />
                                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-[#020202] via-[#020202]/80' : 'from-[#f8f5f2]/90 via-[#f8f5f2]/60'} to-transparent transition-colors duration-700`} />
                                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.isDark ? 'from-[#020202]' : 'from-[#f8f5f2]/60'} via-transparent ${theme.isDark ? 'to-[#020202]/50' : 'to-transparent'} transition-colors duration-700`} />
                                    <div className={`absolute top-0 left-0 w-full h-[2px] bg-${theme.primary}-400/80 shadow-[0_0_15px_currentColor] z-20 animate-[scanning_4s_linear_infinite] opacity-50 pointer-events-none transition-colors duration-700`} />
                                </div>
                                <div className="relative z-10 p-4 md:p-6 lg:p-8 flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 bg-${theme.primary}-500 rounded-full transition-colors duration-700`} /><span className={`text-[9px] font-mono ${theme.highlightText} tracking-[0.2em] uppercase transition-colors duration-700`}>Divine Revelation</span></div>
                                            <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/90' : 'bg-white/90'} backdrop-blur-sm px-3 py-1 flex items-center gap-2 transition-colors duration-700`}><Crown size={12} className={`${theme.highlightText} transition-colors duration-700`} /><span className={`font-mono font-bold text-xs tracking-widest ${theme.headingText} transition-colors duration-700`}>RANK: {calculateQuestRank(activeQuest)}</span></div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[10px] ${theme.mutedText} font-mono tracking-widest flex items-center justify-end gap-2 transition-colors duration-700`}><Hash size={12} /> ID: <span className="max-w-[130px] sm:max-w-none truncate inline-block">#{activeQuest.id?.padStart(4, '0')}</span></div>
                                            <div className={`text-xs ${theme.highlightText} font-mono mt-1 border-b ${theme.borderSubtle} pb-0.5 inline-block transition-colors duration-700`}>{activeQuest.classType}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-8 w-full min-w-0">
                                        <div className={`min-h-[5rem] h-auto flex items-end relative pb-4 pr-6 border-b border-gradient-to-r ${theme.id === 'LIGHT' ? 'from-sky-500/30' : 'from-amber-500/50'} to-transparent transition-colors duration-700`} style={{ width: 0, minWidth: '100%' }}>
                                            <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black font-orbitron italic tracking-tighter bg-gradient-to-r ${theme.id === 'LIGHT' ? 'from-cyan-600 via-cyan-400 to-cyan-600' : 'from-amber-200 via-yellow-400 to-amber-200'} text-transparent bg-clip-text animate-gradient-x text-bloom w-full break-words line-clamp-2 lg:line-clamp-3 leading-[1.1] transition-all duration-700 pb-1 uppercase`}
                                                style={{ textTransform: 'uppercase', '--bloom-color': theme.id === 'LIGHT' ? '#06b6d4' : '#f59e0b' } as React.CSSProperties}>
                                                {activeQuest.title}
                                            </h1>
                                        </div>
                                        <div className="space-y-2">
                                            <div className={`flex justify-between text-[10px] font-mono ${theme.mutedText} tracking-wider transition-colors duration-700`}><span className={`flex items-center gap-2 ${theme.headingText} transition-colors duration-700`}><Zap size={12} /> COMPLETION_RATE</span><span className={`font-bold ${theme.headingText} transition-colors duration-700`}>{progressPercent}%</span></div>
                                            <div className={`h-1.5 ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} w-full relative transition-colors duration-700 overflow-hidden`}><div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-transform duration-700 ease-out origin-left`} style={{ transform: `scaleX(${progressPercent / 100})`, color: theme.id === 'LIGHT' ? '#06b6d4' : '#f59e0b' }} /></div>
                                            <div className={`flex justify-between text-[9px] font-mono ${theme.mutedText} uppercase tracking-widest transition-colors duration-700`}><span>Current: {activeQuest.currentChapter}</span><span>Terminal: {activeQuest.totalChapters}</span></div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={() => updateProgress(-1)} className={`w-12 h-12 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/85 hover:border-white hover:text-white' : 'bg-white/85 hover:border-black hover:text-black'} flex items-center justify-center transition-colors cursor-pointer duration-700`}><span className="text-xl font-bold">-</span></button>
                                            <button onClick={() => updateProgress(1)} className={`h-12 flex-1 border ${theme.border} ${theme.isDark ? 'bg-amber-950/70 hover:bg-amber-500' : 'bg-sky-500/70 hover:bg-sky-500'} flex items-center justify-center gap-3 transition-all font-mono font-bold tracking-widest ${theme.isDark ? 'text-amber-100/80 hover:text-black' : 'text-sky-50 hover:text-white'} text-sm group cursor-pointer`}><Sword size={16} className="group-hover:rotate-45 transition-transform" /> CONQUER</button>
                                            <a href={activeQuest.link} target="_blank" className={`w-12 h-12 border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:border-white hover:text-white' : 'hover:border-black hover:text-black'} flex items-center justify-center transition-colors cursor-pointer duration-700`}><ExternalLink size={18} /></a>
                                            <button onClick={() => { setEditingItem(activeQuest); setIsModalOpen(true); }} className={`w-12 h-12 border ${theme.borderSubtle} ${theme.isDark ? 'hover:border-white hover:text-white' : 'hover:border-black hover:text-black'} flex items-center justify-center transition-colors cursor-pointer duration-700`}><Terminal size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                            </SystemFrame>
                        </div>
                    </div>
                    {/* Stat Boxes — fixed height on all screens */}
                    <div className="grid grid-cols-4 gap-2 h-20 sm:h-24 shrink-0 mb-1 lg:mb-0">
                        <StatBox value={activeQuest.currentChapter} label="WISDOM" icon={Cpu} color="text-blue-500" theme={theme} />
                        <StatBox value={Math.floor(activeQuest.totalChapters / 10)} label="MIGHT" icon={Sword} color="text-red-500" theme={theme} />
                        <StatBox value={`${progressPercent}%`} label="SYNC" icon={Activity} color={theme.highlightText} theme={theme} />
                        <StatBox value={activeQuest.status === 'CONQUERED' ? 'CLOSED' : 'OPEN'} label="GATE" icon={Target} color={activeQuest.status === 'CONQUERED' ? 'text-gray-400' : theme.highlightText} theme={theme} />
                    </div>
                </div>

                {/* RIGHT COLUMN: SIDEBAR */}
                <div className="w-full lg:w-96 xl:w-96 flex-none flex flex-col gap-2 lg:min-h-0 order-2 mt-8 lg:mt-0 pb-24 lg:pb-0">
                    {/* PLAYER CARD */}
                    <div className="w-full h-auto overflow-hidden">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="px-3 py-2 flex flex-col gap-2">
                                <div className="flex flex-row items-center gap-4">
                                    <div className="relative flex-none">
                                        {/* Technical Scanning Decoration */}
                                        <div className="absolute inset-x-0 top-0 flex justify-between px-1 opacity-30">
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'}`} />
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'}`} />
                                        </div>

                                        <div className="relative p-0.5">
                                            <EntityAvatar theme={theme} size={84} />
                                            <button
                                                onClick={() => setIsProfileOpen(true)}
                                                className={`absolute -bottom-1 -right-2 px-1 py-0.5 ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'} text-black text-[7px] font-black font-mono tracking-tighter uppercase cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 shadow-lg z-20`}
                                            >
                                                ACTIVE_PROFILE
                                            </button>
                                        </div>

                                        {/* Vertical Scan Line decoration */}
                                        <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[1px] h-8 ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'} opacity-20`} />
                                    </div>

                                    <div className="flex flex-col items-start text-left flex-1 min-w-0 sm:-mt-6">
                                        <div className={`text-[10px] ${theme.highlightText} font-black font-mono uppercase tracking-[0.2em] mb-1 mt-0.5 opacity-90 transition-colors duration-700 whitespace-nowrap`}>ENTITY CLASSIFICATION</div>
                                        <div className="text-4xl font-black font-manifold italic tracking-tight drop-shadow-sm flex items-baseline leading-normal overflow-hidden sm:overflow-visible pr-12 sm:-ml-6">
                                            <span className={`inline-block px-6 text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} transition-colors duration-700 -ml-2`}>{playerRank.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3"><div className={`flex justify-between text-[8px] font-mono ${theme.highlightText} mb-0.5 transition-colors duration-700`}><span>EXP ACQUIRED</span><span>{totalChaptersRead} PTS</span></div><div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} transition-colors duration-700 overflow-hidden relative`}><div className={`h-full w-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-transform duration-700 origin-left`} style={{ transform: `scaleX(0.6)`, color: theme.id === 'LIGHT' ? '#06b6d4' : '#f59e0b' }} /></div></div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* DIVINE MANDATE */}
                    <div className="w-full h-auto">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="p-4 relative overflow-hidden">
                                <div className={`absolute inset-0 bg-[linear-gradient(rgba(${theme.starColor},0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(${theme.starColor},0.03)_1px,transparent_1px)] bg-[size:20px_20px] transition-colors duration-700`} />
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6"><div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[10px] tracking-widest font-bold transition-colors duration-700`}><Flame size={12} /> DIVINE_MANDATE</div><span className={`text-[9px] font-mono tracking-widest opacity-70 ${theme.mutedText} transition-colors duration-700`}>{userState.dailyAbsorbed >= 5 ? 'CONQUERED' : 'PENDING'}</span></div>
                                    <div className="space-y-1 mb-2"><div className={`text-[9px] ${theme.mutedText} font-mono tracking-widest transition-colors duration-700`}>OBJECTIVE</div><div className="flex justify-between items-end"><div className={`text-xl font-black italic ${theme.headingText} tracking-wide transition-colors duration-700`}>ABSORB 5 STORIES</div><div className={`${theme.highlightText} font-mono text-lg font-bold transition-colors duration-700`}>{Math.min(5, userState.dailyAbsorbed)}<span className={`${theme.mutedText} text-sm transition-colors duration-700`}>/5</span></div></div></div>
                                    <div className={`h-1 w-full ${theme.isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'} border mt-2 transition-colors duration-700 overflow-hidden relative`}><div className={`h-full w-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-transform duration-700 origin-left`} style={{ transform: `scaleX(${Math.min(1, userState.dailyAbsorbed / 5)})`, color: theme.id === 'LIGHT' ? '#06b6d4' : '#f59e0b' }} /></div>
                                </div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* ACTIVE QUESTS LIST - only scrollable region allowed */}
                    <div className="flex-1 flex flex-col min-h-0 gap-1 mt-2">
                        <div className={`text-[10px] font-mono ${theme.headingText} uppercase tracking-widest border-b ${theme.borderSubtle} pb-1.5 mb-1 transition-colors duration-700 shrink-0`}>ACTIVE QUESTS</div>
                        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
                            <div className="flex flex-col gap-1 h-full">
                                {activeQuests.map((item) => {
                                    const isHighlighted = activeId === item.id;
                                    return (
                                        <div key={item.id} onClick={() => handleLogClick(item.id)} className={`relative group cursor-pointer border py-1.5 px-3 transition-all duration-200 ${isHighlighted ? `${theme.border} ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/5'}` : `border-transparent hover:${theme.borderSubtle} bg-transparent`}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className={`font-bold font-mono text-xs ${isHighlighted ? theme.highlightText : `${theme.mutedText} group-hover:${theme.headingText}`} transition-colors duration-700 uppercase`}>{item.title}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className={`w-1 h-1 rounded-full ${item.status === 'ACTIVE' ? (theme.isDark ? 'bg-amber-400' : 'bg-cyan-500') : 'bg-gray-400'}`} />
                                                        <span className={`text-[9px] ${theme.mutedText} uppercase font-mono tracking-widest transition-colors duration-700`}>{item.status}</span>
                                                    </div>
                                                </div>
                                                {isHighlighted && <Sun size={14} className={`${theme.highlightText} animate-spin-slow transition-colors duration-700`} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* DIVINE SPIRE BUTTON */}
                    <button onClick={() => { setIsSpireOpen(true); }} className={`hidden lg:flex w-full py-3 lg:py-4 ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/10'} border ${theme.borderSubtle} ${theme.highlightText} hover:bg-${theme.primary}-500 ${theme.isDark ? 'hover:text-black' : 'hover:text-white'} font-mono font-bold tracking-widest uppercase transition-all items-center justify-center gap-2 text-xs shrink-0 shadow-sm cursor-pointer duration-700`}><LayoutTemplate size={16} /> DIVINE SPIRE</button>
                </div>
            </div>
        </main>
    ), [theme, currentTheme, isSpireOpen, activeQuest, progressPercent, activeId, handleLogClick, activeQuests, totalChaptersRead, playerRank, userState, updateProgress]);

    if (booting) return <BootScreen onComplete={() => setBooting(false)} theme={theme} />;

    if (!isAuth) return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} />;

    return (
        <div id="main-scroll-area" className={`fixed inset-0 overflow-hidden ${theme.appBg} ${theme.baseText} font-sans selection:bg-amber-500/30 transition-colors duration-700 ease-in-out`}>
            <BackgroundController theme={theme} isPaused={isModalOpen} isMobile={isMobile} />
            {/* BACKGROUND GRADIENT FIX */}
            <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_100%)] opacity-50" />

            {/* HEADER */}
            {!isSpireOpen && memoizedHeader}

            {/* MAIN GRID */}
            {!isSpireOpen && memoizedMain}

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isProfileOpen && (
                    <HunterProfile
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        theme={theme}
                        items={library}
                        playerRank={playerRank}
                        onImport={handleImportQuests}
                        onLogout={handleLogout}
                        showNotification={showSystemNotification}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isDetailOpen && (
                    <ManhwaDetail
                        isOpen={isDetailOpen}
                        onClose={() => setIsDetailOpen(false)}
                        quest={selectedQuest}
                        theme={theme}
                        allQuests={library}
                        onSetActive={handleSetActiveQuest}
                        onUpdate={async (id, data) => handleSave({ id, ...data })}
                        onEdit={(q) => {
                            setEditingItem(q);
                            setIsModalOpen(true);
                            setIsDetailOpen(false);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isSpireOpen && (
                    <DivineSpire
                        isOpen={isSpireOpen}
                        onClose={() => setIsSpireOpen(false)}
                        theme={theme}
                        items={spireItems}
                        onActivate={handleActivate}
                        itemsPerFloor={ITEMS_PER_FLOOR}
                        playerRank={playerRank}
                        streak={userState.streak}
                    />
                )}
            </Suspense>


            <Suspense fallback={null}>
                {isModalOpen && (
                    <SystemGateModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSave={handleSave}
                        onDelete={deleteQuest}
                        initialData={editingItem}
                        theme={theme}
                        existingQuests={library}
                    />
                )}
            </Suspense>


            {/* HUD / SYSTEM OVERLAYS (HOLOGRAPHIC) */}
            {(!isSpireOpen && !isModalOpen && !isProfileOpen && !isDetailOpen) && (
                <div className={`lg:hidden fixed bottom-10 left-0 w-full px-5 z-[80] flex items-end gap-3 pointer-events-none pb-[env(safe-area-inset-bottom)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isHUDVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
                    {/* DIVINE SPIRE PANEL */}
                    <button
                        onClick={() => setIsSpireOpen(true)}
                        className={`pointer-events-auto flex-1 h-14 holographic-panel border bg-amber-500/10 rounded-sm border-amber-500/50 flex items-center justify-center gap-3 transition-all active:scale-95 group shadow-[0_0_20px_rgba(245,158,11,0.15)] overflow-hidden`}
                    >
                        <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500 bracket-glow opacity-100`} />
                        <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500 bracket-glow opacity-100`} />
                        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500 bracket-glow opacity-100`} />
                        <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500 bracket-glow opacity-100`} />

                        <div className="absolute inset-0 bg-amber-500/5 mix-blend-screen pointer-events-none" />

                        <LayoutTemplate size={20} className={`text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]`} />
                        <div className="flex flex-col items-start relative z-10">
                            <span className={`text-[7px] font-mono text-amber-500/80 tracking-tighter leading-none mb-0.5`}>TERMINAL.EXECUTE</span>
                            <span className={`text-[11px] font-black font-mono text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)] tracking-[0.2em] uppercase leading-none`}>DIVINE_SPIRE</span>
                        </div>
                    </button>

                    {/* CREATE GATE PANEL */}
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className={`pointer-events-auto w-14 h-14 bg-amber-500/10 holographic-panel rounded-sm border border-amber-500/60 flex items-center justify-center transition-all active:scale-90 shadow-[0_0_20px_rgba(245,158,11,0.2)] group`}
                    >
                        <div className={`absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <Plus size={24} strokeWidth={2.5} className={`text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]`} />
                    </button>
                </div>
            )}

            <SystemConsole theme={theme} />

            <SystemNotification
                isOpen={sysNote.isOpen}
                message={sysNote.message}
                type={sysNote.type}
                confirm={sysNote.confirm}
                onClose={handleSysNoteClose}
                theme={theme}
            />
        </div>
    );
};

export default App;
