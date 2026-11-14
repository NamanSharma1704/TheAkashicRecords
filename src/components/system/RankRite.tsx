import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';
import { AVATAR_STAGES, avatarStageOf, USER_RANKS, TRANSCENDENT_FROM } from '../../utils/ranks';
import EntityAvatar from './EntityAvatar';
import ScrambleText from './ScrambleText';
import { useDialogFocus } from '../../utils/useDialogFocus';

export interface RankRiteSubject {
    /** The rank left behind and the rank reached (USER_RANKS labels). */
    from: string;
    to: string;
    exp: number;
}

/**
 * THE RANK ASCENSION: the moment the avatar's frame evolves (BEYOND MONARCH, 2026-11-13).
 *
 * App plays it when a rank earned while reading opens a new frame stage (AvatarStage.tsx): every
 * second rank up to MONARCH, and every Transcendent tier after it. Other rank-ups keep their
 * toast. Staged like the Ascension Rite, around the avatar instead of a cover:
 *
 *   0 ms     the screen dims to a spotlight; the decree decodes; the avatar rises in its old frame
 *   250 ms   System glyphs gather around it
 *   1150 ms  the old frame breaks into shards of light
 *   1450 ms  the avatar re-forms in its new frame; the rank's name decodes, with the frame's name
 *   3.6 s    it closes by itself (as the Ascension Rite)
 *
 * In the THEME's accent, never the relic's gold: gold on the light theme belongs to conquered
 * series only. The stage is dark in both themes, so its inks are the plate inks. Skippable at any
 * point (a tap, Escape, Continue); under reduced motion it opens on the new frame.
 */

const GLYPHS = ['✦', '◈', '⬡', '✧', '❖', '⬢', '◇', '✶'];
const SHARDS = 24;
const PHASE_SHATTER = 1150;
const PHASE_FORM = 1450;
const AUTO_CLOSE = 3600;

