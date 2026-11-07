import React, { useLayoutEffect, useRef, useState } from 'react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';
import { useDialogFocus } from '../../utils/useDialogFocus';
import { TourId } from '../../core/tours';
import { TOUR_NAMES, tourSteps } from './tourSteps';

/** The element tagged for `key` that is laid out, preferring one on screen, and among those
 *  one marked `data-tour-prefer`. Desktop and phone render their own copy of some controls;
 *  usually one of the pair is hidden, but on a phone the sidebar's Spire and Profile buttons
 *  are laid out too (and can be scrolled into view by an earlier step), while the tab bar's,
 *  marked preferred, are the ones to point at. */
const findTarget = (key: string): HTMLElement | null => {
    const laidOut = [...document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    const onScreen = laidOut.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    });
    return onScreen.find((el) => el.hasAttribute('data-tour-prefer')) ?? onScreen[0] ?? laidOut[0] ?? null;
};

const PAD = 6;

/**
 * SYSTEM TUTORIAL: a short guided pass over one page (the steps live in core/tours.ts). A
 * visitor arriving from the portfolio lands in a dense interface with no word on ranks,
 * floors or the portal; this names each part in turn. Each step rings its target where that
 * target is on screen; where it is not (the phone layout folds some away), the step still
 * reads on its own.
 */
const SystemTour: React.FC<{ theme: Theme; id: TourId; guest: boolean; onClose: () => void }> = ({ theme, id, guest, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    useDialogFocus(ref, true, onClose, nextRef);

    const all = tourSteps(id, guest);
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
        // A target can change size under the ring (a panel still loading its data grows once
        // it arrives), which neither event reports.
        const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        resized?.observe(el);
        // Nor does a page's own entrance (the editor zooms in, the profile's panels rise): a
        // transform moves the box without resizing it. Measure again once that has played.
        const settle = window.setTimeout(measure, 450);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
            resized?.disconnect();
            window.clearTimeout(settle);
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
                                System // {TOUR_NAMES[id]} · {index + 1} / {all.length}
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
