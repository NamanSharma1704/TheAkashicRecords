import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Quest, Theme } from '../../core/types';
import SystemFrame from '../system/SystemFrame';
import ScrambleText from '../system/ScrambleText';
import { InfinitePortalIcon } from '../system/CustomIcons';

/**
 * RETURNED FROM THE GATE (2026-11-14): back from a portal trip of three minutes or more, the
 * System offers to log what was read (gateTrip.ts records the trip; App decides when to ask).
 *
 *   RETURNED FROM THE GATE
 *   ELECEED                        CH 425 → 427   +2
 *   [ +1 ] [ +2 ] [ +5 ] [ TYPE ]            NOT NOW
 *
 * The steps go through App's chapter path like any other (taps merge into one save, Undo on a
 * big jump, the dais pulse, chapter sounds), so the sheet only says what to log. It stays for
 * more taps; left alone it slips away after IDLE_MS, the line along its foot running down that
 * time. Not modal: it never takes focus or blocks the page. Escape inside it closes it.
 *
 * While it is up, its height is published as --return-sheet-h so the toasts stand above it.
 */

const IDLE_MS = 30_000;
const STEPS = [1, 2, 5];

const ReturnSheet: React.FC<{
    theme: Theme;
    quest: Quest;
    /** The chapter when the reader came back, to show how far this sheet has moved it. */
    startChapter: number;
    onStep: (delta: number) => void;
    /** A typed chapter (may raise the total, as typing does everywhere). */
    onType: (chapter: number) => void;
    onClose: () => void;
}> = ({ theme, quest, startChapter, onStep, onType, onClose }) => {
    const reduce = useReducedMotion();
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState('');
    // Bumped by every interaction: it restarts the idle countdown (and its line).
    const [touch, setTouch] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const current = quest.currentChapter;
    const logged = current - startChapter;
    const atTotal = quest.totalChapters > 0 && current >= quest.totalChapters;

    useEffect(() => {
        if (typing) return;
        const t = window.setTimeout(onClose, IDLE_MS);
        return () => window.clearTimeout(t);
    }, [typing, touch, onClose]);

    // Publish the sheet's height for the toasts (SystemToast) while it is up.
    useEffect(() => {
        const el = ref.current;
        const root = document.documentElement;
        if (!el) return;
        const set = () => root.style.setProperty('--return-sheet-h', `${Math.round(el.getBoundingClientRect().height) + 12}px`);
        set();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
        ro?.observe(el);
        return () => { ro?.disconnect(); root.style.removeProperty('--return-sheet-h'); };
    }, []);

    useEffect(() => {
        if (typing) inputRef.current?.focus();
    }, [typing]);

    const step = (delta: number) => { onStep(delta); setTouch((n) => n + 1); };
    const openTyping = () => { setTyped(String(current + 1)); setTyping(true); };
    const commitTyped = () => {
        const n = Math.floor(Number(typed));
        if (!Number.isFinite(n) || n < 0) return;
        onType(n);
        onClose();
    };

    const btn = 'hud hud-btn [--hud-c:6px] h-10 min-w-[3rem] px-3 font-mono text-[12px] font-bold tracking-[0.12em] disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <motion.div
            ref={ref}
            role="dialog"
            aria-modal="false"
            aria-labelledby="return-sheet-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.stopPropagation();
                if (typing) setTyping(false); else onClose();
            }}
            onPointerDown={() => setTouch((n) => n + 1)}
            // Centred by margins, not a translate: motion's own transform would replace it.
            // From lg it docks bottom-right with the toasts (they stand above it), clear of the
            // hero's own portal and chapter controls, which may be another series'.
            className="fixed z-[360] left-3 right-3 bottom-[calc(var(--tabbar-h)+0.75rem)] sm:left-0 sm:right-0 sm:mx-auto sm:w-[27rem] lg:left-auto lg:right-6 lg:mx-0 lg:w-[26rem] lg:bottom-12"
        >
            <SystemFrame theme={theme} level={3}>
                <div className="relative px-4 pt-3.5 pb-4 flex flex-col gap-3">
                    <p className="sr-only" aria-live="polite">
                        {`Returned from the gate: ${quest.title}, chapter ${current}. Log the chapters you read.`}
                    </p>
                    <div className="flex items-center gap-2 text-accent-ink">
                        <InfinitePortalIcon size={14} />
                        <ScrambleText
                            text="RETURNED FROM THE GATE"
                            decodeOnMount
                            maxMs={600}
                            className="font-mono text-[10px] font-bold tracking-[0.3em]"
                        />
                    </div>

                    <div className="flex items-baseline justify-between gap-3 min-w-0">
                        <h2 id="return-sheet-title" className={`font-orbitron font-bold text-[13px] tracking-[0.08em] uppercase truncate ${theme.headingText}`}>
                            {quest.title}
                        </h2>
                        <span className={`shrink-0 font-mono text-[12px] tabular-nums ${theme.mutedText}`}>
                            CH {logged > 0 ? <>{startChapter} → <span className="text-accent-ink font-bold">{current}</span></> : <span className={theme.headingText}>{current}</span>}
                            {logged > 0 && <span className="ml-2 text-accent-ink font-bold">+{logged}</span>}
                        </span>
                    </div>

                    {typing ? (
                        <form
                            className="flex items-center gap-2"
                            onSubmit={(e) => { e.preventDefault(); commitTyped(); }}
                        >
                            <label htmlFor="return-sheet-chapter" className={`font-mono text-[10px] tracking-[0.2em] uppercase ${theme.mutedText}`}>Chapter</label>
                            <input
                                ref={inputRef}
                                id="return-sheet-chapter"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                className={`hud hud-well [--hud-c:6px] h-10 flex-1 min-w-0 px-3 font-mono text-[14px] tabular-nums bg-transparent outline-none ${theme.headingText}`}
                            />
                            <button type="submit" className={`${btn} hud-accent text-accent-ink`}>LOG</button>
                            <button type="button" onClick={() => setTyping(false)} className={`hud hud-ghost [--hud-c:6px] h-10 px-3 font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${theme.mutedText}`}>Back</button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-2">
                            {STEPS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => step(n)}
                                    disabled={atTotal}
                                    aria-label={`Log ${n} chapter${n === 1 ? '' : 's'} of ${quest.title}`}
                                    className={`${btn} hud-accent text-accent-ink`}
                                >
                                    +{n}
                                </button>
                            ))}
                            <button type="button" onClick={openTyping} className={`${btn} ${theme.headingText}`}>TYPE</button>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`hud hud-ghost [--hud-c:6px] ml-auto h-10 px-3 font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${theme.mutedText}`}
                            >
                                {logged > 0 ? 'Done' : 'Not now'}
                            </button>
                        </div>
                    )}

                    {/* The time left before it slips away, restarting with each touch. */}
                    {!typing && !reduce && (
                        <span
                            key={touch}
                            aria-hidden="true"
                            className="absolute left-4 right-4 bottom-1.5 h-px origin-left return-sheet-idle"
                            style={{ background: `rgba(${theme.accentFillRGB},0.55)`, animationDuration: `${IDLE_MS}ms` }}
                        />
                    )}
                </div>
            </SystemFrame>
        </motion.div>
    );
};

export default ReturnSheet;
