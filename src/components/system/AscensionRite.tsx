import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import CoverArt from '../quest/CoverArt';
import RelicFrame from '../quest/RelicFrame';
import ScrambleText from './ScrambleText';
import { useDialogFocus } from '../../utils/useDialogFocus';

export interface RiteSubject {
    id: string;
    title: string;
    coverUrl?: string;
}

/**
 * THE ASCENSION RITE: the moment a series is conquered by hand.
 *
 * Plays once, when ONE series becomes CONQUERED through the editor or the series page's
 * MARK_CONQUERED (App starts it after the save lands). Never for a bulk change, an import or
 * a restore: ten conquests at once would be ten interruptions.
 *
 *   0 ms     the screen dims to a spotlight; the card rises into it; the decree appears,
 *            its headline decoding from glyphs (ScrambleText)
 *   200 ms   runes trace the card's contour
 *   1150 ms  the card flashes and breaks into shards of light
 *   1550 ms  it re-forms as an Ascended Relic (RelicFrame), its name decoding in gold, with
 *            Continue
 *   3.6 s    it closes by itself: about two seconds on the finished relic (it was 5.2 s; the
 *            owner chose 3.6 over 2.8, which left one)
 *
 * Skippable at any point (a tap anywhere, Escape, Continue). Under reduced motion it opens on
 * the finished relic. The stage is dark in both themes, like a theatre, so its inks are fixed.
 */

const RUNES = ['✦', '◈', '⬡', '✧', '❖', '⬢', '✶', '◈', '✦', '⬡'];
// Where the runes sit around the card, in % of its box (just outside the edge).
const RUNE_SPOTS: [number, number][] = [[-7, 8], [-7, 50], [-7, 92], [107, 8], [107, 50], [107, 92], [25, -5], [75, -5], [25, 105], [75, 105]];
const SHARDS = 30;
const PHASE_SHATTER = 1150;
const PHASE_RELIC = 1550;
const AUTO_CLOSE = 3600;

const GOLD = '#e2b552';     // theme-color-ok: relic gold, artwork
const VIOLET = '#a78bfa';   // theme-color-ok: rite violet, artwork on a stage dark in both themes

