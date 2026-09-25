import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Theme, Quest } from '../../core/types';
import { elevation } from '../../core/depth';
import TowerHUD from './TowerHUD';
import TowerStructure, { TOWER_FLOORS } from './TowerStructure';
import QuestCard from '../quest/QuestCard';
import SystemLogo from '../system/SystemLogo';
import { getQuestRankObj } from '../../utils/ranks';
import { ChevronLeft, ChevronRight, X, Search, AlertCircle, ChevronDown, Filter } from 'lucide-react';
import { useDialogFocus } from '../../utils/useDialogFocus';

interface DivineSpireProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    onActivate: (id: string) => void;
    itemsPerFloor: number;
    playerRank: { name: string; color: string };
    streak: number;
    dailyAbsorbed: number;
}

const DivineSpire: React.FC<DivineSpireProps> = ({ isOpen, onClose, theme, items, onActivate, itemsPerFloor, playerRank, streak, dailyAbsorbed }) => {
    // TOWER SYSTEM STATE
    const [viewMode, setViewMode] = useState<'TOWER' | 'FLOOR'>('TOWER'); // 'TOWER' | 'FLOOR'
    const [selectedFloorIndex, setSelectedFloorIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false); // New state for camera focus
    const [search, setSearch] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterClass, setFilterClass] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    const availableClasses = useMemo(() => Array.from(new Set(items.map(i => i.classType))).sort(), [items]);
    const availableStatuses = useMemo(() => Array.from(new Set(items.map(i => i.status))).sort(), [items]);

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

    // Active Library before chunking into floors
    const activeLibrary = useMemo(() => {
        return items.filter(item => {
            if (filterClass !== "ALL" && item.classType !== filterClass) return false;
            if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
            return true;
        });
    }, [items, filterClass, filterStatus]);

    // Calculate floors for data
    const floors = useMemo(() => {
        const _floors: { index: number; items: Quest[]; range: string }[] = [];
        for (let i = 0; i < activeLibrary.length; i += itemsPerFloor) {
            _floors.push({ index: _floors.length, items: activeLibrary.slice(i, i + itemsPerFloor), range: `${i + 1}-${Math.min(i + itemsPerFloor, activeLibrary.length)}` });
        }
        return _floors;
    }, [activeLibrary, itemsPerFloor]);

    // Fallback to ensure selected floor is valid if list shrinks
    useEffect(() => {
        if (floors.length > 0 && selectedFloorIndex >= floors.length) {
            setSelectedFloorIndex(floors.length - 1);
        }
    }, [floors.length, selectedFloorIndex]);

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

    // Keyboard: Escape steps back one level — out of the filter menu, then from a floor to
    // the tower, then out of the Spire — matching what the close button does in each mode.
    const spireRef = useRef<HTMLDivElement>(null);
    useDialogFocus(spireRef, isOpen, () => {
        if (isFilterOpen) setIsFilterOpen(false);
        else if (viewMode === 'FLOOR') handleBackToTower();
        else onClose();
    });

    if (!isOpen) return null;

    return (
        <div
            ref={spireRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="divine-spire-title"
            tabIndex={-1}
            className={`fixed inset-0 z-[60] bg-transparent animate-in fade-in zoom-in-95 duration-500 flex flex-col transition-colors duration-700 outline-none`}
            style={{ '--elev-1': elevation(theme, 1) } as React.CSSProperties}
        >
            {/* AMBIENT BACKGROUND GLOW (Root-level to cover header) */}
            {viewMode === 'FLOOR' && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className={`absolute -top-[20%] -right-[20%] w-[60%] h-[60%] ${theme.isDark ? 'bg-amber-500/10 mix-blend-screen' : 'bg-sky-500/10 mix-blend-multiply'} rounded-full blur-[150px] z-10 transition-colors duration-700`} />
                    <div className={`absolute -bottom-[20%] -left-[20%] w-[60%] h-[60%] ${theme.isDark ? 'bg-yellow-500/10 mix-blend-screen' : 'bg-cyan-500/10 mix-blend-multiply'} rounded-full blur-[150px] z-10 transition-colors duration-700`} />
                </div>
            )}

            {/* TOWER BACKGROUND LAYER (FULLSCREEN) */}
            {viewMode === 'TOWER' && (
                <div className="absolute inset-0 z-0 animate-in fade-in duration-700">
                    <TowerHUD items={items} theme={theme} onActivate={onActivate} isFocused={isFocused} selectedFloorIndex={selectedFloorIndex} itemsPerFloor={itemsPerFloor} streak={streak} dailyAbsorbed={dailyAbsorbed} />
                    <TowerStructure theme={theme} onSelectFloor={handleSelectFloor} onFocus={handleFocus} items={items} itemsPerFloor={itemsPerFloor} isPaused={false} />
                </div>
            )}

            {/* Keyboard route into the tower. The isles are picked by raycast on a canvas,
                so without this a keyboard user could not enter any layer. Visually hidden
                until something inside it takes focus, then it docks at the foot of the
                screen; pointer users never see it. */}
            {viewMode === 'TOWER' && (
                <nav
                    aria-label="Spire layers"
                    className={`sr-only focus-within:not-sr-only focus-within:fixed focus-within:bottom-6 focus-within:left-1/2 focus-within:-translate-x-1/2 focus-within:z-[70] focus-within:flex focus-within:flex-wrap focus-within:justify-center focus-within:gap-1.5 focus-within:p-2 focus-within:rounded-md focus-within:border focus-within:backdrop-blur-md ${theme.isDark ? 'focus-within:bg-black/85 focus-within:border-white/10' : 'focus-within:bg-white/90 focus-within:border-slate-300'}`}
                >
                    {Array.from({ length: TOWER_FLOORS }, (_, i) => {
                        const first = i * itemsPerFloor + 1;
                        const last = Math.min((i + 1) * itemsPerFloor, items.length);
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleSelectFloor(i)}
                                aria-label={first <= items.length ? `Enter layer ${i + 1}, records ${first} to ${last}` : `Enter layer ${i + 1}, empty`}
                                className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                            >
                                LAYER {i + 1}
                            </button>
                        );
                    })}
                </nav>
            )}

            {/* HEADER — matches HunterProfile & Main Dashboard style */}
            <div className="relative z-50 w-full h-16 flex items-center shrink-0">
                <div className="w-full px-4 md:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                            <SystemLogo theme={theme} className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.2)]" />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className={`font-mono text-[9px] tracking-[0.2em] ${theme.mutedText} uppercase transition-colors duration-700`}>SYSTEM.ACCESS // {playerRank.name}</span>
                            {/* Light ran sky-600 -> cyan-400 -> indigo-200 (1.23:1 at the last stop).
                                Same fix as the profile header: read text takes the ink ramp. */}
                            <h2 id="divine-spire-title" className={`font-orbitron text-base tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.isDark ? 'from-amber-600 via-yellow-400 to-white' : theme.inkGradient} transition-colors duration-700`}>THE DIVINE SPIRE</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={viewMode === 'FLOOR' ? handleBackToTower : onClose}
                        aria-label={viewMode === 'FLOOR' ? 'Back to the tower' : 'Close Divine Spire'}
                        title={viewMode === 'FLOOR' ? 'Back to the tower' : 'Close Divine Spire'}
                        className={`group relative p-1.5 md:p-2 ${theme.mutedText} hover:${theme.baseText} transition-all duration-300 rounded-md border border-transparent ${theme.isDark ? 'hover:border-white/10 hover:bg-white/5' : 'hover:border-slate-300 hover:bg-black/5'}`}
                    >
                        <X size={22} aria-hidden="true" className="relative z-10 transition-transform duration-500 group-hover:rotate-90" />
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className={`relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col ${viewMode === 'TOWER' ? 'pointer-events-none' : ''}`}>

                {/* VIEW MODE: FLOOR (CINEMATIC CAROUSEL) */}
                {viewMode === 'FLOOR' && (
                    <div className="flex-1 min-h-0 flex flex-col w-full animate-in slide-in-from-bottom-10 duration-500 pointer-events-auto overflow-hidden">



                        {/* Search Bar HUD */}
                        <div className="relative z-20 shrink-0 w-full max-w-xl mx-auto px-4 mb-2 md:mb-4">
                            <div className="relative group">
                                <div className={`absolute -inset-1 bg-gradient-to-r ${theme.gradient} opacity-20 blur-md group-focus-within:opacity-40 transition-all duration-500 rounded-full`} />
                                <div className={`relative ${theme.isDark ? 'bg-black/60' : 'bg-white/60'} backdrop-blur-xl border border-white/10 rounded-full px-3 py-2 md:px-4 md:py-3 flex items-center shadow-2xl transition-all duration-700`}>
                                    <Search size={18} aria-hidden="true" className={`${theme.highlightText} mr-2 md:mr-3 opacity-70 shrink-0`} />
                                    {/* The placeholder is this field's only visible label, so it keeps
                                        full muted strength (it was muted at 50%, ~2.3:1), and the
                                        field carries a real name. */}
                                    <input
                                        type="search"
                                        aria-label="Search archives"
                                        placeholder="SEARCH ARCHIVES..."
                                        className={`w-full bg-transparent text-sm md:text-base font-mono ${theme.baseText} ${theme.isDark ? 'placeholder:text-gray-400' : 'placeholder:text-slate-600'} outline-none uppercase tracking-widest transition-colors duration-700 [&::-webkit-search-cancel-button]:hidden`}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value.toUpperCase())}
                                        onInput={(e) => setSearch((e.target as HTMLInputElement).value.toUpperCase())}
                                        autoComplete="on"
                                        autoCorrect="on"
                                        autoCapitalize="characters"
                                        spellCheck={false}
                                        autoFocus
                                    />
                                    {search && (
                                        <button type="button" onClick={() => setSearch('')} aria-label="Clear search" title="Clear search" className={`${theme.mutedText} hover:${theme.highlightText} ml-2`}><X size={16} aria-hidden="true" /></button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* HUD HEADER: Floor / Sector info (Hidden when searching) */}
                        {!search && floors.length > 0 && floors[selectedFloorIndex] && (
                            <div className="shrink-0 z-[60] flex flex-col items-center drop-shadow-2xl mb-1 md:mb-2 relative group/carousel">
                                <div className={`font-mono text-[9px] tracking-[0.4em] ${theme.highlightText} font-bold uppercase mb-1 opacity-80 pointer-events-none`}>SYSTEM.SECTOR_INTERFACE</div>
                                <div className={`relative flex items-center gap-2 md:gap-4 px-3 py-1 md:px-6 md:py-2 rounded-full border backdrop-blur-md pointer-events-auto ${theme.isDark ? 'border-white/10 bg-black/40' : 'border-slate-300 bg-white/85 elev-1'}`}>
                                    <button type="button" disabled={selectedFloorIndex <= 0} onClick={() => setSelectedFloorIndex(i => i - 1)} aria-label="Previous layer" title="Previous layer" className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronLeft size={14} aria-hidden="true" /></button>
                                    <button type="button" onClick={() => setIsFilterOpen(!isFilterOpen)} aria-expanded={isFilterOpen} aria-haspopup="true" aria-controls="spire-filter-menu" className={`font-black text-lg md:text-2xl font-orbitron tracking-widest ${theme.headingText} ${theme.isDark ? 'hover:text-white' : 'hover:text-[#155e75]'} transition-colors flex items-center gap-1.5 outline-none`}>
                                        LAYER {selectedFloorIndex + 1}
                                        <ChevronDown size={16} className={`transition-transform duration-300 ${isFilterOpen ? `rotate-180 ${theme.isDark ? 'text-white' : 'text-[#155e75]'}` : ''}`} />
                                    </button>
                                    <div className={`w-1 h-1 rounded-full ${theme.isDark ? 'bg-white/30' : 'bg-slate-400'}`} />
                                    <span className={`font-mono text-[9px] md:text-xs ${theme.mutedText} tracking-widest`}>SECTOR {floors[selectedFloorIndex].range}</span>
                                    <button type="button" disabled={selectedFloorIndex >= floors.length - 1} onClick={() => setSelectedFloorIndex(i => i + 1)} aria-label="Next layer" title="Next layer" className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronRight size={14} aria-hidden="true" /></button>

                                    {/* Dropdown Filter Menu */}
                                    {isFilterOpen && (
                                        <div id="spire-filter-menu" className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 p-4 rounded-xl border border-white/10 ${theme.isDark ? 'bg-black/95' : 'bg-black/90'} backdrop-blur-3xl min-w-[280px] md:min-w-[320px] shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 z-[70]`}>
                                            {/* Class Filter */}
                                            <div>
                                                <div className={`text-[10px] font-mono text-white/60 tracking-widest mb-2 uppercase flex items-center gap-1.5`}><Filter size={10} /> Classification Protocol</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => setFilterClass('ALL')} className={`px-3 py-1 text-xs font-mono rounded border ${filterClass === 'ALL' ? `${theme.isDark ? 'border-amber-500 bg-amber-500/20' : 'border-sky-500 bg-sky-500/20'} text-white` : `border-white/10 text-white/50 hover:border-white/30 hover:text-white/80`} transition-all`}>ALL</button>
                                                    {availableClasses.map(c => (
                                                        <button key={c} onClick={() => setFilterClass(c)} className={`px-3 py-1 text-xs font-mono rounded border ${filterClass === c ? `${theme.isDark ? 'border-amber-500 bg-amber-500/20' : 'border-sky-500 bg-sky-500/20'} text-white` : `border-white/10 text-white/50 hover:border-white/30 hover:text-white/80`} transition-all uppercase`}>{c}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Status Filter */}
                                            <div>
                                                <div className={`text-[10px] font-mono text-white/60 tracking-widest mb-2 uppercase flex items-center gap-1.5`}><Filter size={10} /> Operational Status</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => setFilterStatus('ALL')} className={`px-3 py-1 text-xs font-mono rounded border ${filterStatus === 'ALL' ? `${theme.isDark ? 'border-amber-500 bg-amber-500/20' : 'border-sky-500 bg-sky-500/20'} text-white` : `border-white/10 text-white/50 hover:border-white/30 hover:text-white/80`} transition-all`}>ALL</button>
                                                    {availableStatuses.map(s => (
                                                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 text-xs font-mono rounded border ${filterStatus === s ? `${theme.isDark ? 'border-amber-500 bg-amber-500/20' : 'border-sky-500 bg-sky-500/20'} text-white` : `border-white/10 text-white/50 hover:border-white/30 hover:text-white/80`} transition-all uppercase`}>{s}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Floor Jump */}
                                            <div>
                                                <div className={`text-[10px] font-mono text-white/60 tracking-widest mb-2 uppercase border-t border-white/5 pt-3 mt-1`}>Direct Access Layer</div>
                                                <div className="grid grid-cols-5 gap-2 max-h-[130px] overflow-y-auto hide-scrollbar">
                                                    {floors.map((f, i) => (
                                                        <button key={f.index} onClick={() => { setSelectedFloorIndex(i); setIsFilterOpen(false); }} className={`p-2 text-xs font-black font-orbitron rounded border ${selectedFloorIndex === i ? `border-white text-white bg-white/10` : `border-white/5 text-white/40 hover:border-white/30 hover:text-white/80 bg-white/5`} transition-all flex items-center justify-center`}>
                                                            {i + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Carousel Area — flex-1 so it fills all remaining vertical space naturally */}
                        <div className="relative flex-1 min-h-0 w-full group/carousel">
                            {/* FLOATING NAVIGATION CONTROLS (desktop only) */}
                            {!search && (
                                <>
                                    {/* Hover-revealed, so they also reveal on keyboard focus — they were
                                        opacity-0 until hovered, and Tab landed on an invisible control. */}
                                    <button
                                        type="button"
                                        onClick={() => scrollCarousel('left')}
                                        aria-label="Scroll left"
                                        className={`absolute left-2 md:left-12 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 md:group-hover/carousel:opacity-100 focus-visible:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex`}
                                    >
                                        <ChevronLeft size={32} aria-hidden="true" className={theme.highlightText} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => scrollCarousel('right')}
                                        aria-label="Scroll right"
                                        className={`absolute right-2 md:right-12 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 md:group-hover/carousel:opacity-100 focus-visible:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)] hidden md:flex`}
                                    >
                                        <ChevronRight size={32} aria-hidden="true" className={theme.highlightText} />
                                    </button>
                                </>
                            )}

                            {/* THE CAROUSEL — uses h-full + overflow-x-auto so it stays within the flex-1 bounds */}
                            {search.length > 0 ? (
                                <div ref={carouselRef} onWheel={handleWheel} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-3 sm:px-6 md:px-12 py-4 gap-4 sm:gap-6 md:gap-10">
                                    {filteredItems.length === 0 ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                            <AlertCircle size={48} className={`${theme.mutedText} mb-4 opacity-50`} />
                                            <p className={`font-mono text-sm tracking-widest ${theme.mutedText}`}>NO RECORDS DETECTED</p>
                                        </div>
                                    ) : (
                                        filteredItems.map((item, index) => {
                                            const rawRank = getQuestRankObj(item);
                                            return (
                                                <div key={item.id} className="h-full max-h-[55vh] sm:max-h-[60vh] md:max-h-[65vh] aspect-[3/4] shrink-0 snap-center transition-all duration-700 hover:scale-[1.03] group relative">
                                                    {/* Reflection Glow */}
                                                    <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-gradient-to-t ${theme.isDark ? 'from-amber-500/40' : 'from-sky-500/40'} to-transparent blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                                                    <div className={`absolute -inset-6 ${theme.isDark ? 'bg-amber-500/10' : 'bg-sky-500/10'} blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />
                                                    <div className="relative z-10 w-full h-full">
                                                        <QuestCard id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            ) : (
                                floors.length > 0 && floors[selectedFloorIndex] ? (
                                    <div ref={carouselRef} onWheel={handleWheel} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-3 sm:px-6 md:px-12 py-4 gap-4 sm:gap-6 md:gap-8 lg:gap-10">
                                        {floors[selectedFloorIndex].items.map((item, index) => {
                                            const rawRank = getQuestRankObj(item);
                                            return (
                                                <div key={item.id} className="h-full max-h-[55vh] sm:max-h-[60vh] md:max-h-[65vh] aspect-[3/4] shrink-0 snap-center transition-all duration-700 hover:scale-[1.03] group relative">
                                                    {/* Reflection Glow */}
                                                    <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-gradient-to-t ${theme.id === 'LIGHT' ? 'from-sky-500/40' : 'from-amber-500/40'} to-transparent blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700`} />
                                                    {/* Backdrop Ambient Lighting */}
                                                    <div className={`absolute -inset-6 ${theme.id === 'LIGHT' ? 'bg-sky-500/10' : 'bg-amber-500/10'} blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none`} />
                                                    <div className="relative z-10 w-full h-full">
                                                        <QuestCard id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${theme.mutedText}`}>
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
