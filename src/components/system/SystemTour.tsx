import React, { useLayoutEffect, useRef, useState } from 'react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';
import { useDialogFocus } from '../../utils/useDialogFocus';

interface TourStep {
    /** The `data-tour` key of what this step points at; null for a centred message. */
    target: string | null;
    title: string;
    body: string;
}

const steps = (guest: boolean): TourStep[] => [
    {
        target: null,
        title: 'Welcome, Hunter',
        body: guest
            ? 'The Akashic Records tracks the manhwa you read, run by the System. This archive is a demo: it is yours for the next two hours, and nothing you do here touches the owner\'s library.'
            : 'The Akashic Records tracks the manhwa you read, run by the System. Here is the HUD in six steps.',
    },
    {
        target: 'read',
        title: 'Log a chapter',
        body: 'Press + when you finish a chapter; hold it to count quickly. ENTER PORTAL opens the series on its reading site.',
    },
    {
        target: 'rank',
        title: 'Earn your rank',
        body: 'Every chapter read is 1 EXP. EXP raises your rank from Drifter to Monarch, and reading earns Hunter Titles along the way.',
    },
    {
        target: 'quests',
        title: 'Active quests',
        body: 'The series you are reading now. Tap one to bring it up, drag its handle to reorder, and use New chapters to check for releases.',
    },
    {
        target: 'spire',
        title: 'The Divine Spire',
        body: 'The whole library as a tower: each floor holds the series at one stage of progress. Search, sorting and your daily quests live there.',
    },
    {
        target: 'profile',
        title: 'Hunter Profile',
        body: 'Your rank ladder, titles, reading activity, backups and a shareable Hunter Card. Add a series of your own with CREATE_GATE.',
    },
];

/** The first element tagged for `key` that is actually laid out (desktop and phone each
 *  render their own copy of some controls, and one of the pair is always hidden). */
const findTarget = (key: string): HTMLElement | null =>
    [...document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }) ?? null;

const PAD = 6;

/**
 * SYSTEM TUTORIAL: a short guided pass over the HUD. A visitor arriving from the portfolio
 * lands in a dense interface with no word on ranks, floors or the portal; this names each
 * part in turn. It opens by itself once per guest sandbox and can be replayed from the
 * console bar. Each step rings its target where that target is on screen; where it is not
 * (the phone layout folds some of them away), the step still reads on its own.
 */
const SystemTour: React.FC<{ theme: Theme; guest: boolean; onClose: () => void }> = ({ theme, guest, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    useDialogFocus(ref, true, onClose, nextRef);

    const all = steps(guest);
    const step = all[index];
    const last = index === all.length - 1;

    // Ring this step's target, and keep the ring on it through resizes and scrolls.
    useLayoutEffect(() => {
        const el = step.target ? findTarget(step.target) : null;
        if (!el) { setRect(null); return; }
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const measure = () => setRect(el.getBoundingClientRect());
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [step.target]);

    const go = (to: number) => {
        if (to >= all.length) { onClose(); return; }
        setIndex(Math.max(0, to));
        nextRef.current?.focus({ preventScroll: true });
    };

    // The card sits in the half of the screen the ring is not in; centred without a ring.
    const ringCentre = rect ? rect.top + rect.height / 2 : 0;
    const placement = !rect ? 'items-center' : ringCentre < window.innerHeight / 2 ? 'items-end' : 'items-start';
    const buttonBase = 'h-9 px-3 font-mono text-[10px] font-bold tracking-widest uppercase transition-colors';

    return (
        <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-tour-title"
            aria-describedby="system-tour-body"
            tabIndex={-1}
            className={`fixed inset-0 z-[900] flex justify-center ${placement} p-4 sm:p-8 outline-none`}
            onKeyDown={(e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
            }}
        >
            {/* The scrim: a ring with a shadow that dims everything outside it, or a plain
                wash when this step has nothing on screen to point at. */}
            {rect ? (
                <div
                    aria-hidden="true"
                    className="fixed pointer-events-none rounded-[4px] transition-all duration-300 ease-out"
                    style={{
                        left: rect.left - PAD,
                        top: rect.top - PAD,
                        width: rect.width + PAD * 2,
                        height: rect.height + PAD * 2,
                        border: `2px solid ${theme.accentColor}`,
                        boxShadow: `0 0 0 9999px rgba(0,0,0,0.62), 0 0 28px ${theme.accentColor}66`,
                    }}
                />
            ) : (
                <div aria-hidden="true" className="fixed inset-0 bg-black/60 pointer-events-none" />
            )}

            <div className="relative w-full max-w-md">
                <SystemFrame theme={theme} level={3}>
                    <div className="p-5 flex flex-col gap-3">
                        <div aria-live="polite" className="flex flex-col gap-2">
                            <p className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-accent-ink">
                                System // Tutorial · {index + 1} / {all.length}
                            </p>
                            <h2 id="system-tour-title" className={`font-orbitron text-base font-bold tracking-[0.12em] uppercase ${theme.headingText}`}>
                                {step.title}
                            </h2>
                            <p id="system-tour-body" className={`font-mono text-[12px] leading-relaxed ${theme.mutedText}`}>
                                {step.body}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            {all.map((_, i) => (
                                <span key={i} className={`h-1 flex-1 ${i <= index ? 'bg-accent-solid' : theme.isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            {!last && (
                                <button type="button" onClick={onClose} className={`${buttonBase} mr-auto ${theme.mutedText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                    Skip
                                </button>
                            )}
                            {index > 0 && (
                                <button type="button" onClick={() => go(index - 1)} className={`${buttonBase} ${last ? 'mr-auto' : ''} ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                    Back
                                </button>
                            )}
                            <button
                                ref={nextRef}
                                type="button"
                                onClick={() => go(index + 1)}
                                className={`${buttonBase} border ${theme.border} bg-accent-soft hover:bg-accent-soft-strong`}
                                style={{ color: theme.accentInk }}
                            >
                                {last ? 'Begin' : 'Next'}
                            </button>
                        </div>
                    </div>
                </SystemFrame>
            </div>
        </div>
    );
};

export default SystemTour;
