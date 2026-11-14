import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { QuestGoals, Theme } from '../../core/types';

/**
 * THE MANA RING: today's Divine Mandate, drawn on the ring around the hero (2026-11-13).
 *
 * HeroRings lays it over the theme's own ring (SanctuaryRing on the Void, the ArcaneSigil on
 * Arcanum), on a track of its own just inside the outermost circle. Two arms leave the gate at
 * the top and run down either side, each covering half the circle: 3 of 5 stories lights three
 * fifths of each. When the mandate clears they meet at the seal at the bottom and the ring
 * closes, and the ring flares once as the streak's supernova plays on the toast.
 *
 * The arc is data, nothing else: it is the quest's own progress (GET /api/user/state). A tick
 * marks each unit of the target when there are few enough to count (up to 24).
 *
 *   - While a view covers the dashboard (`hold`), the ring keeps the last progress it showed and
 *     fills when the dashboard comes back, so the reader sees it happen.
 *   - In low-power mode (`still`) and under reduced motion it is set, not drawn: no growth and
 *     no flare.
 *   - A new day starts a new ring without animating back to empty.
 *
 * On a phone held upright the ring's sides run off the screen (see HeroRings), so there it reads
 * at the gate and the seal; the quest panel carries the numbers.
 */

const MAX_TICKS = 24;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const ManaRing: React.FC<{
    theme: Theme;
    /** The ring's diameter in px (HeroRings measures it). */
    d: number;
    mandate: QuestGoals['daily'];
    /** The reader's day the progress counts towards. */
    day: string;
    /** Low-power mode: held still. */
    still: boolean;
    /** A view covers the dashboard: keep showing the last progress until it is seen again. */
    hold: boolean;
    className?: string;
}> = ({ theme, d, mandate, day, still, hold, className = '' }) => {
    const reduce = useReducedMotion();
    const target = Math.max(1, mandate.target);
    const frac = Math.min(1, Math.max(0, mandate.progress / target));

    // What the ring shows: the live progress, except while the dashboard is covered.
    const [shown, setShown] = useState({ frac, day });
    useEffect(() => {
        if (!hold) setShown({ frac, day });
    }, [frac, day, hold]);

    // The flare: the ring closing, seen, on the same day it was open.
    const before = useRef(shown);
    const [flare, setFlare] = useState(0);
    useEffect(() => {
        const prev = before.current;
        if (prev.day === shown.day && prev.frac < 1 && shown.frac >= 1 && !still && !reduce) setFlare((n) => n + 1);
        before.current = shown;
    }, [shown, still, reduce]);

    if (d <= 0) return null;

    const c = d / 2;
    const r = c * 0.96;
    const C = 2 * Math.PI * r;
    const f = shown.frac;
    const closed = f >= 1;
    const arm = (f * C) / 2;
    const deg = f * 180;
    const rgb = theme.accentFillRGB;
    const lit = theme.isDark ? 0.68 : 0.82;
    const animate = !still && !reduce;
    const glide = animate ? `stroke-dasharray 1200ms ${EASE}` : 'none';
    const turn = animate ? `transform 1200ms ${EASE}` : 'none';

    // The two arms: one circle turned to start at the top, and its mirror image.
    const right = `rotate(-90 ${c} ${c})`;
    const left = `translate(${d} 0) scale(-1 1) rotate(-90 ${c} ${c})`;

    const ticks = target > 1 && target <= MAX_TICKS
        ? Array.from({ length: target - 1 }, (_, i) => {
            const k = i + 1;
            const a = (k / target) * Math.PI;
            const on = k / target <= f + 1e-9;
            return [1, -1].map((side) => {
                const sx = Math.sin(a) * side;
                const cy = -Math.cos(a);
                return (
                    <line
                        key={`${k}${side}`}
                        x1={c + sx * (r - 6)} y1={c + cy * (r - 6)}
                        x2={c + sx * (r + 6)} y2={c + cy * (r + 6)}
                        stroke={`rgba(${rgb},${on ? 0.85 : 0.22})`}
                        strokeWidth="1"
                    />
                );
            });
        })
        : null;

    const diamond = (x: number, y: number, s: number) => `M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`;

    return (
        <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
            <svg viewBox={`0 0 ${d} ${d}`} className="w-full h-full" style={{ overflow: 'visible' }}>
                {/* The track. */}
                <circle cx={c} cy={c} r={r} fill="none" stroke={`rgba(${rgb},${theme.isDark ? 0.1 : 0.12})`} strokeWidth="1" />

                {/* The arms, keyed by day so a new day starts empty instead of draining. */}
                <g key={shown.day}>
                    {arm > 0.5 && [right, left].map((t) => (
                        <g key={t} transform={t}>
                            <circle
                                cx={c} cy={c} r={r} fill="none"
                                stroke={`rgba(${rgb},${closed ? 0.24 : 0.16})`} strokeWidth="8"
                                strokeDasharray={`${arm} ${C}`}
                                style={{ transition: glide }}
                            />
                            <circle
                                cx={c} cy={c} r={r} fill="none"
                                stroke={`rgba(${rgb},${lit})`} strokeWidth="2.5"
                                strokeDasharray={`${arm} ${C}`}
                                style={{ transition: glide }}
                            />
                        </g>
                    ))}

                    {/* The heads: where each arm has reached. Gone once the ring is closed. */}
                    {f > 0 && !closed && [deg, -deg].map((a) => (
                        <g key={a > 0 ? 'r' : 'l'} style={{ transform: `rotate(${a}deg)`, transformOrigin: `${c}px ${c}px`, transition: turn }}>
                            <path d={diamond(c, c - r, 4)} fill={theme.isDark ? '#ffffff' : `rgb(${rgb})`} stroke={`rgba(${rgb},0.9)`} strokeWidth="1" />
                        </g>
                    ))}
                </g>

                {ticks}

                {/* The gate at the top, where the arms leave; the seal at the bottom, where they meet. */}
                <path d={diamond(c, c - r, 5)} fill={theme.isDark ? 'rgba(4,3,8,0.9)' : 'rgba(255,255,255,0.9)'} stroke={`rgba(${rgb},0.55)`} strokeWidth="1" />
                <path
                    d={diamond(c, c + r, 5)}
                    fill={closed ? `rgb(${rgb})` : (theme.isDark ? 'rgba(4,3,8,0.9)' : 'rgba(255,255,255,0.9)')}
                    stroke={`rgba(${rgb},${closed ? 0.95 : 0.35})`}
                    strokeWidth="1"
                />

                {/* The flare as the ring closes. */}
                {flare > 0 && (
                    <circle key={flare} cx={c} cy={c} r={r} fill="none" stroke={`rgb(${rgb})`} className="mana-flare" />
                )}
            </svg>
        </div>
    );
};

export default React.memo(ManaRing);
