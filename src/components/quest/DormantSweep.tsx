import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';
import SystemFrame from '../system/SystemFrame';
import ScrambleText from '../system/ScrambleText';
import CoverArt from './CoverArt';
import { useDialogFocus } from '../../utils/useDialogFocus';

/**
 * THE DORMANT GATE SWEEP (2026-11-14): once a week, the Active series with no chapter read in
 * 30 days, to be filed in one go. The server finds them and paces the sweep (GET/POST
 * /api/user/dormant); App applies the choices through the bulk status route, with one Undo.
 *
 * Each gate defaults to KEEP (nothing changes unless the reader chooses), and keeping one tells
 * the System to leave it alone for another 30 days. LATER puts the whole sweep off a week.
 * Every number is the record's own: days since the last chapter read forward, the chapter, how
 * far behind, the tracker's new chapters.
 */

export interface DormantGate {
    id: string;
    title: string;
    coverUrl: string;
    currentChapter: number;
    totalChapters: number;
    newChapters: number;
    /** The last chapter read forward (epoch ms). */
    lastReadAt: number;
}

const CHOICES = [
    { status: 'ACTIVE', label: 'Keep', plain: 'Keep it Active (asked again in 30 days)' },
    { status: 'STASIS', label: 'Stasis', plain: 'On hold' },
    { status: 'CONQUERED', label: 'Conquered', plain: 'Finished' },
    { status: 'SEVERED', label: 'Severed', plain: 'Dropped' },
] as const;
type Choice = typeof CHOICES[number]['status'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** One gate's choice: a radio group of chips, arrow keys moving between them. */
const ChoiceGroup: React.FC<{ title: string; value: Choice; onChange: (c: Choice) => void; theme: Theme }> = ({ title, value, onChange, theme }) => {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const move = (from: number, step: number) => {
        const next = (from + step + CHOICES.length) % CHOICES.length;
        onChange(CHOICES[next].status);
        refs.current[next]?.focus();
    };
    return (
        <div role="radiogroup" aria-label={`File ${title}`} className="grid grid-cols-4 gap-1.5">
            {CHOICES.map((c, i) => {
                const on = value === c.status;
                return (
                    <button
                        key={c.status}
                        ref={(el) => { refs.current[i] = el; }}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        title={c.plain}
                        onClick={() => onChange(c.status)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
                        }}
                        className={`hud hud-chip [--hud-c:5px] h-8 px-1 flex items-center justify-center font-mono text-[10px] font-bold tracking-[0.1em] sm:tracking-[0.16em] uppercase ${on ? 'text-accent-ink' : theme.mutedText}`}
                    >
                        {c.label}
                    </button>
                );
            })}
        </div>
    );
};