const AscensionRite: React.FC<{ subject: RiteSubject; onClose: () => void }> = ({ subject, onClose }) => {
    const reduce = useReducedMotion();
    const [phase, setPhase] = useState<'gather' | 'shatter' | 'relic'>(reduce ? 'relic' : 'gather');
    const ref = useRef<HTMLDivElement>(null);
    const continueRef = useRef<HTMLButtonElement>(null);
    useDialogFocus(ref, true, onClose);

    useEffect(() => {
        const timers = reduce ? [] : [
            window.setTimeout(() => setPhase('shatter'), PHASE_SHATTER),
            window.setTimeout(() => setPhase('relic'), PHASE_RELIC),
        ];
        timers.push(window.setTimeout(onClose, AUTO_CLOSE));
        return () => timers.forEach((t) => window.clearTimeout(t));
    }, [reduce, onClose]);

    // Continue is hidden until the relic forms (a hidden control cannot take focus), so focus
    // starts on the rite itself, where Escape already works, and moves to Continue with it.
    useEffect(() => {
        if (phase === 'relic') continueRef.current?.focus({ preventScroll: true });
    }, [phase]);

    // Shards fly out from the card's centre at spread angles; fixed per rite, so a re-render
    // never reshuffles them mid-flight.
    const shards = useMemo(() => Array.from({ length: SHARDS }, (_, i) => {
        const angle = (i / SHARDS) * Math.PI * 2 + (i % 3) * 0.21;
        const dist = 120 + ((i * 47) % 140);
        return {
            dx: `${Math.round(Math.cos(angle) * dist)}px`,
            dy: `${Math.round(Math.sin(angle) * dist)}px`,
            size: 4 + (i % 4) * 2,
            color: i % 3 === 0 ? VIOLET : i % 3 === 1 ? GOLD : '#fff6dc',
            delay: (i % 5) * 18,
        };
    }), []);

    const card = (relic: boolean) => (
        <div className="relative w-full h-full rounded-md overflow-hidden border border-white/10" style={{ boxShadow: relic ? `0 0 60px ${GOLD}55, 0 0 120px ${VIOLET}22` : `0 0 40px ${VIOLET}33` }}>
            <CoverArt url={subject.coverUrl} title={subject.title} size="hero" className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            {relic && <RelicFrame size="large" className="z-10" />}
        </div>
    );

    return (
        <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rite-title"
            aria-describedby="rite-decree"
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-[800] flex items-center justify-center p-6 outline-none cursor-pointer select-none"
        >
            {/* The stage: the room goes dark around a spotlight. */}
            <div
                aria-hidden="true"
                className="absolute inset-0 rite-fade"
                style={{ background: `radial-gradient(ellipse 60% 55% at 50% 48%, rgba(40,28,8,0.55) 0%, rgba(4,3,8,0.94) 62%, rgba(0,0,0,0.97) 100%)`, backdropFilter: 'blur(3px)' }}
            />

            <div className="relative flex flex-col items-center gap-5 max-w-md w-full text-center">
                {/* The decree. */}
                <div id="rite-decree" className="flex flex-col items-center gap-1.5 rite-fade" style={{ '--d': '150ms' } as React.CSSProperties}>
                    <span className="font-mono text-[10px] font-bold tracking-[0.35em]" style={{ color: GOLD }}>[ SYSTEM MANDATE ]</span>
                    <ScrambleText text="THE GATE HAS COLLAPSED." decodeOnMount className="font-orbitron font-black text-lg sm:text-xl tracking-[0.12em] text-white" />
                    <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-white/75">RECORDING ESSENCE INTO THE AKASHIC CODEX.</span>
                </div>

                {/* The card, and what becomes of it. */}
                <div className="relative w-[min(56vw,230px)] aspect-[2/3]">
                    {phase !== 'relic' && (
                        <div className={`absolute inset-0 ${phase === 'shatter' ? 'rite-break' : 'rite-rise'}`}>
                            {card(false)}
                        </div>
                    )}
                    {phase === 'relic' && <div className="absolute inset-0 rite-form">{card(true)}</div>}

                    {/* Runes along the contour, while it gathers. */}
                    {phase === 'gather' && (
                        <>
                            <svg aria-hidden="true" className="absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)] overflow-visible" viewBox="0 0 100 150" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="rite-contour" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor={GOLD} />
                                        <stop offset="100%" stopColor={VIOLET} />
                                    </linearGradient>
                                </defs>
                                <rect x="0.5" y="0.5" width="99" height="149" rx="3" fill="none" stroke="url(#rite-contour)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pathLength={1} className="rite-contour" style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
                            </svg>
                            {RUNE_SPOTS.map(([x, y], i) => (
                                <span
                                    key={i}
                                    aria-hidden="true"
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-lg rite-rune"
                                    style={{ left: `${x}%`, top: `${y}%`, color: i % 2 ? VIOLET : GOLD, textShadow: `0 0 10px ${i % 2 ? VIOLET : GOLD}`, '--d': `${250 + i * 70}ms` } as React.CSSProperties}
                                >
                                    {RUNES[i]}
                                </span>
                            ))}
                        </>
                    )}

                    {/* Shards of light, when it breaks. */}
                    {phase === 'shatter' && shards.map((s, i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 rite-shard"
                            style={{ width: s.size, height: s.size, background: s.color, boxShadow: `0 0 8px ${s.color}`, animationDelay: `${s.delay}ms`, '--dx': s.dx, '--dy': s.dy } as React.CSSProperties}
                        />
                    ))}
                </div>

                {/* The relic, named. */}
                <div className={`flex flex-col items-center gap-3 ${phase === 'relic' ? 'rite-fade' : 'invisible'}`} style={{ '--d': reduce ? '0ms' : '250ms' } as React.CSSProperties}>
                    <h2 id="rite-title" className="font-orbitron font-black text-base sm:text-lg tracking-[0.08em] uppercase leading-tight text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(180deg, #fff6dc, ${GOLD})` }}>
                        {/* Decodes as the relic forms: mounted with the relic phase, not before, or
                            it would finish while still hidden. The glyphs take the relic gold (the
                            letters are transparent, painted by the gradient). */}
                        {phase === 'relic'
                            ? <ScrambleText key="relic-title" text={subject.title} decodeOnMount maxMs={600} glyphClassName="text-[#e2b552]" />
                            : subject.title}
                    </h2>
                    <span className="font-mono text-[10px] font-bold tracking-[0.35em]" style={{ color: GOLD }}>ASCENDED RELIC</span>
                    <button
                        ref={continueRef}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="hud hud-on-plate mt-1 px-5 h-9 font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-white hover:[--hud-plate:rgba(255,255,255,0.1)]"
                        style={{ '--hud-line': `${GOLD}99` } as React.CSSProperties}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AscensionRite;
