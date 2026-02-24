import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Theme, Quest, Rank } from '../../core/types';
import TowerHUD from './TowerHUD';
import TowerStructure from './TowerStructure';
import QuestCard from '../quest/QuestCard';
import SystemLogo from '../system/SystemLogo';
import { getQuestRankObj } from '../../utils/ranks';
import { ChevronLeft, ChevronRight, X, Search, Layers, AlertCircle } from 'lucide-react';

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
            const scrollAmount = window.innerWidth * 0.5;
            carouselRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
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
        // Ensure index is within bounds (Tower has 8 visual floors, map to actual data)
        const targetIndex = Math.min(index, floors.length - 1);
        if (targetIndex < 0) return; // No data
        setSelectedFloorIndex(targetIndex);
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

    // Filtered items memoization 
    const filteredItems = useMemo(() => {
        if (!search) return [];
        return items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
    }, [search, items]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[60] bg-transparent animate-in fade-in zoom-in-95 duration-500 flex flex-col transition-colors duration-700`}>
            {/* TOWER BACKGROUND LAYER (FULLSCREEN) */}
            {viewMode === 'TOWER' && (
                <div className="absolute inset-0 z-0 animate-in fade-in duration-700">
                    <TowerHUD items={items} theme={theme} onActivate={onActivate} isFocused={isFocused} selectedFloorIndex={selectedFloorIndex} itemsPerFloor={itemsPerFloor} streak={streak} />
                    <TowerStructure theme={theme} onSelectFloor={handleSelectFloor} onFocus={handleFocus} items={items} itemsPerFloor={itemsPerFloor} isPaused={false} />
                </div>
            )}

            {/* HEADER */}
            <div className={`relative z-10 h-20 md:h-24 flex items-center justify-between px-4 md:px-6 border-b ${viewMode === 'TOWER' ? 'border-transparent' : theme.borderSubtle} ${viewMode === 'TOWER' ? 'bg-transparent' : (theme.isDark ? 'bg-black/40' : 'bg-white/40')} ${viewMode === 'TOWER' ? '' : 'backdrop-blur-md'} transition-all duration-700`}>
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center shrink-0">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col leading-none overflow-hidden">
                        <div className="flex gap-2 items-baseline">
                            <span className={`font-mono text-[8px] md:text-[10px] tracking-[0.2em] ${theme.headingText} font-bold transition-colors duration-700 truncate`}>
                                ACCESS: {playerRank.name}
                            </span>
                        </div>
                        <span className={`font-orbitron text-sm md:text-lg tracking-normal font-bold drop-shadow-sm transition-colors duration-700 text-transparent bg-clip-text bg-gradient-to-r ${theme.id === 'LIGHT' ? "from-sky-500 to-cyan-500" : "from-amber-600 via-yellow-400 to-white"} truncate`}>
                            THE DIVINE SPIRE
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button onClick={viewMode === 'FLOOR' ? handleBackToTower : onClose} className={`p-1 md:p-2 ${theme.mutedText} hover:${theme.baseText} hover:rotate-90 transition-all duration-300`}><X size={24} className="md:w-8 md:h-8" /></button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className={`relative z-10 flex-1 overflow-hidden flex flex-col ${viewMode === 'TOWER' ? 'pointer-events-none' : ''}`}>

                {/* VIEW MODE: FLOOR (CINEMATIC CAROUSEL) */}
                {viewMode === 'FLOOR' && (
                    <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-10 duration-500 pointer-events-auto">

                        {/* THEME AMBIENT GLOW (BACKGROUND) */}
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <div className={`absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-${theme.primary}-500/10 rounded-full blur-[150px] z-10 mix-blend-screen transition-colors duration-700`} />
                            <div className={`absolute -bottom-[20%] -left-[20%] w-[60%] h-[60%] bg-${theme.accent}-500/10 rounded-full blur-[150px] z-10 mix-blend-screen transition-colors duration-700`} />
                        </div>

                        {/* Search Bar HUD */}
                        <div className="relative z-20 shrink-0 w-full max-w-xl mx-auto mt-6 md:mt-10 px-4">
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

                        <div className="flex-1 flex flex-col relative w-full z-10 group/carousel">

                            {/* HUD HEADER: Floor / Sector info (Hidden when searching) */}
                            {!search && floors.length > 0 && floors[selectedFloorIndex] && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none drop-shadow-2xl">
                                    <div className={`font-mono text-[10px] tracking-[0.4em] ${theme.highlightText} font-bold uppercase mb-1 opacity-80`}>SYSTEM.SECTOR_INTERFACE</div>
                                    <div className="flex items-center gap-4 px-6 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md">
                                        <button disabled={selectedFloorIndex <= 0} onClick={() => setSelectedFloorIndex(i => i - 1)} className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronLeft size={16} /></button>
                                        <span className={`font-black text-2xl font-orbitron tracking-widest ${theme.headingText}`}>LAYER {selectedFloorIndex + 1}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                        <span className={`font-mono text-xs ${theme.mutedText} tracking-widest`}>SECTOR {floors[selectedFloorIndex].range}</span>
                                        <button disabled={selectedFloorIndex >= floors.length - 1} onClick={() => setSelectedFloorIndex(i => i + 1)} className={`${theme.mutedText} hover:${theme.highlightText} disabled:opacity-30 transition-colors`}><ChevronRight size={16} /></button>
                                    </div>
                                </div>
                            )}

                            {/* FLOATING NAVIGATION CONTROLS */}
                            {!search && (
                                <>
                                    <button
                                        onClick={() => scrollCarousel('left')}
                                        className={`absolute left-4 md:left-12 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 group-hover/carousel:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
                                    >
                                        <ChevronLeft size={32} className={theme.highlightText} />
                                    </button>
                                    <button
                                        onClick={() => scrollCarousel('right')}
                                        className={`absolute right-4 md:right-12 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full border border-white/10 ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} backdrop-blur-md opacity-0 group-hover/carousel:opacity-100 transition-all duration-500 transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
                                    >
                                        <ChevronRight size={32} className={theme.highlightText} />
                                    </button>
                                </>
                            )}

                            {/* THE CAROUSEL */}
                            {search.length > 0 ? (
                                <div ref={carouselRef} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-[15vw] md:px-[30vw] py-12 gap-8 md:gap-16">
                                    {filteredItems.length === 0 ? (
                                        <div className="w-full flex-1 flex flex-col items-center justify-center translate-y-[-10vh]">
                                            <AlertCircle size={48} className={`${theme.mutedText} mb-4 opacity-50`} />
                                            <p className={`font-mono text-sm tracking-widest ${theme.mutedText}`}>NO RECORDS DETECTED</p>
                                        </div>
                                    ) : (
                                        filteredItems.map((item, index) => {
                                            const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                            return (
                                                <div key={item.id} className="w-[280px] md:w-[350px] lg:w-[400px] shrink-0 snap-center transition-all duration-700 hover:-translate-y-8 hover:scale-105 group relative pb-16">
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
                                    <div ref={carouselRef} className="absolute inset-0 flex items-center overflow-x-auto hide-scrollbar snap-x snap-mandatory px-[15vw] md:px-[30vw] py-12 gap-8 md:gap-16">
                                        {floors[selectedFloorIndex].items.map((item, index) => {
                                            const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                            return (
                                                <div key={item.id} className="w-[280px] md:w-[350px] lg:w-[400px] shrink-0 snap-center transition-all duration-700 hover:-translate-y-8 hover:scale-[1.03] group relative pb-16">
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
                                    <div className={`w-full flex-1 flex flex-col items-center justify-center translate-y-[-10vh] ${theme.mutedText}`}>
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
