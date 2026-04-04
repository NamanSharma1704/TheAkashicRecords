import React, { useState, useEffect, useMemo, Suspense, lazy, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Quest } from './types';
import SystemFrame from '../components/system/SystemFrame';
import SystemLogo from '../components/system/SystemLogo';
import ScrambleText from '../components/system/ScrambleText';
import { Sword, Activity, ExternalLink, Terminal, Sun, Moon, Plus, Zap, Crown, X, LayoutTemplate, GripVertical } from 'lucide-react';
import { getPlayerRank, getThemedRankStyle, calculateQuestRank } from '../utils/ranks';
import { THEMES, ITEMS_PER_FLOOR } from './constants';

import SystemConsole from '../components/system/SystemConsole';
import BootScreen from '../components/system/BootScreen';
import BackgroundController from '../components/fx/BackgroundController';
import EntityAvatar from '../components/system/EntityAvatar';
import SystemNotification from '../components/system/SystemNotification';
import SystemCompass from '../components/system/SystemCompass';

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

// SUB-COMPONENT: QuestListItem to handle individual drag controls and touch scrolling
const QuestListItem = ({ item, theme, activeId, handleLogClick }: any) => {
    const dragControls = useDragControls();
    const isHighlighted = activeId === item.id;

    return (
        <Reorder.Item
            key={item.id}
            value={item}
            dragListener={false}
            dragControls={dragControls}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleLogClick(item.id)}
            className={`relative group cursor-pointer border py-1.5 px-3 transition-colors duration-200 ${isHighlighted ? `${theme.border} ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/5'}` : `border-transparent hover:${theme.borderSubtle} bg-transparent`}`}
        >
            <div className="flex justify-between items-center h-full">
                <div className="flex items-center gap-2 max-w-[85%] min-w-0">
                    {/* Dedicated Drag Handle for iPad scrolling support */}
                    <div
                        className={`cursor-grab active:cursor-grabbing p-1 -ml-2 opacity-0 group-hover:opacity-40 transition-opacity flex-none ${theme.baseText}`}
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <GripVertical size={14} />
                    </div>

                    {item.coverUrl && (
                        <div className={`w-8 h-[45px] xl:w-10 xl:h-[56px] flex-none rounded-sm border ${theme.isDark ? 'border-gray-800' : 'border-gray-300'} bg-black overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity shadow-sm object-cover shrink-0`}>
                            <img src={item.coverUrl} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className={`font-bold font-mono text-xs ${isHighlighted ? theme.highlightText : `${theme.mutedText} group-hover:${theme.headingText}`} transition-colors duration-700 uppercase truncate`}>{item.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-1 h-1 rounded-full flex-none ${item.status === 'ACTIVE' ? (theme.isDark ? 'bg-amber-400' : 'bg-cyan-500') : 'bg-gray-400'}`} />
                            <span className={`text-[9px] ${theme.mutedText} uppercase font-mono tracking-widest transition-colors duration-700 truncate`}>{item.status}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isHighlighted && <Sun size={14} className={`${theme.highlightText} animate-spin-slow transition-colors duration-700 shrink-0`} />}
                </div>
            </div>
        </Reorder.Item>
    );
};


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

    // Cover-extracted accent color — dynamically sampled per active quest
    const [pendingCoverUrl, setPendingCoverUrl] = useState<string>('');
    useEffect(() => { if (activeId) setPendingCoverUrl(''); }, [activeId]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSpireOpen, setIsSpireOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const detailOpenedFromProfile = useRef(false);

    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
    const [editingItem, setEditingItem] = useState<Quest | null>(null);

    const [customSortOrder, setCustomSortOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('activeQuestOrder');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [orderedActiveQuests, setOrderedActiveQuests] = useState<Quest[]>([]);

    // --- SCROLL HANDLING STATE ---
    const [isHUDVisible, setIsHUDVisible] = useState(true);
    const [isMobileHudExpanded, setIsMobileHudExpanded] = useState(false);

    const isMobileHudExpandedRef = useRef(false);
    useEffect(() => {
        isMobileHudExpandedRef.current = isMobileHudExpanded;
    }, [isMobileHudExpanded]);

    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerHUD = () => {
        setIsHUDVisible(true);

        if (hudTimeoutRef.current) {
            clearTimeout(hudTimeoutRef.current);
        }

        if (isMobileHudExpandedRef.current) return;

        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDVisible(false);
        }, 2000);
    };

    // Keep the HUD permanently visible while it is expanded;
    // restart the auto-hide countdown when it collapses.
    useEffect(() => {
        if (isMobileHudExpanded) {
            // Cancel any in-flight hide timer and lock HUD on.
            if (hudTimeoutRef.current) {
                clearTimeout(hudTimeoutRef.current);
                hudTimeoutRef.current = null;
            }
            setIsHUDVisible(true);
        } else {
            // HUD just collapsed — restart the 2-second countdown.
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => {
                setIsHUDVisible(false);
            }, 2000);
        }
    }, [isMobileHudExpanded]);

    useEffect(() => {
        if (booting || !isAuth) return;

        let lastScrollY = 0;

        const scrollContainer = document.getElementById('content-scroll');
        if (!scrollContainer) return;

        const handleScroll = () => {
            const currentScrollY = scrollContainer.scrollTop;

            // Header logic
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsHeaderVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setIsHeaderVisible(true);
            }

            lastScrollY = currentScrollY;

            triggerHUD();
        };

        // Initial auto-hide
        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDVisible(false);
        }, 2000);

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        scrollContainer.addEventListener('touchstart', triggerHUD, { passive: true });
        scrollContainer.addEventListener('pointerdown', triggerHUD);

        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
            scrollContainer.removeEventListener('touchstart', triggerHUD);
            scrollContainer.removeEventListener('pointerdown', triggerHUD);
            if (hudTimeoutRef.current) {
                clearTimeout(hudTimeoutRef.current);
            }
        };
    }, [booting, isAuth, isSpireOpen]);

    // Force scroll reset on responsive mode shift to prevent ghost scroll gaps
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                const scroller = document.getElementById('content-scroll');
                if (scroller && scroller.scrollTop > 0) {
                    scroller.scrollTop = 0;
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isSpireOpen && !isDetailOpen && !isModalOpen && !isProfileOpen) {
            triggerHUD();
        }
    }, [isSpireOpen, isDetailOpen, isModalOpen, isProfileOpen]);

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

    const handleViewDetails = (id: string) => {
        const item = library.find(q => q.id === id);
        if (item) {
            setSelectedQuest(item);
            setIsDetailOpen(true);
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
        return library.filter(item => item.status === 'ACTIVE');
    }, [library]);

    useEffect(() => {
        const sorted = [...activeQuests].sort((a, b) => {
            const indexA = customSortOrder.indexOf(a.id);
            const indexB = customSortOrder.indexOf(b.id);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
        });
        setOrderedActiveQuests(sorted);
    }, [activeQuests, customSortOrder]);

    const handleReorderActiveQuests = (newOrder: Quest[]) => {
        setOrderedActiveQuests(newOrder); // Optimistic UI update
        const newIds = newOrder.map(q => q.id);
        setCustomSortOrder(newIds);
        localStorage.setItem('activeQuestOrder', JSON.stringify(newIds));
    };
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
        Object.entries(data).forEach(([key, value]) => {
            if (['id', '_id', '__v', 'lastRead', 'lastUpdated', 'cover', 'readLink'].includes(key)) return;
            if (key === 'coverUrl') body.cover = value;
            else if (key === 'link') body.readLink = value;
            else if (['currentChapter', 'totalChapters'].includes(key)) body[key] = Number(value) || 0;
            else body[key] = value;
        });

        // 2. OPTIMISTIC UPDATE — close modal & update UI instantly, sync in background
        const tempId = `optimistic-${Date.now()}`;
        const optimisticItem: Quest = {
            ...(data as Quest),
            id: isEditing ? targetId! : tempId,
            lastUpdated: new Date().toISOString(),
        };

        if (isEditing) {
            setLibrary(prev => prev.map(q => q.id === targetId ? optimisticItem : q));
            if (selectedQuest?.id === targetId) setSelectedQuest(optimisticItem);
        } else {
            setLibrary(prev => [optimisticItem, ...prev]);
            handleActivate(optimisticItem.id);
        }

        // Close modal immediately — no waiting
        setIsModalOpen(false);
        setEditingItem(null);

        // 3. BACKGROUND SYNC to Atlas
        try {
            const res = await systemFetch(url, { method, body: JSON.stringify(body) });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Save failure');
            }
            const saved = await res.json();
            const mappedSaved = mapQuest(saved);

            // Replace optimistic item with real server data
            if (isEditing) {
                setLibrary(prev => prev.map(q => q.id === targetId ? mappedSaved : q));
                if (selectedQuest?.id === targetId) setSelectedQuest(mappedSaved);
            } else {
                setLibrary(prev => prev.map(q => q.id === tempId ? mappedSaved : q));
            }
        } catch (e: any) {
            console.error("Save failure — rolling back:", e);
            // Rollback optimistic update on failure
            if (isEditing) {
                setLibrary(prev => prev.map(q => q.id === targetId ? (editingItem || q) : q));
            } else {
                setLibrary(prev => prev.filter(q => q.id !== tempId));
            }
            showSystemNotification(`SYNC_FAILED: ${e.message}`, 'ERROR');
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
        <AnimatePresence>
            {isHeaderVisible && (
                <motion.header
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="fixed top-0 w-full z-40 bg-transparent h-16 px-6 flex items-center justify-between"
                >
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
                </motion.header>
            )}
        </AnimatePresence>
    ), [theme, currentTheme, isHeaderVisible]);

    const memoizedMain = useMemo(() => (
        <main id="content-scroll"
            className="relative mt-16 h-[calc(100dvh-104px)] lg:h-[calc(100dvh-100px)] overflow-y-auto lg:overflow-hidden overflow-x-hidden hide-scrollbar px-4 pb-6 lg:pb-2 z-10 flex flex-col">
            <div className="w-full max-w-[1400px] mx-auto flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 pt-2 lg:pt-2 pb-0">
                {/* LEFT COLUMN: HERO CANVAS */}
                <div className="flex-none lg:flex-1 flex flex-col lg:h-full order-1 overflow-visible relative">
                    <div className="relative z-10 w-full h-full flex flex-col px-4 md:px-6 lg:px-8 pb-2 justify-between gap-4 overflow-visible pt-8">

                        {/* CENTER: The 3-Column Display (Enhanced Gaps for Tablets) */}
                        <div className="flex-1 min-h-0 flex justify-center items-center gap-4 md:gap-14 lg:gap-6 xl:gap-12 w-full max-w-[1400px] mx-auto px-4">

                            {/* Left Column: Rank & Class — justify-center+self-stretch centers against cover */}
                            <div className="hidden md:flex flex-col items-end justify-center self-stretch flex-1 basis-0 min-w-0 shrink">
                                <div className="flex flex-col items-end gap-6 xl:gap-8 w-full -mt-[30px]">
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-2 flex items-center justify-end gap-1.5`}>
                                            <Crown size={10} style={{ color: theme.accentColor }} />
                                            <span style={{ marginRight: '-0.3em' }}>RANK ASSESSMENT</span>
                                        </div>
                                        <div className={`text-6xl xl:text-[80px] font-black font-orbitron leading-none transition-colors duration-700 text-right`}
                                            style={{ color: theme.accentColor, filter: `drop-shadow(0 0 25px ${theme.accentColor}88)` }}>
                                            {calculateQuestRank(activeQuest)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-1 text-right w-full`}>CLASSIFICATION</div>
                                        <div className={`text-base lg:text-lg xl:text-2xl font-black font-orbitron tracking-wider whitespace-nowrap text-right transition-colors duration-700`}
                                            style={{ color: theme.accentColor }}>{activeQuest.classType || 'UNKNOWN'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex-none h-full min-h-0 min-w-0 w-[min(85vw,320px)] md:w-full md:max-w-[45%] lg:w-auto lg:max-h-[85vh] aspect-[72/103] self-center flex items-center justify-center transition-all duration-700 ease-out transform-gpu hover:-translate-y-2 perspective-[1000px] group">
                                {/* FROSTED GLASS PLATFORM (Sharp Square Base) */}
                                <div
                                    className="absolute -inset-4 backdrop-blur-3xl pointer-events-none transition-all duration-700 opacity-100 group-hover:opacity-60"
                                    style={{
                                        background: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)',
                                        border: theme.isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.1)',
                                        boxShadow: theme.isDark ? '0 10px 40px rgba(0,0,0,0.2)' : '0 10px 40px rgba(0,0,0,0.08)'
                                    }}
                                />

                                {/* Outer wrapper: pulsing glow border around the cover (SHARP + PARALLAX FLOAT) */}
                                <div className="relative w-full h-full shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-all duration-700 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)]">

                                    {/* Corner Reticles (External Floating Targeting Geometry) */}
                                    <div className="absolute -top-[16px] -left-[16px] w-8 h-8 border-t-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: theme.isDark ? '#E2E8F0' : '#475569', filter: theme.isDark ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                                    <div className="absolute -top-[16px] -right-[16px] w-8 h-8 border-t-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: theme.isDark ? '#E2E8F0' : '#475569', filter: theme.isDark ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                                    <div className="absolute -bottom-[16px] -left-[16px] w-8 h-8 border-b-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: theme.isDark ? '#E2E8F0' : '#475569', filter: theme.isDark ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                                    <div className="absolute -bottom-[16px] -right-[16px] w-8 h-8 border-b-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: theme.isDark ? '#E2E8F0' : '#475569', filter: theme.isDark ? 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />

                                    {/* Pulsing border glow (Unified High-Contrast Chrome - Visible on White) */}
                                    <div
                                        className="absolute -inset-[3.5px] animate-[pulse_3s_ease-in-out_infinite] pointer-events-none z-10"
                                        style={{
                                            border: theme.isDark ? `1.5px solid rgba(255, 255, 255, 0.95)` : `1.5px solid #475569`,
                                            outline: theme.isDark ? `0.5px solid rgba(255, 255, 255, 0.1)` : `0.5px solid rgba(0, 0, 0, 0.1)`,
                                            boxShadow: theme.isDark
                                                ? `0 0 20px rgba(255, 255, 255, 0.4), 0 0 40px ${theme.accentColor}22, inset 0 0 10px rgba(255, 255, 255, 0.2)`
                                                : `0 4px 15px rgba(0, 0, 0, 0.15), 0 0 20px ${theme.accentColor}22, inset 0 0 5px rgba(0, 0, 0, 0.2)`
                                        }}
                                    />
                                    {/* Inner cover image container (SHARP + HIGH IMAGE VISIBILITY) */}
                                    <div
                                        className={`w-full h-full overflow-hidden relative transition-all duration-700`}
                                        style={{
                                            border: theme.isDark ? `1px solid rgba(255, 255, 255, 0.1)` : `1px solid rgba(0, 0, 0, 0.15)`,
                                            boxShadow: `inset 0 0 15px rgba(0,0,0,0.3)` /* Lighter internal vignette */
                                        }}
                                    >
                                        <img
                                            src={activeQuest.coverUrl}
                                            className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />

                                        {/* THEME-ADAPTIVE TINT OVERLAY (Color Unity) */}
                                        <div
                                            className="absolute inset-0 pointer-events-none transition-colors duration-700"
                                            style={{
                                                backgroundColor: theme.accentColor,
                                                opacity: theme.isDark ? 0.04 : 0.15,
                                                mixBlendMode: theme.isDark ? 'overlay' : 'soft-light'
                                            }}
                                        />

                                        {/* HOLOGRAPHIC SWEEP (System Scan) */}
                                        <motion.div
                                            className="absolute inset-0 z-20 pointer-events-none"
                                            initial={{ x: '-100%', y: '-100%' }}
                                            animate={{ x: '100%', y: '100%' }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                                            style={{
                                                background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.2) 50%, transparent 55%)'
                                            }}
                                        />

                                        {/* Hover gradient overlay (Initial opacity-0 for immediate full visibility) */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        {/* Bright Bottom Accent Bar */}
                                        <div
                                            className="absolute bottom-0 left-0 w-full h-[4px] z-30"
                                            style={{
                                                background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)`,
                                                boxShadow: `0 0 15px rgba(255, 255, 255, 0.5)`
                                            }}
                                        />
                                    </div>{/* end inner cover */}
                                </div>
                            </div>{/* end outer glow wrapper */}

                            {/* Right Column: Sequence & System Log — justify-center mirrors left */}
                            <div className="hidden md:flex flex-col items-start justify-center gap-4 md:gap-6 xl:gap-10 self-stretch flex-1 basis-0 min-w-0 shrink">
                                <div className="flex flex-col items-start w-max max-w-none">
                                    <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-1`}>SEQUENCE DATA</div>
                                    <div className={`text-5xl xl:text-[70px] font-black font-mono tabular-nums leading-none text-left transition-colors duration-700`}
                                        style={{ color: theme.accentColor }}>
                                        {String(activeQuest.currentChapter).padStart(3, '0')}
                                    </div>
                                    <div className={`text-[11px] font-mono tracking-widest mt-2 ${theme.mutedText}`}>
                                        OF <span className={`font-bold`} style={{ color: theme.accentColor }}>{activeQuest.totalChapters}</span> CHAPTERS
                                    </div>
                                </div>

                                <div className="w-full max-w-[220px]">
                                    <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-2 flex items-center gap-1.5 border-b ${theme.borderSubtle} pb-2`}>
                                        <span className={`w-1 h-1 rounded-full animate-ping`} style={{ backgroundColor: theme.accentColor }} /> EVENT_LOG
                                    </div>
                                    <div className={`flex flex-col gap-1.5 text-[9px] font-mono leading-relaxed tracking-wider mt-2`} style={{ color: `${theme.accentColor}bb` }}>
                                        <div className="flex gap-2">
                                            <span className="opacity-40 shrink-0">[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                                            <span className="whitespace-nowrap">Signal acquired.</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="opacity-40 shrink-0">[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                                            <span className={`font-bold whitespace-nowrap`} style={{ color: theme.accentColor, textShadow: `0 0 10px ${theme.accentColor}` }}>Awaiting directive.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 shrink-0 pointer-events-auto">
                            {/* Title — overflow-visible to prevent last character clipping */}
                            <div className="text-center flex flex-col items-center justify-end px-6 w-full min-h-[3rem] sm:min-h-[4rem] xl:min-h-[5rem] overflow-visible">
                                <h1
                                    className={`text-2xl sm:text-3xl xl:text-4xl font-black font-orbitron tracking-tighter text-transparent bg-clip-text uppercase leading-[1.15] line-clamp-2 w-full`}
                                    style={{
                                        backgroundImage: `linear-gradient(90deg, ${theme.accentColor}cc, ${theme.accentColor}, ${theme.accentColor}cc)`,
                                        textTransform: 'uppercase',
                                        paddingBottom: '0.1em', // prevents descender clipping
                                    }}
                                >
                                    {activeQuest.title}
                                </h1>
                            </div>

                            {/* Progress */}
                            <div className="space-y-1.5 max-w-3xl w-full mx-auto">
                                <div className={`flex justify-between text-[11px] sm:text-xs font-mono font-bold tracking-widest drop-shadow-md`}>
                                    <span className={`flex items-center gap-1.5 ${theme.headingText}`}><Zap size={14} style={{ color: theme.accentColor }} /> COMPLETION_RATE</span>
                                    <span style={{ color: theme.accentColor }}>{progressPercent}%</span>
                                </div>
                                <div className={`h-1.5 ${theme.isDark ? 'bg-gray-900/40' : 'bg-gray-300/40'} w-full relative overflow-hidden backdrop-blur-md rounded-full shadow-inner`}>
                                    <div className={`h-full transition-transform duration-700 ease-out origin-left`}
                                        style={{ transform: `scaleX(${progressPercent / 100})`, background: `linear-gradient(90deg, ${theme.accentColor}99, ${theme.accentColor})`, boxShadow: `0 0 12px ${theme.accentColor}88` }} />
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex gap-2 max-w-3xl w-full mx-auto justify-center mt-2">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateProgress(-1)}
                                    className={`w-14 h-12 flex-none border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/80 hover:border-white hover:text-white backdrop-blur-md' : 'bg-white/80 hover:border-black hover:text-black backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm`}>
                                    <span className="text-xl font-bold">-</span>
                                </motion.button>
                                <motion.a whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} href={activeQuest.link || '#'} target="_blank"
                                    className={`h-12 flex-1 max-w-[400px] backdrop-blur-md flex items-center justify-center gap-2 transition-all font-mono font-bold tracking-widest text-[12px] group cursor-pointer shadow-lg rounded-sm border text-white drop-shadow-md`}
                                    style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, boxShadow: `0 0 20px ${theme.accentColor}66` }}>
                                    <ExternalLink size={16} className="group-hover:rotate-12 transition-transform" /> ENTER PORTAL
                                </motion.a>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateProgress(1)}
                                    className={`w-14 h-12 flex-none border ${theme.borderSubtle} ${theme.isDark ? 'hover:border-white hover:text-white bg-black/80 backdrop-blur-md' : 'hover:border-black hover:text-black bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm`}
                                    style={{ color: theme.accentColor }}>
                                    <Sword size={18} />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setEditingItem(activeQuest); setIsModalOpen(true); }}
                                    className={`w-14 h-12 flex-none border ${theme.borderSubtle} ${theme.isDark ? 'hover:border-white hover:text-white bg-black/80 backdrop-blur-md' : 'hover:border-black hover:text-black bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer shadow-lg rounded-sm`}>
                                    <Terminal size={16} />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: SIDEBAR */}
                <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-1.5 lg:gap-2 lg:min-h-0 lg:h-full order-2 mb-10 lg:mb-0">
                    {/* PLAYER CARD */}
                    <div className="w-full h-auto">
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
                                        <div className="text-3xl sm:text-4xl lg:text-2xl xl:text-4xl font-black font-manifold tracking-tight drop-shadow-sm flex items-baseline leading-normal overflow-hidden">
                                            <span className={`inline-block pr-[6px] text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} transition-colors duration-700 truncate`}>{playerRank.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3"><div className={`flex justify-between text-[8px] font-mono ${theme.highlightText} mb-0.5 transition-colors duration-700`}><span>EXP ACQUIRED</span><span>{totalChaptersRead} PTS</span></div><div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} transition-colors duration-700 overflow-hidden relative`}><div className={`h-full w-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-transform duration-700 origin-left`} style={{ transform: `scaleX(0.6)`, color: theme.id === 'LIGHT' ? '#06b6d4' : '#f59e0b' }} /></div></div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* QUEST METRICS (Replaces Stat Box Grid) */}
                    <div className="w-full h-auto">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="px-3 py-2 flex flex-col gap-1">
                                <div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[9px] tracking-widest font-bold mb-1`}>
                                    <Activity size={11} /> QUEST_METRICS
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>WISDOM</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{activeQuest.currentChapter}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>CH. READ</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>MIGHT</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{Math.floor(activeQuest.totalChapters / 10)}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>PWR INDEX</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>SYNC</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{progressPercent}%</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>COMPLETION</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>GATE</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${activeQuest.status === 'CONQUERED' ? 'text-gray-400' : theme.highlightText}`}>{activeQuest.status === 'CONQUERED' ? 'CLOSED' : 'OPEN'}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>STATUS</div>
                                    </div>
                                </div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* ACTIVE QUESTS LIST - only scrollable region allowed */}
                    <div className="flex-1 flex flex-col min-h-0 gap-1 mt-2 overflow-hidden max-h-[380px] lg:max-h-none">
                        <div className={`text-[10px] font-mono ${theme.headingText} uppercase tracking-widest border-b ${theme.borderSubtle} pb-1.5 mb-1 transition-colors duration-700 shrink-0`}>ACTIVE QUESTS</div>
                        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar touch-pan-y overscroll-contain">
                            <Reorder.Group
                                axis="y"
                                values={orderedActiveQuests}
                                onReorder={handleReorderActiveQuests}
                                className="flex flex-col gap-1 h-full pb-6"
                            >
                                <AnimatePresence initial={false}>
                                    {orderedActiveQuests.map((item) => (
                                        <QuestListItem
                                            key={item.id}
                                            item={item}
                                            theme={theme}
                                            activeId={activeId}
                                            handleLogClick={handleLogClick}
                                        />
                                    ))}
                                </AnimatePresence>
                            </Reorder.Group>
                        </div>
                    </div>

                    {/* DIVINE SPIRE BUTTON */}
                    <button aria-label="Open Divine Spire" onClick={() => { setIsSpireOpen(true); }} className={`mt-auto hidden lg:flex w-full py-2 lg:py-3 xl:py-4 ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/10'} border ${theme.borderSubtle} ${theme.highlightText} hover:bg-${theme.primary}-500 ${theme.isDark ? 'hover:text-black' : 'hover:text-white'} font-mono font-bold tracking-widest uppercase transition-all items-center justify-center gap-2 text-xs shrink-0 shadow-sm cursor-pointer duration-700`}><LayoutTemplate size={16} /> DIVINE SPIRE</button>
                </div>
            </div>
        </main>
    ), [theme, currentTheme, isSpireOpen, activeQuest, progressPercent, activeId, handleLogClick, activeQuests, totalChaptersRead, playerRank, userState, updateProgress]);

    if (booting) return <BootScreen onComplete={() => setBooting(false)} theme={theme} />;

    if (!isAuth) return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} />;

    return (
        <div id="main-scroll-area" className={`relative h-[100dvh] overflow-hidden ${theme.appBg} ${theme.baseText} font-sans selection:bg-amber-500/30 transition-colors duration-700 ease-in-out`}>
            <BackgroundController theme={theme} isPaused={isModalOpen} isMobile={isMobile} />
            {/* BACKGROUND GRADIENT FIX */}
            <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_100%)] opacity-50" />

            {/* HEADER */}
            {!isSpireOpen && memoizedHeader}

            {/* MAIN GRID */}
            {!isSpireOpen && memoizedMain}

            {/* DASHBOARD CONSOLE */}
            {!isSpireOpen &&
                !isModalOpen &&
                !isProfileOpen &&
                !isDetailOpen && (
                    <SystemConsole theme={theme} />
                )}

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isProfileOpen && (
                    <HunterProfile
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        theme={theme}
                        items={library}
                        playerRank={playerRank}
                        onImport={handleImportQuests}
                        onRefresh={fetchInitialData}
                        onLogout={handleLogout}
                        showNotification={showSystemNotification}
                        onSelectManhwa={(id) => {
                            detailOpenedFromProfile.current = true;
                            setIsProfileOpen(false);
                            handleViewDetails(id);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isDetailOpen && (
                    <ManhwaDetail
                        isOpen={isDetailOpen}
                        onClose={() => {
                            setIsDetailOpen(false);
                            if (detailOpenedFromProfile.current) {
                                detailOpenedFromProfile.current = false;
                                setIsProfileOpen(true);
                            }
                        }}
                        quest={selectedQuest}
                        theme={theme}
                        allQuests={library}
                        onSetActive={handleSetActiveQuest}
                        onUpdate={async (id, data) => handleSave({ id, ...data })}
                        onEdit={(q) => {
                            setEditingItem(q);
                            setIsModalOpen(true);
                            // Keep detail open to maintain context
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isSpireOpen && (
                    <div className="fixed inset-0 z-[200]">
                        <DivineSpire
                            isOpen={isSpireOpen}
                            onClose={() => setIsSpireOpen(false)}
                            theme={theme}
                            items={spireItems}
                            onActivate={handleActivate}
                            itemsPerFloor={ITEMS_PER_FLOOR}
                            playerRank={playerRank}
                            streak={userState.streak}
                            dailyAbsorbed={userState.dailyAbsorbed}
                        />
                    </div>
                )}
            </Suspense>


            <Suspense fallback={null}>
                <AnimatePresence>
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
                </AnimatePresence>
            </Suspense>


            {/* HUD / SYSTEM OVERLAYS (HOLOGRAPHIC) */}
            {!isSpireOpen &&
                !isModalOpen &&
                !isProfileOpen &&
                !isDetailOpen && (
                    <AnimatePresence>
                        {isHUDVisible && (
                            <div className="lg:hidden fixed bottom-6 left-0 w-full px-5 z-[80] pointer-events-none pb-[env(safe-area-inset-bottom)] flex justify-end">
                                {!isMobileHudExpanded ? (
                                    <motion.button
                                        key="fab-button"
                                        layoutId="mobile-hud-wrapper"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                                        style={{ originX: 1, originY: 1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsMobileHudExpanded(true)}
                                        className="relative pointer-events-auto w-20 h-20 flex items-center justify-center"
                                    >
                                        <SystemCompass theme={theme} />
                                    </motion.button>
                                ) : (
                                    <motion.div
                                        key="hud-grid"
                                        layoutId="mobile-hud-wrapper"
                                        initial={{ scale: 0.6, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.6, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                                        style={{ originX: 1, originY: 1 }}
                                        className="pointer-events-auto w-full isolate flex items-end gap-2"
                                    >
                                        {/* ── DIVINE SPIRE ── */}
                                        <motion.button
                                            aria-label="Open Divine Spire"
                                            onClick={() => { setIsSpireOpen(true); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.96 }}
                                            className="relative flex-1 h-16 overflow-hidden backdrop-blur-md"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(0,18,24,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(6,182,212,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 20px rgba(245,158,11,0.12), inset 0 0 30px rgba(245,158,11,0.04)'
                                                    : '0 0 20px rgba(6,182,212,0.12), inset 0 0 30px rgba(6,182,212,0.04)',
                                            }}
                                        >
                                            {/* Bracket corners — four tiny fixed SVGs, no calc() needed */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            {/* Scanline overlay */}
                                            <div className="absolute inset-0 pointer-events-none opacity-40"
                                                style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(6,182,212,0.04)'} 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(6,182,212,0.04)'} 4px)` }}
                                            />
                                            {/* Sweep line animation */}
                                            <motion.div
                                                className="absolute left-0 right-0 h-[1px] pointer-events-none"
                                                style={{ background: theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)' }}
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            />
                                            {/* Content */}
                                            <div className="relative z-10 h-full flex items-center gap-3 px-4">
                                                <LayoutTemplate size={20} className={`shrink-0 ${theme.highlightText} drop-shadow-[0_0_8px_currentColor]`} />
                                                <div className="flex flex-col items-start leading-none min-w-0">
                                                    <span className={`font-mono text-[8px] tracking-[0.25em] uppercase ${theme.highlightText} opacity-60 mb-1`}>TERMINAL.EXECUTE</span>
                                                    <span className={`font-orbitron font-black text-[11px] tracking-[0.2em] uppercase ${theme.highlightText} drop-shadow-[0_0_6px_currentColor]`}>DIVINE_SPIRE</span>
                                                </div>
                                            </div>
                                        </motion.button>

                                        {/* ── CREATE GATE ── */}
                                        <motion.button
                                            onClick={() => { setEditingItem(null); setIsModalOpen(true); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.94 }}
                                            className="relative w-16 h-16 overflow-hidden backdrop-blur-md flex flex-col items-center justify-center gap-1"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(0,18,24,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(6,182,212,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 16px rgba(245,158,11,0.15)'
                                                    : '0 0 16px rgba(6,182,212,0.15)',
                                            }}
                                        >
                                            {/* Bracket corners */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <Plus size={20} strokeWidth={2} className={`${theme.highlightText} drop-shadow-[0_0_8px_currentColor]`} />
                                            <span className={`font-mono text-[6px] tracking-[0.15em] ${theme.highlightText} opacity-70 uppercase`}>GATE</span>
                                        </motion.button>

                                        {/* ── CLOSE / COLLAPSE ── */}
                                        <motion.button
                                            onClick={() => setIsMobileHudExpanded(false)}
                                            whileTap={{ scale: 0.94 }}
                                            className="relative w-16 h-16 overflow-hidden backdrop-blur-md flex flex-col items-center justify-center gap-1"
                                            style={{
                                                background: 'rgba(10,2,2,0.88)',
                                                border: '1px solid rgba(239,68,68,0.45)',
                                                boxShadow: '0 0 16px rgba(239,68,68,0.12)',
                                            }}
                                        >
                                            {/* Bracket corners — red tint */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="1.5" /></svg>
                                            <X size={20} strokeWidth={2} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                            <span className="font-mono text-[6px] tracking-[0.15em] text-red-500/70 uppercase">CLOSE</span>
                                        </motion.button>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </AnimatePresence>
                )}

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
