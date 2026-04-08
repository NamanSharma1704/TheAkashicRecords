import React, { useState, useEffect, useRef, useCallback, UIEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Settings, Loader2, RefreshCcw, AlertTriangle, Monitor, Activity, ArrowRight, ArrowLeft, Maximize, Minimize, ListOrdered } from 'lucide-react';
import { getProxiedImageUrl } from '../../utils/api';
import { systemFetch } from '../../utils/auth';
import { Theme, Quest } from '../../core/types';
import GlitchOverlay from '../fx/GlitchOverlay';
import ScrambleText from '../system/ScrambleText';

interface SystemReaderProps {
    isOpen: boolean;
    onClose: () => void;
    quest: Quest | null;
    theme: Theme;
    onUpdate?: (id: string, updates: Partial<Quest>) => Promise<void>;
}

const SystemReader: React.FC<SystemReaderProps> = ({ isOpen, onClose, quest, theme, onUpdate }) => {
    const [providersAvailable, setProvidersAvailable] = useState<string[]>([]);
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [activeManga, setActiveManga] = useState<any>(null);
    const [chapters, setChapters] = useState<any[]>([]);
    const [activeChapter, setActiveChapter] = useState<any>(null);
    const [pages, setPages] = useState<string[]>([]);
    const [retryToken, setRetryToken] = useState(0);
    const [loadStartTime, setLoadStartTime] = useState(0);

    const [loadingState, setLoadingState] = useState<'IDLE' | 'SEARCHING' | 'CHAPTERS' | 'PAGES'>('IDLE');
    const [error, setError] = useState('');
    const [isFallback, setIsFallback] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [showControls, setShowControls] = useState(true);
    
    // NEW SYSTEM OPTIONS
    const [fitMode, setFitMode] = useState<'CONTENT' | 'WIDTH'>('CONTENT');
    const [scrollProgress, setScrollProgress] = useState(0);

    const providersTried = useRef<Set<string>>(new Set());
    const targetChapterRef = useRef<number>((quest?.currentChapter && quest.currentChapter > 0) ? quest.currentChapter : 1);

    useEffect(() => {
        if (quest?.currentChapter) targetChapterRef.current = quest.currentChapter > 0 ? quest.currentChapter : 1;
    }, [quest?.id]);

    useEffect(() => {
        if (activeChapter?.number) targetChapterRef.current = activeChapter.number;
    }, [activeChapter]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const searchDataCache = useRef<any>(null);

    // --- LOGIC: Try Next Provider ---
    const tryNextProvider = useCallback(async () => {
        if (isRetrying) return false;

        // Manual fallback

        const remaining = providersAvailable.filter(p => !providersTried.current.has(p));
        if (remaining.length > 0) {
            const next = remaining[0];
            console.warn(`[Reader] Fallback Protocol => ${next}`);

            providersTried.current.add(next);
            setIsFallback(true);
            setLoadStartTime(Date.now());

            if (searchDataCache.current && searchDataCache.current[next]) {
                const results = searchDataCache.current[next];
                setActiveManga(results[0]);
            } else {
                setActiveManga(null);
            }

            setActiveProvider(next);
            return true;
        }
        return false;
    }, [providersAvailable, isRetrying, loadStartTime, isFallback, activeProvider]);

    // Fetch All Providers globally once on mount
    useEffect(() => {
        if (!isOpen) return;
        systemFetch('/api/reader/providers')
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setProvidersAvailable(json.data.map((p: any) => p.name));
                }
            })
            .catch(() => { });
    }, [isOpen]);

    // Initial Initialization Workflow
    useEffect(() => {
        if (!isOpen || !quest || providersAvailable.length === 0) return;

        const initReader = async () => {
            setLoadingState('SEARCHING');
            setLoadStartTime(Date.now());
            setError('');
            providersTried.current.clear();
            setIsFallback(false);
            setIsRetrying(false);
            searchDataCache.current = null;

            try {
                // 1. Try Direct Link Resolution
                if (quest.link && quest.link !== '#') {
                    const res = await systemFetch(`/api/reader/resolve?url=${encodeURIComponent(quest.link)}`);
                    if (res.ok) {
                        const json = await res.json();
                        setActiveProvider(json.provider);
                        setActiveManga(json);
                        providersTried.current.add(json.provider);
                        return;
                    }
                }

                // 2. Default provider Search
                const targetProvider = providersAvailable.includes('AsuraScans') ? 'AsuraScans' : providersAvailable[0];
                const res = await systemFetch(`/api/reader/search?q=${encodeURIComponent(quest.title)}&provider=${targetProvider}`);
                const json = await res.json();

                if (json.success) {
                    if (!searchDataCache.current) searchDataCache.current = {};
                    searchDataCache.current[targetProvider] = json.data.results[targetProvider];

                    const results = json.data.results[targetProvider];
                    if (results && results.length > 0) {
                        setActiveProvider(targetProvider);
                        setActiveManga(results[0]);
                        providersTried.current.add(targetProvider);
                    } else {
                        throw new Error("PROVIDER_MAPPING_FAILURE");
                    }
                } else {
                    setError('NO_PROVIDERS_FOUND');
                }
            } catch (err: any) {
                setError(err.message || 'SYSTEM_FAILURE');
            } finally {
                setLoadingState('IDLE');
            }
        };

        // Reset state only on new quest
        setActiveProvider('');
        setActiveManga(null);
        setChapters([]);
        setPages([]);
        setRetryToken(0);
        setActiveChapter(null);

        initReader();
    }, [isOpen, quest, providersAvailable.length]);

    // Fetch Chapters when Manga changes
    useEffect(() => {
        if (!activeProvider || !quest) return;

        setPages([]);
        setActiveChapter(null);
        setChapters([]);
        setLoadingState('CHAPTERS');

        const fetchChapters = async () => {
            setLoadingState('CHAPTERS');
            setError('');
            let currentManga = activeManga;

            try {
                // Resolve Manga if we don't have it
                if (!currentManga) {
                    const searchRes = await systemFetch(`/api/reader/search?q=${encodeURIComponent(quest.title)}&provider=${activeProvider}`);
                    const searchJson = await searchRes.json();
                    const results = searchJson.data.results[activeProvider];
                    if (!results || results.length === 0) throw new Error("PROVIDER_MAPPING_LOST");
                    currentManga = results[0];
                    setActiveManga(currentManga);
                }

                const detailsRes = await systemFetch(`/api/reader/manga/details?url=${encodeURIComponent(currentManga.url)}&provider=${activeProvider}`);
                const detailsJson = await detailsRes.json();

                if (detailsJson.success) {
                    const chaps = detailsJson.details.chapters;
                    setChapters(chaps);
                    setIsRetrying(false);

                    const targetNum = targetChapterRef.current;
                    const match = chaps.find((c: any) => c.number === targetNum) || chaps[chaps.length - 1];
                    if (match) setActiveChapter(match);
                } else {
                    throw new Error("CHAPTER_EXTRACTION_FAILED");
                }
            } catch (err: any) {
                console.warn(`[Reader] ${activeProvider} retry triggered.`);

                const retryKey = `${activeProvider}_RETRY`;
                if (!providersTried.current.has(retryKey)) {
                    providersTried.current.add(retryKey);
                    setIsRetrying(true);
                    try {
                        const sRes = await systemFetch(`/api/reader/search?q=${encodeURIComponent(quest.title)}&provider=${activeProvider}`);
                        const sJson = await sRes.json();
                        const results = sJson.data.results[activeProvider];
                        if (results && results.length > 0) {
                            setActiveManga(results[0]);
                            setRetryToken(prev => prev + 1);
                            return;
                        }
                    } catch (e) { }
                    setIsRetrying(false);
                }

                if (!isRetrying) {
                    const canRetry = await tryNextProvider();
                    if (!canRetry) setError(err.message);
                }
            } finally {
                if (!isRetrying) setLoadingState('IDLE');
            }
        };

        fetchChapters();
    }, [activeProvider, activeManga, quest, tryNextProvider, retryToken]);

    // Fetch Pages when Chapter changes
    useEffect(() => {
        if (!activeChapter || !activeProvider) return;

        let isMounted = true;
        let timeoutId: any = null;

        const fetchPages = async () => {
            setLoadingState('PAGES');
            setError('');
            setPages([]);

            timeoutId = setTimeout(async () => {
                if (isMounted && loadingState === 'PAGES') {
                    console.warn(`[Reader] Timeout (8s).`);
                    const canRetry = await tryNextProvider();
                    if (!canRetry) {
                        setError("ARCHIVE_ACCESS_TIMEOUT");
                        setLoadingState('IDLE');
                    }
                }
            }, 8000);

            try {
                const res = await systemFetch(`/api/reader/chapter/pages?url=${encodeURIComponent(activeChapter.url)}&provider=${activeProvider}`);
                const json = await res.json();

                if (timeoutId) clearTimeout(timeoutId);
                if (!isMounted) return;

                if (json.success && json.pages.length > 0) {
                    setPages(json.pages);
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
                    }
                } else {
                    throw new Error("EMPTY_ARCHIVE_DATA");
                }
            } catch (err: any) {
                if (timeoutId) clearTimeout(timeoutId);
                if (!isMounted) return;

                const canRetry = await tryNextProvider();
                if (!canRetry) setError(err.message);
            } finally {
                if (isMounted && !isRetrying) setLoadingState('IDLE');
            }
        };

        fetchPages();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [activeChapter, activeProvider, tryNextProvider, isRetrying]);


    // Intersection Observer for Progress Sync
    useEffect(() => {
        if (!bottomRef.current || pages.length === 0 || !quest || !activeChapter) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (onUpdate && quest.currentChapter < activeChapter.number) {
                    onUpdate(quest.id, { currentChapter: activeChapter.number });
                }
            }
        }, { threshold: 0.1, root: scrollContainerRef.current });

        observer.observe(bottomRef.current);
        return () => observer.disconnect();
    }, [pages, activeChapter, quest, onUpdate]);

    useEffect(() => {
        if (error || loadingState !== 'IDLE') {
            setShowControls(true);
        } else if (pages.length > 0) {
            setShowControls(false); // Hide menus when reading starts
        }
    }, [error, loadingState, pages]);

    const handleNextChapter = () => {
        if (!chapters.length || !activeChapter) return;
        const idx = chapters.findIndex(c => c.id === activeChapter.id);
        if (idx > 0) setActiveChapter(chapters[idx - 1]);
    };

    const handlePrevChapter = () => {
        if (!chapters.length || !activeChapter) return;
        const idx = chapters.findIndex(c => c.id === activeChapter.id);
        if (idx < chapters.length - 1) setActiveChapter(chapters[idx + 1]);
    };

    const handleJumpToChapter = (chapterId: string) => {
        const match = chapters.find(c => c.id === chapterId);
        if (match) setActiveChapter(match);
    };

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const scrolled = target.scrollTop;
        const maxScroll = target.scrollHeight - target.clientHeight;
        if (maxScroll > 0) {
            setScrollProgress((scrolled / maxScroll) * 100);
        }
    };

    if (!isOpen || !quest) return null;

    const isLight = theme.id === 'LIGHT';

    const renderLoadingState = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden"
        >
            <GlitchOverlay isActive={true} />
            <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${isLight ? 'from-cyan-900/20' : 'from-amber-900/20'} via-black to-black opacity-80`} />

            <div className={`relative z-10 flex flex-col items-center gap-8 bg-black/40 p-12 border ${isLight ? 'border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)]' : 'border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)]'} rounded-lg backdrop-blur-md`}>
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className={`absolute inset-0 border-t-2 border-b-2 ${isLight ? 'border-cyan-400' : 'border-amber-500'} rounded-full`}
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className={`absolute inset-2 border-l-2 border-r-2 ${isLight ? 'border-cyan-500/70' : 'border-amber-600/70'} rounded-full`}
                    />
                    <Activity className={`w-8 h-8 ${isLight ? 'text-cyan-400' : 'text-amber-500'}`} />
                </div>

                <div className="text-center space-y-3">
                    <h3 className={`text-xl font-mono tracking-[0.2em] uppercase drop-shadow-md ${isLight ? 'text-cyan-400 shadow-cyan-400/50' : 'text-amber-500 shadow-amber-500/50'}`}>
                        <ScrambleText text={
                            loadingState === 'SEARCHING' ? 'SEARCHING AKASHIC RECORDS' :
                                loadingState === 'CHAPTERS' ? 'SYNCHRONIZING TIMELINE' :
                                    'DECODING VISUAL ASSETS'
                        } />
                    </h3>
                    <p className={`text-sm font-mono flex items-center justify-center gap-2 ${isLight ? 'text-cyan-400/60' : 'text-amber-500/60'}`}>
                        <Monitor className="w-4 h-4" />
                        Provider: {activeProvider || 'NEURAL_LINK_PENDING'}
                    </p>
                    {isFallback && (
                        <p className={`text-xs font-mono mt-2 ${isLight ? 'text-cyan-500/80' : 'text-amber-500/80'}`}>
                            REROUTING ARCHIVE CONNECTION...
                        </p>
                    )}
                </div>

                <div className="w-64 h-1 bg-gray-900 rounded-full overflow-hidden relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${isLight ? 'from-cyan-500/0 via-cyan-400 to-cyan-500/0' : 'from-amber-500/0 via-amber-500 to-amber-500/0'}`}
                    />
                </div>
            </div>
        </motion.div>
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white font-sans"
            >
                {/* TOP BAR */}
                <AnimatePresence>
                    {showControls && (
                        <motion.div
                            initial={{ opacity: 0, y: -64 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -64 }}
                            className={`absolute top-0 left-0 w-full h-16 bg-black/80 border-b ${isLight ? 'border-cyan-500/20 shadow-[0_4px_30px_rgba(6,182,212,0.1)]' : 'border-amber-500/20 shadow-[0_4px_30px_rgba(245,158,11,0.1)]'} flex items-center justify-between px-6 z-50 backdrop-blur-md`}
                        >
                            {/* PROGRESS BAR OVERLAY */}
                            <div 
                                className={`absolute bottom-0 left-0 h-[2px] transition-all duration-75 ${isLight ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`}
                                style={{ width: `${scrollProgress}%` }}
                            />

                            <div className="flex items-center gap-4">
                                <div className={`w-1 h-8 ${theme.id === 'LIGHT' ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,1)]' : 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,1)]'} rounded-full`} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-mono tracking-widest uppercase ${isLight ? 'text-cyan-400/70' : 'text-amber-500/70'}`}>SYSTEM.DIVE_PROTOCOL</span>
                                        {isFallback && (
                                            <span className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border animate-pulse ${isLight ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}`}>
                                                <RefreshCcw size={8} /> FALLBACK_ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold tracking-wider truncate max-w-[200px] md:max-w-md">
                                        {quest.title} {activeChapter ? `- Ch. ${activeChapter.number}` : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Fit Mode Toggle */}
                                <button 
                                    title="Toggle Fit Mode"
                                    onClick={() => setFitMode(prev => prev === 'CONTENT' ? 'WIDTH' : 'CONTENT')}
                                    className={`hidden md:flex p-2 border border-white/5 hover:border-white/30 rounded transition-colors ${isLight ? 'hover:bg-cyan-500/10' : 'hover:bg-amber-500/10'}`}
                                >
                                    {fitMode === 'CONTENT' ? <Maximize size={16} className="opacity-70" /> : <Minimize size={16} className="opacity-70" />}
                                </button>

                                {/* Chapter Selector */}
                                {chapters.length > 0 && activeChapter && (
                                    <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded px-3 py-1 cursor-pointer hover:bg-white/10 transition-colors">
                                        <ListOrdered size={14} className="opacity-50" />
                                        <select
                                            title="Chapter Selection"
                                            className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                                            value={activeChapter.id}
                                            onChange={(e) => handleJumpToChapter(e.target.value)}
                                        >
                                            {chapters.map(c => <option key={c.id} value={c.id} className="bg-gray-900">Chapter {c.number}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Provider Selector */}
                                {providersAvailable.length > 0 && (
                                    <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1">
                                        <span className="text-[8px] font-mono text-white/40">SOURCE:</span>
                                        <select
                                            title="Source Provider"
                                            className="bg-transparent text-white text-[10px] uppercase font-mono focus:outline-none cursor-pointer"
                                            value={activeProvider}
                                            onChange={(e) => {
                                                providersTried.current.clear();
                                                providersTried.current.add(e.target.value);
                                                setActiveProvider(e.target.value);
                                                setActiveManga(null);
                                            }}
                                        >
                                            {providersAvailable.map(p => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
                                        </select>
                                    </div>
                                )}

                                <button title="Close reader" onClick={onClose} className="p-2 border border-white/10 hover:border-white/50 hover:bg-white/10 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* MAIN CONTENT AREA */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="w-full h-full overflow-y-auto overflow-x-hidden pt-16 pb-24 flex flex-col items-center hide-scrollbar relative [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
                >
                    {/* ERROR STATE */}
                    {error && (
                        <div className="mt-40 relative p-10 border border-red-500/30 bg-red-950/20 text-red-400 font-mono text-center flex flex-col items-center gap-6 max-w-lg backdrop-blur-md shadow-[0_0_40px_rgba(239,68,68,0.15)] overflow-hidden rounded-lg">
                            <GlitchOverlay isActive={true} />
                            <AlertTriangle size={64} className="text-red-500 animate-pulse relative z-10" />
                            <div className="space-y-2 relative z-10">
                                <div className="text-xl font-bold tracking-widest uppercase whitespace-nowrap text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                                    <ScrambleText text="PROTOCOL_FAILURE" />
                                </div>
                                <div className="text-xs opacity-80 tracking-[0.2em] text-red-300">[{error}]</div>
                                <div className="text-[10px] uppercase tracking-widest text-red-500/60 mt-2">Connection Severed. Akashic Record Unreachable.</div>
                            </div>
                            <div className="flex gap-4 w-full mt-4 relative z-10 justify-center">
                                <button onClick={tryNextProvider} disabled={isRetrying || providersAvailable.length === 0} className="px-6 py-2 border border-red-500/50 hover:bg-red-500/20 text-red-200 uppercase text-xs tracking-widest transition-all cursor-pointer">Initiate Fallback</button>
                                <button onClick={onClose} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-white uppercase text-xs tracking-widest transition-all cursor-pointer">Abort Dive</button>
                            </div>
                        </div>
                    )}

                    {loadingState !== 'IDLE' && !error && (
                        <div className="absolute inset-0 z-40 bg-black/95">
                            {renderLoadingState()}
                        </div>
                    )}

                    {!error && loadingState === 'IDLE' && pages.length > 0 && (
                        <div 
                            onClick={() => setShowControls(prev => !prev)}
                            className={`flex flex-col relative transition-all duration-500 ease-out 
                                ${fitMode === 'WIDTH' ? 'w-[100vw] px-0' : 'w-full max-w-3xl px-2 sm:px-4'}`}
                        >
                            {pages.map((imgUrl, i) => (
                                <img
                                    key={i}
                                    src={`/api/proxy/image?url=${encodeURIComponent(imgUrl)}&referer=${encodeURIComponent(
                                        activeProvider === 'MangaBuddy' ? 'https://mangabuddy.com/' :
                                            activeProvider === 'AsuraScans' ? 'https://asurascans.com/' :
                                                activeProvider === 'MgEko' ? 'https://www.mgeko.cc/' :
                                                    ''
                                    )}`}
                                    alt={`Page ${i + 1}`}
                                    loading="lazy"
                                    className={`h-auto block min-h-[300px] object-cover bg-black/40 
                                        ${fitMode === 'WIDTH' ? 'w-full' : 'w-full rounded-sm mb-1 sm:mb-2 shadow-lg object-contain'}`}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjMwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNTU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JTUFHRV9DT1JSVVBURUQ8L3RleHQ+PC9zdmc+';
                                    }}
                                />
                            ))}
                            <div ref={bottomRef} className={`h-80 w-full flex flex-col items-center justify-center border-t mt-4 mb-20 bg-gradient-to-t to-transparent gap-8 relative overflow-hidden ${isLight ? 'border-cyan-500/20 from-cyan-900/10' : 'border-amber-500/20 from-amber-900/10'}`}>
                                <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] via-transparent to-transparent opacity-50 ${isLight ? 'from-cyan-600/10' : 'from-amber-600/10'}`} />
                                <div className={`text-[12px] font-mono tracking-[0.4em] uppercase italic z-10 ${isLight ? 'text-cyan-400/80 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-amber-400/80 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`}>SYSTEM DIAGNOSTIC</div>
                                <div className={`text-[10px] font-mono tracking-widest uppercase z-10 ${isLight ? 'text-cyan-300/50' : 'text-amber-300/50'}`}>[ Chapter {activeChapter.number} Decoded & Synchronized ]</div>
                                {chapters.findIndex(c => c.id === activeChapter.id) > 0 && (
                                    <button
                                        onClick={handleNextChapter}
                                        className={`mt-4 px-12 py-4 rounded-full border shadow-2xl font-mono tracking-[0.3em] uppercase text-xs transition-all transform hover:scale-105 active:scale-95 z-10 flex items-center gap-4 group ${isLight ? 'bg-cyan-950/60 text-cyan-300 border-cyan-400/50 hover:bg-cyan-900/80 hover:text-cyan-100 shadow-cyan-500/30' : 'bg-amber-950/60 text-amber-300 border-amber-400/50 hover:bg-amber-900/80 hover:text-amber-100 shadow-amber-500/30'}`}
                                    >
                                        Initiate Next Phase
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* BOTTOM NAVIGATION HUD */}
                <AnimatePresence>
                    {showControls && !error && activeChapter && (
                        <motion.div
                            initial={{ opacity: 0, y: 96 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 96 }}
                            className={`absolute bottom-6 flex items-center justify-between w-full max-w-sm px-6 py-3 rounded-md bg-black/90 border backdrop-blur-xl z-50 ${isLight ? 'border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)]' : 'border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]'}`}
                        >

                            <div className={`absolute top-0 left-[10%] w-[80%] h-[1px] bg-gradient-to-r ${isLight ? 'from-transparent via-cyan-400/50 to-transparent' : 'from-transparent via-amber-400/50 to-transparent'}`} />
                            <div className={`absolute bottom-0 left-[20%] w-[60%] h-[1px] bg-gradient-to-r ${isLight ? 'from-transparent via-cyan-500/30 to-transparent' : 'from-transparent via-amber-500/30 to-transparent'}`} />

                            <button
                                title="Previous Chapter"
                                onClick={handlePrevChapter}
                                disabled={loadingState !== 'IDLE' || chapters.findIndex(c => c.id === activeChapter.id) === chapters.length - 1}
                                className={`p-3 rounded-full transition-all hover:scale-110 active:scale-90 relative group disabled:opacity-20 disabled:scale-100 ${isLight ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40'}`}
                            >
                                <div className={`absolute inset-0 rounded-full transition-shadow duration-300 blur-md ${isLight ? 'shadow-[0_0_0px_rgba(6,182,212,0)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'shadow-[0_0_0px_rgba(245,158,11,0)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]'}`} />
                                <ArrowLeft size={24} className="relative z-10 group-hover:-translate-x-0.5 transition-transform" />
                            </button>

                            <div className="flex flex-col items-center min-w-[140px] relative z-10">
                                <span className={`text-[9px] font-mono tracking-[0.4em] uppercase mb-1.5 ${isLight ? 'text-cyan-400/60' : 'text-amber-400/60'}`}>SYSTEM SYNC</span>
                                <div className={`text-base font-black tracking-[0.25em] uppercase font-mono ${isLight ? 'text-cyan-50 drop-shadow-[0_0_12px_rgba(6,182,212,0.9)]' : 'text-amber-50 drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]'}`}>
                                    CH. {activeChapter.number}
                                </div>
                            </div>

                            <button
                                title="Next Chapter"
                                onClick={handleNextChapter}
                                disabled={loadingState !== 'IDLE' || chapters.findIndex(c => c.id === activeChapter.id) === 0}
                                className={`p-3 rounded-full transition-all hover:scale-110 active:scale-90 relative group disabled:opacity-20 disabled:scale-100 ${isLight ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40'}`}
                            >
                                <div className={`absolute inset-0 rounded-full transition-shadow duration-300 blur-md ${isLight ? 'shadow-[0_0_0px_rgba(6,182,212,0)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'shadow-[0_0_0px_rgba(245,158,11,0)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]'}`} />
                                <ArrowRight size={24} className="relative z-10 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div >
        </AnimatePresence >
    );
};

export default SystemReader;

