import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { OpenRecordGlyph, SearchGlyph } from '../system/SystemGlyphs';
import { InfinitePortalIcon } from '../system/CustomIcons';
import { Quest, Theme } from '../../core/types';
import { STATUS_INFO, statusLabel } from '../../core/constants';
import CoverArt from '../quest/CoverArt';
import { FLOOR_DEFS, floorIndexForItem } from './floors';
import { SPIRE_COMPARE, SPIRE_SORTS, SpireSort } from './spireSort';

/**
 * THE COMMAND MATRIX: the Spire's list view, for keeping a large library moving.
 *
 * Every series in one dense list (search, a status filter with counts, the Spire's shared
 * sort), each row with a small cover, the title, its class, status and floor, the reader's
 * appraisal, progress ("179/200", and "+N NEW" when the tracker found more), and three
 * actions: +1 (a chapter, through App's usual chapter path: taps in a row are one save, with
 * Undo, the dais and chapter sounds as anywhere), open the series page, and the reading link.
 *
 * THE ORDER HOLDS WHILE YOU WORK. It is taken when the sort, the filter or the search changes
 * (or a record is added or removed), not on every save. Otherwise a row you just logged would
 * leap to the top of "Recent", or out of a status filter when reading reopens it, and the next
 * tap or "+" would land on a different series. The row's own numbers and status stay live.
 *
 * Keyboard (when the Spire is on top and focus is not in a field): J / K or the arrows move
 * the marked row, + logs a chapter on it and - takes one back (a single wrong +1 is below the
 * Undo toast's threshold, and a toast per tap would sit on the bottom rows' buttons), O opens
 * it, Enter opens its reading link, / jumps to the search, Arrow Down from the search drops
 * back to the list, Escape in the search clears it. Every action but - is also a button,
 * reachable by Tab; by pointer a wrong +1 is put right on the series page. On a phone the
 * progress folds under the title; the actions stay at the row's end.
 */

interface CommandMatrixProps {
    items: Quest[];
    theme: Theme;
    sortBy: SpireSort;
    onSort: (sort: SpireSort) => void;
    onOpen: (id: string) => void;
    onStep: (id: string, delta?: number) => void;
    onPortal: (link: string, questId: string) => void;
}

const isField = (el: Element | null) =>
    !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

const Progress: React.FC<{ q: Quest; theme: Theme }> = ({ q, theme }) => {
    const total = q.totalChapters || 0;
    const pct = total > 0 ? Math.min(1, q.currentChapter / total) : 0;
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-1 min-w-[2rem] h-1 rounded-full overflow-hidden ${theme.isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <div className="h-full bg-accent-solid transition-[width] duration-300" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className={`shrink-0 font-mono text-[10px] tabular-nums ${theme.baseText}`}>{q.currentChapter}/{total > 0 ? total : '?'}</span>
            {(q.newChapters ?? 0) > 0 && (
                <span className="hud hud-tag shrink-0 px-1.5 font-mono text-[9px] font-bold leading-[15px]">+{q.newChapters} NEW</span>
            )}
        </div>
    );
};

interface RowProps {
    q: Quest;
    index: number;
    isActive: boolean;
    theme: Theme;
    onMark: (id: string) => void;
    onStep: (id: string) => void;
    onOpen: (id: string) => void;
    onPortal: (link: string, questId: string) => void;
}

/** One record. Memoized, with stable callbacks from the Matrix, so a save re-renders the row
 *  it changed and not the whole library. */