const DormantSweep: React.FC<{
    theme: Theme;
    gates: DormantGate[];
    /** File the gates: the status changes, and the ones kept Active. Resolves true once saved. */
    onApply: (changes: Record<string, string>, kept: string[]) => Promise<boolean>;
    /** Not now: ask again in a week. */
    onLater: () => void;
}> = ({ theme, gates, onApply, onLater }) => {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(ref, true, onLater);
    const [choice, setChoice] = useState<Record<string, Choice>>(() => Object.fromEntries(gates.map((g) => [g.id, 'ACTIVE' as Choice])));
    const [busy, setBusy] = useState(false);
    const now = useMemo(() => Date.now(), []);

    const changes = Object.fromEntries(Object.entries(choice).filter(([, s]) => s !== 'ACTIVE'));
    const changed = Object.keys(changes).length;
    const setAll = (c: Choice) => setChoice(Object.fromEntries(gates.map((g) => [g.id, c])));

    const apply = async () => {
        if (busy) return;
        setBusy(true);
        const kept = gates.filter((g) => choice[g.id] === 'ACTIVE').map((g) => g.id);
        const ok = await onApply(changes, kept);
        if (!ok) setBusy(false);
    };

    return (
        <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dormant-sweep-title"
            aria-describedby="dormant-sweep-note"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onLater(); }}
            className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 pt-[max(0.75rem,var(--safe-top))] outline-none"
        >
            {/* SystemFrame fills its parent's height: this box is sized by the content. */}
            <div className="w-full max-w-xl">
            <SystemFrame
                theme={theme}
                variant="full"
                level={3}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            >
                <div className="flex flex-col max-h-[calc(var(--app-h)-var(--safe-top)-2rem)]">
                    {/* Header */}
                    <div className={`px-5 pt-4 pb-3 border-b ${theme.borderSubtle} shrink-0`}>
                        <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-accent-ink">[ SYSTEM // WEEKLY SWEEP ]</p>
                        <h2 id="dormant-sweep-title" className={`mt-1.5 font-orbitron font-black text-[15px] sm:text-lg tracking-[0.08em] sm:tracking-[0.1em] uppercase ${theme.headingText}`}>
                            <ScrambleText text={`Dormant gates detected · ${gates.length}`} decodeOnMount maxMs={700} glyphClassName="text-accent-ink" />
                        </h2>
                        <p id="dormant-sweep-note" className={`mt-1.5 font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                            Active series with no chapter read in 30 days. File each, or keep it active; nothing changes until you apply.
                        </p>
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className={`font-mono text-[9px] font-bold tracking-[0.25em] uppercase ${theme.mutedText}`}>All:</span>
                            {CHOICES.map((c) => (
                                <button
                                    key={c.status}
                                    type="button"
                                    onClick={() => setAll(c.status)}
                                    title={`Set every gate to ${c.label}`}
                                    className={`hud hud-ghost [--hud-c:5px] h-7 px-2 font-mono text-[9px] font-bold tracking-[0.18em] uppercase ${theme.mutedText}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* The gates */}
                    <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 flex flex-col gap-2">
                        {gates.map((g) => {
                            const days = Math.max(30, Math.floor((now - g.lastReadAt) / DAY_MS));
                            const caughtUp = g.totalChapters > 0 && g.currentChapter >= g.totalChapters;
                            const left = g.totalChapters > 0 ? g.totalChapters - g.currentChapter : null;
                            return (
                                <li key={g.id} className="hud hud-row [--hud-c:8px] px-3 py-2.5 flex flex-col gap-2.5">
                                    <div className="flex gap-3 items-start">
                                    <CoverArt
                                        url={g.coverUrl}
                                        title={g.title}
                                        size="thumb"
                                        className={`w-9 h-[50px] flex-none rounded-sm border ${theme.isDark ? 'border-gray-800' : 'border-gray-300'}`}
                                    />
                                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                        <div className="flex items-baseline justify-between gap-2 min-w-0">
                                            <span className={`font-mono text-[11px] font-bold uppercase leading-tight line-clamp-1 ${theme.headingText}`}>{g.title}</span>
                                            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-accent-ink">{days} DAYS</span>
                                        </div>
                                        <div className={`flex items-center gap-2 font-mono text-[10px] tabular-nums ${theme.mutedText}`}>
                                            <span>CH {g.currentChapter}{g.totalChapters > 0 ? ` / ${g.totalChapters}` : ''}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{caughtUp ? 'CAUGHT UP' : left !== null ? `${left} LEFT` : 'NO TOTAL'}</span>
                                            {g.newChapters > 0 && (
                                                <span className="hud hud-tag px-1.5 text-[9px] font-bold tracking-widest leading-[15px]">+{g.newChapters} NEW</span>
                                            )}
                                        </div>
                                    </div>
                                    </div>
                                    <ChoiceGroup title={g.title} value={choice[g.id]} onChange={(c) => setChoice((prev) => ({ ...prev, [g.id]: c }))} theme={theme} />
                                </li>
                            );
                        })}
                    </ul>

                    {/* Footer */}
                    <div className={`px-4 py-3 border-t ${theme.borderSubtle} shrink-0 flex items-center gap-3`}>
                        <button
                            type="button"
                            onClick={onLater}
                            disabled={busy}
                            title="Ask again next week"
                            className={`hud hud-ghost [--hud-c:6px] h-10 px-4 font-mono text-[10px] font-bold tracking-[0.22em] uppercase ${theme.mutedText}`}
                        >
                            Later
                        </button>
                        <button
                            type="button"
                            onClick={apply}
                            disabled={busy}
                            className="hud hud-cmd hud-hash ml-auto h-10 pl-5 pr-12 font-orbitron font-black text-[11px] tracking-[0.2em] uppercase disabled:opacity-50"
                        >
                            {busy ? 'Filing…' : changed ? `Apply · ${changed} change${changed === 1 ? '' : 's'}` : 'Keep all active'}
                        </button>
                    </div>
                </div>
            </SystemFrame>
            </div>
        </motion.div>
    );
};

export default DormantSweep;
