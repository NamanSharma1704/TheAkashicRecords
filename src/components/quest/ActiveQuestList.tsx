import React from 'react';
import { AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { SigilGlyph } from '../system/SystemGlyphs';
import CoverArt from './CoverArt';
import { statusLabel } from '../../core/constants';

/* The dashboard's ACTIVE QUESTS list, reorderable by drag (moved out of App.tsx, 2026-11-13). */

// SUB-COMPONENT: QuestListItem to handle individual drag controls and touch scrolling
const QuestListItem = ({ item, theme, activeId, handleLogClick, onDragStateChange }: any) => {
    const dragControls = useDragControls();
    const isHighlighted = activeId === item.id;

    const handleDragStart = (e: React.PointerEvent) => {
        e.preventDefault();
        onDragStateChange?.(true);   // tell scroll container: lock scroll
        dragControls.start(e);
    };

    const handleDragEnd = () => {
        onDragStateChange?.(false);  // restore scroll
    };

    return (
        <Reorder.Item
            key={item.id}
            value={item}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`hud hud-row group cursor-pointer border border-transparent py-1.5 px-3 ${isHighlighted ? 'hud-on' : ''}`}
        >
            <div className="flex justify-between items-center h-full">
                <div className="flex items-center gap-2 max-w-[85%] min-w-0">
                    {/* Drag Handle — always visible on touch (mobile/tablet), hover-only on desktop.
                        Raised above the row button's stretched hit area so a press here drags
                        rather than selects. */}
                    <div
                        aria-hidden="true"
                        className={`relative z-10 cursor-grab active:cursor-grabbing flex-none touch-none select-none ${theme.baseText}
                            p-2 -ml-2
                            opacity-40 lg:opacity-0 group-hover:opacity-70 active:opacity-100
                            transition-opacity
                            [@media(pointer:coarse)]:opacity-60
                            flex items-center justify-center min-w-[28px] min-h-[32px]
                        `}
                        onPointerDown={handleDragStart}
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* The row's action is a real button so it can be reached and fired from
                        the keyboard (an <li> with onClick cannot). Its ::after stretches over
                        the whole row, so the click target is unchanged. */}
                    <button
                        type="button"
                        onClick={() => handleLogClick(item.id)}
                        aria-current={isHighlighted ? 'true' : undefined}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer after:content-[''] after:absolute after:inset-0"
                    >
                    {/* Every row gets a thumbnail box, so titles line up: a row without a
                        cover used to render none and sat out of line with its neighbours.
                        Decorative (alt ""): the title is right beside it. */}
                    <CoverArt
                        url={item.coverUrl}
                        title={item.title}
                        size="thumb"
                        className={`w-8 h-[45px] xl:w-10 xl:h-[56px] flex-none rounded-sm border ${theme.isDark ? 'border-gray-800' : 'border-gray-300'} opacity-80 group-hover:opacity-100 transition-opacity shadow-sm shrink-0`}
                    />
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className={`font-bold font-mono text-[11px] leading-tight ${isHighlighted ? theme.highlightText : `${theme.mutedText} group-hover:${theme.headingText}`} transition-colors duration-700 uppercase line-clamp-2`}>{item.title}</span>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                            <div className={`w-1 h-1 rounded-full flex-none ${item.status === 'ACTIVE' ? (theme.isDark ? 'bg-amber-400' : 'bg-[#7c3aed]') : 'bg-gray-400'}`} />
                            <span className={`text-[9px] ${theme.mutedText} uppercase font-mono tracking-widest transition-colors duration-700 truncate`}>{statusLabel(item.status)}</span>
                            {/* Released since you last read on (the chapter tracker). Reading
                                forward clears it, server-side. */}
                            {item.newChapters > 0 && (
                                <span
                                    className="hud hud-tag flex-none px-1.5 text-[9px] font-mono font-bold tracking-widest leading-[15px]"
                                >
                                    +{item.newChapters} NEW
                                </span>
                            )}
                        </div>
                    </div>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {isHighlighted && <SigilGlyph size={14} className={`${theme.highlightText} animate-spin-slow transition-colors duration-700 shrink-0`} />}
                </div>
            </div>
        </Reorder.Item>
    );
};

// SUB-COMPONENT: ActiveQuestList — owns touch-action state for drag-vs-scroll resolution
// On touch devices, the browser fights between scroll and drag. This component:
//   1. Keeps touchAction='pan-y' normally (allows vertical scroll)
//   2. Switches to touchAction='none' the instant a drag begins (blocks scroll so Motion can move the item)
//   3. Restores 'pan-y' when drag ends
export const ActiveQuestList = ({ orderedActiveQuests, handleReorderActiveQuests, theme, activeId, handleLogClick, loaded }: any) => {
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragStateChange = React.useCallback((dragging: boolean) => {
        setIsDragging(dragging);
    }, []);

    return (
        <div
            className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar overscroll-contain ${isDragging ? 'touch-none' : 'touch-pan-y'}`}
        >
            {/* An empty list says how to fill it, rather than leaving a blank panel; but only
                once the library has loaded and the ordered copy has caught up with it, or it
                flashed on every load before the records arrived. */}
            {loaded && orderedActiveQuests.length === 0 && (
                <p className={`px-1 py-3 font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                    No active quests yet. Open a gate to add one, or set a record ACTIVE from its detail view in the Divine Spire.
                </p>
            )}
            <Reorder.Group
                axis="y"
                values={orderedActiveQuests}
                onReorder={handleReorderActiveQuests}
                className="flex flex-col gap-1 h-full pb-6"
            >
                <AnimatePresence initial={false}>
                    {orderedActiveQuests.map((item: any) => (
                        <QuestListItem
                            key={item.id}
                            item={item}
                            theme={theme}
                            activeId={activeId}
                            handleLogClick={handleLogClick}
                            onDragStateChange={handleDragStateChange}
                        />
                    ))}
                </AnimatePresence>
            </Reorder.Group>
        </div>
    );
};