const Row = React.memo<RowProps>(({ q, index, isActive, theme, onMark, onStep, onOpen, onPortal }) => {
    const total = q.totalChapters || 0;
    const caughtUp = total > 0 && q.currentChapter >= total;
    // The floor it stands on; the base floors carry their status's own name (SEALED, STASIS,
    // SEVERED), which the line already shows.
    const status = statusLabel(q.status);
    const floor = FLOOR_DEFS[floorIndexForItem(q)]?.label;
    const stage = floor === status ? null : floor;
    const link = q.link;
    const iconBtn = `hud hud-tool [--hud-c:5px] w-9 h-9 flex items-center justify-center ${theme.mutedText} ${theme.isDark ? 'hover:text-white' : 'hover:text-[#241a33]'}`;
    return (
        <li
            data-row={index}
            data-tour={index === 0 ? 'matrix-row' : undefined}
            aria-current={isActive ? 'true' : undefined}
            onPointerDown={() => onMark(q.id)}
            className="hud hud-row flex items-center gap-2.5 md:gap-3 px-2 md:px-3 py-2"
        >
            <CoverArt url={q.coverUrl} title={q.title} size="thumb" className="shrink-0 w-9 h-[54px] rounded-[2px] border border-white/10" />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    {/* Two lines on a phone, where one held about fifteen letters and long titles
                        were hard to tell apart. */}
                    <span className={`min-w-0 max-md:line-clamp-2 max-md:break-words md:truncate font-orbitron font-bold text-[12px] md:text-[13px] leading-tight tracking-wide uppercase ${theme.headingText}`}>{q.title}</span>
                    {q.rating ? <span className="md:hidden shrink-0 ml-auto font-mono text-[10px] font-bold tabular-nums text-accent-ink">{q.rating}/10</span> : null}
                </div>
                <div className={`font-mono text-[9px] tracking-widest uppercase truncate ${theme.mutedText}`}>
                    {[q.classType, status, stage].filter(Boolean).join(' · ')}
                </div>
                <div className="md:hidden mt-1"><Progress q={q} theme={theme} /></div>
            </div>
            <span className="hidden md:block w-14 shrink-0 text-center font-mono text-[11px] font-bold tabular-nums text-accent-ink">
                {q.rating ? `${q.rating}/10` : <span className={theme.mutedText}>—</span>}
            </span>
            <div className="hidden md:block w-40 lg:w-52 shrink-0"><Progress q={q} theme={theme} /></div>
            <div className="shrink-0 flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onStep(q.id)}
                    disabled={caughtUp}
                    aria-label={`Log a chapter of ${q.title}, now chapter ${q.currentChapter}`}
                    title={caughtUp ? 'Caught up' : 'Log a chapter (+)'}
                    className={`hud hud-btn [--hud-c:5px] h-9 min-w-[2.5rem] px-2 font-mono text-[11px] font-bold ${caughtUp ? `${theme.mutedText} opacity-40 cursor-not-allowed` : 'hud-accent text-accent-ink'}`}
                >
                    +1
                </button>
                <button type="button" onClick={() => onOpen(q.id)} aria-label={`Open ${q.title}`} title="Open the series page (O)" className={iconBtn}>
                    <OpenRecordGlyph size={15} aria-hidden="true" />
                </button>
                {link ? (
                    <button type="button" onClick={() => onPortal(link, q.id)} aria-label={`Enter portal for ${q.title}`} title="Open its reading link (Enter)" className={iconBtn}>
                        <InfinitePortalIcon size={14} aria-hidden="true" />
                    </button>
                ) : (
                    <span aria-hidden="true" className="w-9 h-9" />
                )}
            </div>
        </li>
    );
});
Row.displayName = 'MatrixRow';