const RankRite: React.FC<{ subject: RankRiteSubject; theme: Theme; onClose: () => void }> = ({ subject, theme, onClose }) => {
    const reduce = useReducedMotion();
    const [phase, setPhase] = useState<'gather' | 'shatter' | 'form'>(reduce ? 'form' : 'gather');
    const ref = useRef<HTMLDivElement>(null);
    const continueRef = useRef<HTMLButtonElement>(null);
    useDialogFocus(ref, true, onClose);

    useEffect(() => {
        const timers = reduce ? [] : [
            window.setTimeout(() => setPhase('shatter'), PHASE_SHATTER),
            window.setTimeout(() => setPhase('form'), PHASE_FORM),
        ];
        timers.push(window.setTimeout(onClose, AUTO_CLOSE));
        return () => timers.forEach((t) => window.clearTimeout(t));
    }, [reduce, onClose]);

    useEffect(() => {
        if (phase === 'form') continueRef.current?.focus({ preventScroll: true });
    }, [phase]);

    const accent = theme.accentColor;
    const ink = theme.accentPlateInk;
    const stage = AVATAR_STAGES[avatarStageOf(subject.to)];
    const index = USER_RANKS.findIndex((r) => r.label === subject.to);
    const next = USER_RANKS[index + 1];
    const transcendent = index >= TRANSCENDENT_FROM;

    const shards = useMemo(() => Array.from({ length: SHARDS }, (_, i) => {
        const angle = (i / SHARDS) * Math.PI * 2 + (i % 3) * 0.19;
        const dist = 100 + ((i * 41) % 120);
        return {
            dx: `${Math.round(Math.cos(angle) * dist)}px`,
            dy: `${Math.round(Math.sin(angle) * dist)}px`,
            size: 3 + (i % 4) * 2,
            color: i % 2 ? accent : '#ffffff',
            delay: (i % 5) * 16,
        };
    }), [accent]);

    // Glyphs on a ring around the avatar, in % of its box.
    const glyphSpots = useMemo(() => GLYPHS.map((_, i) => {
        const a = (i / GLYPHS.length) * Math.PI * 2 - Math.PI / 2;
        return [50 + Math.cos(a) * 66, 50 + Math.sin(a) * 66] as [number, number];
    }), []);

    return (
        <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rank-rite-title"
            aria-describedby="rank-rite-decree"
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-[800] flex items-center justify-center p-6 pt-[max(1.5rem,var(--safe-top))] outline-none cursor-pointer select-none"
        >
            {/* The stage: dark in both themes, the spotlight tinted by the accent. The glow is its
                own layer over a dark floor, so the light theme's page never shows through it. */}
            <div
                aria-hidden="true"
                className="absolute inset-0 rite-fade"
                style={{ background: `radial-gradient(ellipse 55% 50% at 50% 46%, rgba(${theme.accentFillRGB},0.2) 0%, rgba(${theme.accentFillRGB},0) 62%), radial-gradient(ellipse 60% 55% at 50% 46%, rgba(10,7,18,0.9) 0%, rgba(4,3,8,0.95) 60%, rgba(0,0,0,0.97) 100%)`, backdropFilter: 'blur(3px)' }}
            />

            <div className="relative flex flex-col items-center gap-6 max-w-md w-full text-center">
                <div id="rank-rite-decree" className="flex flex-col items-center gap-1.5 rite-fade" style={{ '--d': '120ms' } as React.CSSProperties}>
                    <span className="font-mono text-[10px] font-bold tracking-[0.35em]" style={{ color: ink }}>[ SYSTEM MANDATE ]</span>
                    <ScrambleText text={transcendent ? 'TRANSCENDENCE.' : 'RANK ASCENSION.'} decodeOnMount className="font-orbitron font-black text-lg sm:text-xl tracking-[0.12em] text-white" />
                    <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-white/75">{subject.exp.toLocaleString()} CHAPTERS ABSORBED.</span>
                </div>

                {/* The avatar: the old frame, then the new. */}
                <div className="relative w-[168px] h-[168px]">
                    {phase !== 'form' && (
                        <div className={`absolute inset-0 ${phase === 'shatter' ? 'rite-break' : 'rite-rise'}`}>
                            <EntityAvatar theme={theme} size={168} rank={subject.from} />
                        </div>
                    )}
                    {phase === 'form' && (
                        <div className="absolute inset-0 rite-form" style={{ filter: `drop-shadow(0 0 28px rgba(${theme.accentFillRGB},0.45))` }}>
                            <EntityAvatar theme={theme} size={168} rank={subject.to} />
                        </div>
                    )}

                    {phase === 'gather' && glyphSpots.map(([x, y], i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            className="absolute -translate-x-1/2 -translate-y-1/2 text-lg rite-rune"
                            style={{ left: `${x}%`, top: `${y}%`, color: i % 2 ? '#ffffff' : accent, textShadow: `0 0 10px ${accent}`, '--d': `${250 + i * 80}ms` } as React.CSSProperties}
                        >
                            {GLYPHS[i]}
                        </span>
                    ))}

                    {phase === 'shatter' && shards.map((s, i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 rite-shard"
                            style={{ width: s.size, height: s.size, background: s.color, boxShadow: `0 0 8px ${s.color}`, animationDelay: `${s.delay}ms`, '--dx': s.dx, '--dy': s.dy } as React.CSSProperties}
                        />
                    ))}
                </div>

                {/* The rank, named. */}
                <div className={`flex flex-col items-center gap-2 ${phase === 'form' ? 'rite-fade' : 'invisible'}`} style={{ '--d': reduce ? '0ms' : '200ms' } as React.CSSProperties}>
                    <h2 id="rank-rite-title" className="font-orbitron font-black text-2xl sm:text-3xl tracking-[0.1em] uppercase leading-tight text-white" style={{ textShadow: `0 0 18px ${accent}` }}>
                        {phase === 'form'
                            ? <ScrambleText key="rank-title" text={subject.to} decodeOnMount maxMs={600} glyphClassName="text-accent-plate" />
                            : subject.to}
                    </h2>
                    <span className="font-mono text-[10px] font-bold tracking-[0.3em]" style={{ color: ink }}>FRAME EVOLVES · {stage}</span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-white/70">
                        {next ? `NEXT: ${next.label} AT ${next.minExp.toLocaleString()} EXP` : 'THE LAST RANK THE SYSTEM KNOWS.'}
                    </span>
                    <button
                        ref={continueRef}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="hud hud-on-plate mt-2 px-5 h-9 font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-white hover:[--hud-plate:rgba(255,255,255,0.1)]"
                        style={{ '--hud-line': `rgba(${theme.accentFillRGB},0.7)` } as React.CSSProperties}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RankRite;
