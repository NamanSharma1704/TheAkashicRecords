import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Theme, Quest } from '../../core/types';
import TowerHUD from './TowerHUD';
import TowerStructure from './TowerStructure';
import QuestCard from '../quest/QuestCard';
import SystemLogo from '../system/SystemLogo';
import { getQuestRankObj } from '../../utils/ranks';
import { ChevronLeft, ChevronRight, X, Search, AlertCircle } from 'lucide-react';

interface DivineSpireProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    onActivate: (id: string) => void;
    itemsPerFloor: number;
    playerRank: { name: string; color: string };
    streak: number;
}

const DivineSpire: React.FC<DivineSpireProps> = ({ isOpen, onClose, theme, items, onActivate, itemsPerFloor, playerRank, streak }) => {
    // TOWER SYSTEM STATE
    const [viewMode, setViewMode] = useState<'TOWER' | 'FLOOR'>('TOWER'); // 'TOWER' | 'FLOOR'
    const [selectedFloorIndex, setSelectedFloorIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false); // New state for camera focus
    const [search, setSearch] = useState('');

    const carouselRef = useRef<HTMLDivElement>(null);

    const scrollCarousel = (direction: 'left' | 'right') => {
        if (carouselRef.current) {
            // Adaptive scroll amount based on screen width
            const cardWidth = window.innerWidth < 768 ? 280 : window.innerWidth < 1024 ? 300 : 320;
            const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
            carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    // Handler for focus change from TowerStructure
    const handleFocus = (focused: boolean, index?: number) => {
        setIsFocused(focused);
        if (focused && index !== undefined) {
            setSelectedFloorIndex(index);
        }
    };

    // Calculate floors for data
    const floors = useMemo(() => {
        const _floors: { index: number; items: Quest[]; range: string }[] = [];
        for (let i = 0; i < items.length; i += itemsPerFloor) {
            _floors.push({ index: _floors.length, items: items.slice(i, i + itemsPerFloor), range: `${i + 1}-${Math.min(i + itemsPerFloor, items.length)}` });
        }
        return _floors;
    }, [items, itemsPerFloor]);

    // Handle Floor Selection from Tower
    const handleSelectFloor = (index: number) => {
        // ALLOW any index clicked, don't clamp to existing floors
        // This prevents Sector 8 from showing Floor 1 data if library is small.
        setSelectedFloorIndex(index);
        setViewMode('FLOOR');
    };

    const handleBackToTower = () => {
        setViewMode('TOWER');
        setSearch(''); // Clear search when going back
    };

    // Auto-switch to floor if searching
    useEffect(() => {
        if (search.length > 0 && viewMode === 'TOWER') {
            setViewMode('FLOOR');
        }
    }, [search, viewMode]);

    // KEYBOARD NAVIGATION FOR CAROUSEL
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (viewMode !== 'FLOOR' || search.length > 0) return;
            if (e.key === 'ArrowLeft') scrollCarousel('left');
            if (e.key === 'ArrowRight') scrollCarousel('right');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, search]);

    const handleWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            // Natural horizontal scroll (trackpad)
            return;
        }
        if (Math.abs(e.deltaY) > 5) {
            scrollCarousel(e.deltaY > 0 ? 'right' : 'left');
        }
    };

    // Filtered items memoization 
    const filteredItems = useMemo(() => {
        if (!search) return [];
        return items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    }, [search, items]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[60] bg-transparent animate-in fade-in zoom-in-95 duration-500 flex flex-col transition-colors duration-700`}>
            {/* AMBIENT BACKGROUND GLOW (Root-level to cover header) */}
            {viewMode === 'FLOOR' && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className={`absolute -top-[20%] -right-[20%] w-[60%] h-[60%] ${theme.id === 'LIGHT' ? 'bg-sky-500/10' : `bg-${theme.primary}-500/10`} rounded-full blur-[150px] z-10 mix-blend-screen transition-colors duration-700`} />
                    <div className={`absolute -bottom-[20%] -left-[20%] w-[60%] h-[60%] ${theme.id === 'LIGHT' ? 'bg-cyan-500/10' : `bg-${theme.accent}-500/10`} rounded-full blur-[150px] z-10 mix-blend-screen transition-colors duration-700`} />
                </div>
            )}

            {/* TOWER BACKGROUND LAYER (FULLSCREEN) */}
            {viewMode === 'TOWER' && (
                <div className="absolute inset-0 z-0 animate-in fade-in duration-700">
                    <TowerHUD items={items} theme={theme} onActivate={onActivate} isFocused={isFocused} selectedFloorIndex={selectedFloorIndex} itemsPerFloor={itemsPerFloor} streak={streak} />
                    <TowerStructure theme={theme} onSelectFloor={handleSelectFloor} onFocus={handleFocus} items={items} itemsPerFloor={itemsPerFloor} isPaused={false} />
                </div>
            )}

            <div className="relative z-50 w-full h-16 md:h-20 flex items-center shrink-0">
                {/* Header: Title & Info */}
                <div className="w-full mx-auto px-6 md:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-default">
                        <div className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0">
                            {/* Decorative scanner line for logo */}
                            <div className={`absolute inset-x-0 h-[1px] ${theme.id === 'LIGHT' ? 'bg-sky-400' : 'bg-amber-400'} opacity-20 animate-[scanning_4s_linear_infinite] z-20`} />
                            <SystemLogo theme={theme} className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.2)]" />
                        </div>
                        <div className="flex flex-col leading-none border-l border-white/10 pl-3">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`font-mono text-[8px] md:text-[9px] tracking-[0.4em] ${theme.headingText} opacity-60 transition-colors duration-700 uppercase`}>
                                    SYSTEM.ACCESS // {playerRank.name}
                                </span>
                            </div>
                            <span className={`font-orbitron text-sm md:text-base tracking-[0.2em] font-black italic drop-shadow-sm transition-colors duration-700 text-transparent bg-clip-text bg-gradient-to-r ${theme.id === 'LIGHT' ? "from-sky-400 via-cyan-500 to-sky-400" : "from-amber-400 via-yellow-200 to-amber-500"} animate-gradient-x`}>
                                THE DIVINE SPIRE
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={viewMode === 'FLOOR' ? handleBackToTower : onClose}
                            className={`group relative p-1.5 md:p-2 ${theme.mutedText} hover:${theme.baseText} transition-all duration-300 rounded-md border border-transparent hover:border-white/10 hover:bg-white/5`}
                        >
                            <X size={22} className="relative z-10 transition-transform duration-500 group-hover:rotate-90" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className={`relative z-10 flex-1 overflow-hidden flex flex-col ${viewMode === 'TOWER' ? 'pointer-events-none' : ''}`}>

                {/* VIEW MODE: FLOOR (CINEMATIC CAROUSEL) */}
                {viewMode === 'FLOOR' && (
                    <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-10 duration-500 pointer-events-auto">



                        {/* Search Bar HUD */}
                        <div className="relative z-20 shrink-0 w-full max-w-xl mx-auto mt-2 md:mt-4 px-4">
                            <div className="relative group">
                                <div className={`absolute -inset-1 bg-gradient-to-r ${theme.gradient} opacity-20 blur-md group-focus-within:opacity-40 transition-all duration-500 rounded-full`} />
                                <div className={`relative ${theme.isDark ? 'bg-black/60' : 'bg-white/60'} backdrop-blur-xl border border-white/10 rounded-full px-4 py-3 flex items-center shadow-2xl transition-all duration-700`}>
                                    <Search size={20} className={`${theme.highlightText} mr-3 opacity-70`} />
                                    <input
                                        type="text"
                                        placeholder="SEARCH ARCHIVES..."
                                        className={`w-full bg-transparent text-sm md:text-base font-mono ${theme.baseText} placeholder:${theme.mutedText} placeholder:opacity-50 outline-none uppercase tracking-widest transition-colors duration-700`}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} className={`${theme.mutedText} hover:${theme.highlightText} ml-2`}><X size={16} /></button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="shrink-0 flex flex-col relative w-full z-10 group/carousel">

                            {/* HUD HEADER: Floor / Sector info (Hidden when searching) */}
                            {!search && floors.length > 0 && floors[selectedFloorIndex] && (
                                <div className="z-[60] flex flex-col items-center drop-shadow-2xl mt-0 md:mt-1 mb-1">
                                    <div className={`font-mono text-[9px] md:text-[10px] tracking-[0.4em] ${theme.highlightText} font-bold uppercase mb-1 opacity-80 pointer-events-none`}>SYSTEM.SECTOR_INTERFACE</div>
                                    <div className="flex items-center gap-4 px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md pointer-events-auto">
                                        <button disabled={selectedFloorIndex <= 0} onClick={() => setSelectedFloorIndex(i => i - 1)} className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronLeft size={14} className="md:w-4 md:h-4" /></button>
                                        <span className={`font-black text-xl md:text-2xl font-orbitron tracking-widest ${theme.headingText}`}>LAYER {selectedFloorIndex + 1}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                        <span className={`font-mono text-[10px] md:text-xs ${theme.mutedText} tracking-widest`}>SECTOR {floors[selectedFloorIndex].range}</span>
                                        <button disabled={selectedFloorIndex >= floors.length - 1} onClick={() => setSelectedFloorIndex(i => i + 1)} className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronRight size={14} className="md:w-4 md:h-4" /></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Carousel Area */}
                        <div className="relative flex-1 w-full min-h-0">
                            {/* FLOATING NAVIGATION CONTROLS */}
                            {!search && (
                                <>
                                    <button
                                        onClick={() => scrollCarousel('left')}
                                        className={`absolute left-2 md:left-12 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 md:group-hover/carousel:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex`}
                                    >
                                        <ChevronLeft size={32} className={theme.highlightText} />
                                    </button>
                                    <button
                                        onClick={() => scrollCarousel('right')}
                                        className={`absolute right-2 md:right-12 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 md:group-hover/carousel:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex`}
                                    >
                                        <ChevronRight size={32} className={theme.highlightText} />
                                    </button>
                                </>
                            )}

                            {/* THE CAROUSEL */}
                            {search.length > 0 ? (
                                <div ref={carouselRef} onWheel={handleWheel} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-3 sm:px-6 md:px-12 pt-12 md:pt-14 pb-24 md:pb-12 gap-6 md:gap-10">
                                    {filteredItems.length === 0 ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            <AlertCircle size={48} className={`${theme.mutedText} mb-4 opacity-50`} />
                                            <p className={`font-mono text-sm tracking-widest ${theme.mutedText}`}>NO RECORDS DETECTED</p>
                                        </div>
                                    ) : (
                                        filteredItems.map((item, index) => {
                                            const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                            return (
                                                <div key={item.id} className="w-[240px] md:w-[280px] lg:w-[320px] shrink-0 snap-center transition-all duration-700 hover:-translate-y-8 hover:scale-105 group relative mt-2 md:mt-4">
                                                    {/* Floor Reflection Glow */}
                                                    <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-t from-${theme.primary}-500/40 to-transparent blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                                                    {/* Backdrop Ambient Lighting */}
                                                    <div className={`absolute -inset-8 bg-${theme.primary}-500/10 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

                                                    <QuestCard id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            ) : (
                                floors.length > 0 && floors[selectedFloorIndex] ? (
                                    <div ref={carouselRef} onWheel={handleWheel} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-3 sm:px-6 md:px-12 pt-14 md:pt-16 pb-12 gap-8 md:gap-10">
                                        {floors[selectedFloorIndex].items.map((item, index) => {
                                            const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                            return (
                                                <div key={item.id} className="w-[260px] xs:w-[280px] sm:w-[300px] md:w-[320px] lg:w-[360px] shrink-0 snap-center transition-all duration-700 hover:-translate-y-8 hover:scale-[1.03] group relative mt-2 md:mt-4">
                                                    {/* Floor Reflection Glow */}
                                                    <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-t ${theme.id === 'LIGHT' ? 'from-sky-500/40' : 'from-amber-500/40'} to-transparent blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700`} />
                                                    {/* Backdrop Ambient Lighting */}
                                                    <div className={`absolute -inset-8 ${theme.id === 'LIGHT' ? 'bg-sky-500/10' : 'bg-amber-500/10'} blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none`} />

                                                    <div className="relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)] transition-shadow duration-700 rounded-lg overflow-hidden border border-white/5 group-hover:border-white/20">
                                                        <QuestCard id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={`w-full h-full flex flex-col items-center justify-center ${theme.mutedText}`}>
                                        <AlertCircle size={48} className="mb-4 opacity-50" />
                                        <p className="font-mono text-sm tracking-widest">LAYER EMPTY / LOCKED</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DivineSpire;