const CommandMatrix: React.FC<CommandMatrixProps> = ({ items, theme, sortBy, onSort, onOpen, onStep, onPortal }) => {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('ALL');
    // The marked row, by id: the keys act on it. None marked means the first.
    const [activeId, setActiveId] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        items.forEach((q) => { c[q.status] = (c[q.status] || 0) + 1; });
        return c;
    }, [items]);

    // The order (see the header): re-taken for a new sort, filter or search, or when the set
    // of records changes, never for a save. `items` is read through a ref for that reason.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const idsKey = useMemo(() => items.map((i) => i.id).sort().join('|'), [items]);
    const order = useMemo(() => {
        const q = query.trim().toLowerCase();
        return itemsRef.current
            .filter((i) => (status === 'ALL' || i.status === status) && (!q || i.title.toLowerCase().includes(q)))
            .sort(SPIRE_COMPARE[sortBy])
            .map((i) => i.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, query, status, sortBy]);
    const rows = useMemo(() => {
        const byId = new Map(items.map((i) => [i.id, i]));
        return order.map((id) => byId.get(id)).filter((q): q is Quest => !!q);
    }, [order, items]);

    const found = rows.findIndex((r) => r.id === activeId);
    const active = found === -1 ? 0 : found;

    // A new sort, filter or search starts again from the top; a moved mark stays in view.
    useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [query, status, sortBy]);
    useEffect(() => {
        if (activeId === null) return;
        listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
        // Only when the mark moves, not when the list around it changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    // The rows' callbacks never change, so a memoized row re-renders only for its own data.
    const handlers = useRef({ onStep, onOpen, onPortal });
    handlers.current = { onStep, onOpen, onPortal };
    const mark = useCallback((id: string) => setActiveId(id), []);
    const step = useCallback((id: string) => { setActiveId(id); handlers.current.onStep(id); }, []);
    const open = useCallback((id: string) => handlers.current.onOpen(id), []);
    const portal = useCallback((link: string, questId: string) => handlers.current.onPortal(link, questId), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const el = document.activeElement;
            // Only while the Spire is on top and has focus: a series page, the editor, a tour,
            // the rite or a notice keep their keys (a "+" must never log a chapter behind them).
            // Every other modal stacks above the Spire, so any other open one wins.
            const spire = rootRef.current?.closest('[role="dialog"]');
            if (!spire) return;
            if (Array.from(document.querySelectorAll('[aria-modal="true"]')).some((m) => m !== spire)) return;
            if (el && el !== document.body && !spire.contains(el)) return;
            if (isField(el)) {
                if (e.key === 'ArrowDown' && el === searchRef.current && rows.length) {
                    e.preventDefault();
                    listRef.current?.focus({ preventScroll: true });
                    setActiveId(rows[0].id);
                }
                return;
            }
            const row = rows[active];
            const move = (to: number) => {
                const next = rows[Math.max(0, Math.min(rows.length - 1, to))];
                if (next) setActiveId(next.id);
                // Moving the mark means working the list: a control left focused outside it
                // (a filter chip just clicked, the view switch) would otherwise take the
                // Enter meant for the marked row. A focused button inside the list keeps it.
                if (el instanceof HTMLElement && el !== document.body && !listRef.current?.contains(el)) {
                    listRef.current?.focus({ preventScroll: true });
                }
            };
            switch (e.key) {
                case 'j': case 'J': case 'ArrowDown':
                    e.preventDefault(); move(active + 1); break;
                case 'k': case 'K': case 'ArrowUp':
                    e.preventDefault(); move(active - 1); break;
                case '+': case '=':
                    if (row) { e.preventDefault(); step(row.id); } break;
                case '-': case '_':
                    if (row) { e.preventDefault(); handlers.current.onStep(row.id, -1); } break;
                case 'o': case 'O':
                    if (row) { e.preventDefault(); setActiveId(row.id); open(row.id); } break;
                case 'Enter':
                    // A focused button or link keeps its own Enter.
                    if (row?.link && !(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement)) { e.preventDefault(); portal(row.link, row.id); }
                    break;
                case '/':
                    e.preventDefault(); searchRef.current?.focus(); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rows, active, step, open, portal]);

    const chip = (on: boolean) => `hud hud-chip shrink-0 h-7 px-2.5 font-mono text-[10px] font-bold tracking-widest uppercase whitespace-nowrap ${on ? 'text-accent-ink' : theme.mutedText}`;

    return (
        <div ref={rootRef} className="flex-1 min-h-0 flex flex-col w-full max-w-5xl mx-auto animate-in fade-in duration-300 pointer-events-auto">
            {/* Search, sort, status filter, the count and the keys. */}
            <div data-tour="matrix-tools" className="shrink-0 px-3 md:px-4 pt-3 md:pt-5 pb-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <div className="hud hud-field hud-well flex-1 min-w-0 flex items-center gap-2 h-9 px-3">
                        <SearchGlyph size={15} aria-hidden="true" className={`shrink-0 ${theme.highlightText} opacity-70`} />
                        <input
                            ref={searchRef}
                            type="search"
                            aria-label="Search the matrix"
                            placeholder="SEARCH TITLES..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            // Escape clears a search before it closes the Spire.
                            onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }}
                            className={`flex-1 min-w-0 bg-transparent outline-none font-mono text-[12px] tracking-widest uppercase ${theme.baseText} ${theme.isDark ? 'placeholder:text-gray-400' : 'placeholder:text-stone-600'} [&::-webkit-search-cancel-button]:hidden`}
                        />
                        {query && (
                            <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className={`shrink-0 ${theme.mutedText} hover:text-accent-ink`}><X size={14} aria-hidden="true" /></button>
                        )}
                    </div>
                    {/* A select cannot carry the kit's frame itself (no pseudo-elements), so
                        the frame is its wrapper, lit while the select has focus. */}
                    <div className="hud hud-field hud-well shrink-0 h-9 flex items-stretch">
                        <select
                            aria-label="Sort records"
                            value={sortBy}
                            onChange={(e) => onSort(e.target.value as SpireSort)}
                            style={{ colorScheme: theme.isDark ? 'dark' : 'light' }}
                            className={`h-full px-2 bg-transparent ${theme.isDark ? 'text-white' : 'text-stone-800'} font-mono text-[10px] tracking-widest uppercase outline-none cursor-pointer`}
                        >
                            {SPIRE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>
                <div role="group" aria-label="Filter by status" className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                    <button type="button" aria-pressed={status === 'ALL'} onClick={() => setStatus('ALL')} className={chip(status === 'ALL')}>All {items.length}</button>
                    {STATUS_INFO.filter((s) => counts[s.value] || status === s.value).map((s) => (
                        <button key={s.value} type="button" aria-pressed={status === s.value} onClick={() => setStatus(s.value)} title={s.plain} className={chip(status === s.value)}>
                            {s.label} {counts[s.value] ?? 0}
                        </button>
                    ))}
                </div>
                <div className={`flex justify-between gap-3 font-mono text-[9px] tracking-widest uppercase ${theme.mutedText}`}>
                    <span aria-live="polite">{rows.length} of {items.length} records</span>
                    <span className="hidden [@media(hover:hover)]:inline truncate">J / K move · + / − chapter · O open · Enter portal · / search</span>
                </div>
            </div>

            <ul ref={listRef} tabIndex={-1} aria-label="Records" className="outline-none flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-2 md:px-4 pb-6 flex flex-col gap-1">
                {rows.length === 0 && (
                    <li className={`py-12 text-center font-mono text-[11px] tracking-widest uppercase ${theme.mutedText}`}>No records match.</li>
                )}
                {rows.map((q, i) => (
                    <Row key={q.id} q={q} index={i} isActive={i === active} theme={theme} onMark={mark} onStep={step} onOpen={open} onPortal={portal} />
                ))}
            </ul>
        </div>
    );
};

export default CommandMatrix;
