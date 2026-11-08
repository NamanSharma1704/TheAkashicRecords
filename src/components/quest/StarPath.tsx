import React, { useEffect, useMemo, useRef, useState } from 'react';
import { starMarks, starName } from '../../utils/starMarks';

/**
 * THE STAR-PATH: milestone stars on the series page's progress thread.
 *
 * Nodes at the first chapter, a quarter, half, three quarters and the latest chapter
 * (starMarks), placed along the thread by chapter. Built from the HUD kit: a diamond (◈) in the
 * theme accent, faint and hollow ahead of the reader, a lit glass diamond with a ✦ and a soft
 * halo once crossed. One crossed while the page is open flares once.
 *
 * Each node is a button: hover, keyboard focus or a tap (iPhones do not focus a tapped button)
 * shows a small readout: the milestone, its chapter, and the day the reading log first crossed
 * it. A milestone reached before the log began (a series added part-way through) says so
 * rather than inventing a date. The readout is the same text as the button's name.
 */

interface StarPathProps {
    current: number;
    total: number;
    /** Chapter to the 'YYYY-MM-DD' day it was first crossed (null: no crossing in the log).
     *  Undefined while the history is still loading. */
    days?: Record<number, string | null>;
    isDark: boolean;
    formatDay: (day: string) => string;
}

const STAR = 'M10 4.4 L11.4 8.6 L15.6 10 L11.4 11.4 L10 15.6 L8.6 11.4 L4.4 10 L8.6 8.6 Z';
const DIAMOND = '10,2 18,10 10,18 2,10';

const StarPath: React.FC<StarPathProps> = ({ current, total, days, isDark, formatDay }) => {
    const marks = useMemo(() => starMarks(total), [total]);
    const [open, setOpen] = useState<number | null>(null);
    const [ignited, setIgnited] = useState<number[]>([]);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // A star crossed while the page is open flares once. Not on opening the page.
    const lastCurrent = useRef(current);
    useEffect(() => {
        const prev = lastCurrent.current;
        lastCurrent.current = current;
        const crossed = marks.filter((m) => prev < m && current >= m);
        if (!crossed.length) return;
        setIgnited(crossed);
        const t = window.setTimeout(() => setIgnited([]), 900);
        return () => window.clearTimeout(t);
    }, [current, marks]);

    // A tapped-open readout closes on a tap anywhere else.
    useEffect(() => {
        if (open === null) return;
        const onDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [open]);

    if (!marks.length) return null;

    const coreFace = isDark ? 'rgba(11,11,17,0.92)' : 'rgba(255,255,255,0.92)';
    const describe = (chapter: number) => {
        const { name } = starName(chapter, total);
        const reached = current >= chapter;
        const day = days?.[chapter];
        const detail = !reached
            ? `${chapter - current} chapter${chapter - current === 1 ? '' : 's'} to go`
            : day ? `Breached ${formatDay(day)}`
            : days === undefined ? 'Reading the log…'
            : 'Before the reading log began';
        return { name, reached, detail };
    };

    return (
        <div ref={rootRef} className="contents">
            {/* The stars, over the thread (the parent wraps the thread with `relative`). */}
            <div className="absolute left-0 right-0 top-0 h-2">
                {marks.map((chapter) => {
                    const pct = Math.min(100, Math.max(0, (chapter / total) * 100));
                    const { name, reached, detail } = describe(chapter);
                    const align = pct < 15 ? 'left-0' : pct > 85 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                    return (
                        <button
                            key={chapter}
                            type="button"
                            aria-label={`${name}, chapter ${chapter}: ${detail}`}
                            onClick={() => setOpen((o) => (o === chapter ? null : chapter))}
                            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(chapter); }}
                            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen((o) => (o === chapter ? null : o)); }}
                            onFocus={() => setOpen(chapter)}
                            onBlur={() => setOpen((o) => (o === chapter ? null : o))}
                            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); }}
                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] cursor-pointer"
                            style={{ left: `${pct}%` }}
                        >
                            <svg
                                viewBox="0 0 20 20"
                                width={18}
                                height={18}
                                aria-hidden="true"
                                className={`${reached ? 'star-node-lit' : ''} ${ignited.includes(chapter) ? 'star-ignite' : ''}`}
                            >
                                <polygon points={DIAMOND} fill={coreFace} style={{ stroke: 'var(--accent-color)' }} strokeWidth={reached ? 1.4 : 1.1} strokeLinejoin="round" opacity={reached ? 1 : 0.55} />
                                {reached ? (
                                    <>
                                        <polygon points={DIAMOND} style={{ fill: 'var(--accent-color)' }} fillOpacity={0.2} />
                                        <path d={STAR} style={{ fill: 'var(--accent-color)' }} />
                                    </>
                                ) : (
                                    <circle cx="10" cy="10" r="1.3" style={{ fill: 'var(--accent-color)' }} opacity={0.55} />
                                )}
                            </svg>

                            {open === chapter && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute bottom-full mb-2 ${align} z-20 whitespace-nowrap px-2.5 py-1.5 rounded-sm border border-accent-line text-left pointer-events-none ${isDark ? 'bg-black/90' : 'bg-white/95 shadow-md'}`}
                                >
                                    <span className="block font-mono text-[9px] font-bold tracking-[0.2em] uppercase text-accent-ink">{name} · CH {chapter}</span>
                                    <span className={`block font-mono text-[10px] tracking-wide ${isDark ? 'text-white/85' : 'text-stone-800'}`}>{detail}</span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Captions under the thread, at the same places. */}
            <div aria-hidden="true" className="relative h-3 mt-3">
                {marks.map((chapter) => {
                    const pct = Math.min(100, Math.max(0, (chapter / total) * 100));
                    const shift = pct < 8 ? 'translate-x-0' : pct > 92 ? '-translate-x-full' : '-translate-x-1/2';
                    const reached = current >= chapter;
                    return (
                        <span
                            key={chapter}
                            className={`absolute top-0 ${shift} font-mono text-[9px] tracking-widest whitespace-nowrap ${reached ? 'text-accent-ink font-bold' : isDark ? 'text-white/55' : 'text-stone-600'}`}
                            style={{ left: `${pct}%` }}
                        >
                            {starName(chapter, total).caption}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(StarPath);
