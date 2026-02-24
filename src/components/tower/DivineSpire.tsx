import React, { useState, useEffect, useMemo } from 'react';
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

                {/* VIEW MODE: FLOOR (GRID) */}
                {viewMode === 'FLOOR' && (
                    <div className="w-full h-full flex flex-col animate-in slide-in-from-bottom-10 duration-500 pointer-events-auto">
                        {/* Search Bar relative */}
                        <div className="shrink-0 w-full max-w-2xl mx-auto mt-4 md:mt-8 px-4 mb-4 md:mb-8">
                            <div className="relative group">
                                <div className={`absolute inset-0 bg-${theme.primary}-500/20 blur-xl group-focus-within:bg-${theme.primary}-500/40 transition-all duration-500`} />
                                <div className={`relative ${theme.inputBg} backdrop-blur-md border ${theme.borderSubtle} p-1 md:p-2 flex items-center shadow-2xl transition-colors duration-700`}>
                                    <div className={`p-2 md:p-3 ${theme.highlightText} transition-colors duration-700`}><Search size={20} className="md:w-6 md:h-6" /></div>
                                    <input type="text" placeholder="INVOKE TRUE NAME..." className={`w-full bg-transparent text-sm md:text-xl font-mono ${theme.baseText} placeholder:${theme.mutedText} outline-none uppercase tracking-wider transition-colors duration-700`} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth px-3 sm:px-6 md:px-12 pb-32">
                            {/* Show only selected floor OR all if searching */}
                            {search.length > 0 ? (
                                <div className="animate-in fade-in duration-500">
                                    <div className={`relative p-4 md:p-6 border ${theme.isDark ? 'border-white/5 bg-black/20' : 'border-black/5 bg-white/20'} rounded-xl backdrop-blur-sm`}>
                                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8 relative z-10">
                                            {filteredItems.map((item, index) => {
                                                const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                                return <QuestCard key={item.id} id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                floors.length > 0 && floors[selectedFloorIndex] ? (
                                    <div className="animate-in fade-in duration-500">
                                        <div className={`sticky top-0 z-20 ${theme.isDark ? 'bg-[#020202]/95 border-white/10' : 'bg-[#f8f5f2]/95 border-black/10'} backdrop-blur-xl border-y py-3 px-4 md:px-6 mb-8 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-700`}>
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className={`hidden md:block w-1 h-8 ${theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'} shadow-[0_0_10px_currentColor] animate-pulse`} />
                                                <div className="flex flex-col">
                                                    <span className={`font-mono text-[8px] md:text-[10px] tracking-[0.3em] ${theme.mutedText} font-bold uppercase`}>SYSTEM.SECTOR_INTERFACE</span>
                                                    <div className="flex items-baseline gap-2 md:gap-3">
                                                        <span className={`font-black text-lg md:text-2xl font-orbitron tracking-wider ${theme.headingText}`}>LAYER {selectedFloorIndex + 1}</span>
                                                        <span className={`font-mono text-[9px] md:text-xs ${theme.highlightText} border ${theme.borderSubtle} bg-black/20 px-1.5 py-0.5 rounded tracking-widest`}>SECTOR {floors[selectedFloorIndex].range}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button disabled={selectedFloorIndex <= 0} onClick={() => setSelectedFloorIndex(i => i - 1)} className={`p-1.5 md:p-2 border ${theme.borderSubtle} ${theme.isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} disabled:opacity-30 transition-all`}><ChevronLeft size={18} className="md:w-5 md:h-5" /></button>
                                                <button disabled={selectedFloorIndex >= floors.length - 1} onClick={() => setSelectedFloorIndex(i => i + 1)} className={`p-1.5 md:p-2 border ${theme.borderSubtle} ${theme.isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} disabled:opacity-30 transition-all`}><ChevronRight size={18} className="md:w-5 md:h-5" /></button>
                                            </div>
                                        </div>

                                        <div className={`relative p-4 md:p-6 border ${theme.isDark ? 'border-white/5 bg-black/20' : 'border-black/5 bg-white/20'} rounded-xl backdrop-blur-sm`}>
                                            <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${theme.borderSubtle} rounded-tl-lg`} />
                                            <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${theme.borderSubtle} rounded-tr-lg`} />
                                            <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${theme.borderSubtle} rounded-bl-lg`} />
                                            <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${theme.borderSubtle} rounded-br-lg`} />

                                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-6 md:gap-8 relative z-10">
                                                {floors[selectedFloorIndex].items.map((item, index) => {
                                                    const rawRank = getQuestRankObj(items.find(v => v.id === item.id) || item);
                                                    return <QuestCard key={item.id} id={`item-${item.id}`} item={item} onClick={onActivate} index={index} theme={theme} rankStyle={rawRank} />
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`flex flex-col items-center justify-center py-32 ${theme.mutedText}`}>
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
