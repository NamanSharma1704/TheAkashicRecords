import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { QuestGoals, Theme } from '../../core/types';
import { ringInset, scaleOf } from './manaGeometry';

/**
 * THE MANA RING: today's Divine Mandate, drawn on the ring around the hero (2026-11-13).
 *
 * HeroRings lays it over the theme's own ring (SanctuaryRing on the Void, the ArcaneSigil on
 * Arcanum), on a track of its own just inside the outermost circle. Two arms leave the gate at
 * the top and run down either side, each covering half the circle: 3 of 5 stories lights three
 * fifths of each. When the mandate clears they meet at the seal at the bottom and the ring
 * closes, and the ring flares once as the streak's supernova plays on the toast.
 *
 * Its shape (2026-11-14, the owner: circular, not plain, and otherworldly): a gate circle in the
 * language of the Mage's summoning dais. A band of rune marks runs between two rails, the outer
 * one graduated; the arms light the band from the gate down, runes and rails together, with mana
 * orbs at their heads; a sealed node marks the end of each unit of the mandate (when there are
 * few enough to count, up to 24 a side) and lights as the arm passes it; the gate and the seal
 * are star medallions, the seal lit once the ring closes.
 *
 * The arc is data, nothing else: it is the quest's own progress (GET /api/user/state).
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

/** A sealed node at the end of each unit, up to this many a side. */
const MAX_SEALS = 24;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const f1 = (n: number) => +n.toFixed(1);

type Pt = readonly [number, number];
/** Rune marks as polylines in a 10 x 14 box about the origin, y up negative: line glyphs, not
 *  any real script (the same family as the Mage dais's). */
const RUNES: Pt[][][] = [
    [[[0, -7], [0, 7]], [[-4, -3], [4, 3]]],
    [[[-4, -7], [-4, 7]], [[-4, -7], [4, 0], [-4, 7]]],
    [[[-4, 7], [0, -7], [4, 7]], [[-2, 1], [2, 1]]],
    [[[0, -7], [0, 7]], [[-4, -7], [4, -1]]],
    [[[-4, -7], [4, 7]], [[4, -7], [-4, 7]]],
    [[[-4, -6], [4, -6], [-4, 6], [4, 6]]],
    [[[0, -7], [4, 0], [0, 7], [-4, 0], [0, -7]]],
    [[[-4, 7], [-4, -7], [0, -3], [4, -7], [4, 7]]],
];

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
    const maskId = `mana-lit-${useId().replace(/:/g, '')}`;
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

    // The gate circle's carved parts, in px, each as one path: the runes, the graduation, the
    // unit seals' places.
    const units = target <= MAX_SEALS ? target : 0;
    const gate = useMemo(() => {
        if (d <= 0) return null;
        const c = d / 2;
        const s = scaleOf(d);
        const h = 5 * s, medal = 13 * s, node = 5 * s;
        // The radius keeps the whole ring on the screen: the gate's rays (30 units out) under its
        // top edge, and the seal clear of the dashboard's footer strip (about 32 px) at its foot.
        const r = c - ringInset(d);
        // Degrees clockwise from the top; out: away from the centre, along: clockwise.
        const at = (deg: number, rad: number, along = 0, out = 0): Pt => {
            const a = (deg * Math.PI) / 180, sn = Math.sin(a), cs = Math.cos(a);
            return [c + rad * sn + along * cs + out * sn, c - rad * cs + along * sn - out * cs];
        };
        const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;
        const sealAngles = Array.from({ length: Math.max(0, units - 1) }, (_, i) => ((i + 1) * 180) / units);
        // Where the band parts, in degrees either side: around the gate and the seal (whose
        // medallions are open linework, so nothing may run through them) and each unit's node.
        const toDeg = (px: number) => (px / r) * (180 / Math.PI);
        const gateGap = toDeg(medal + 3), nodeGap = toDeg(node + 2.5);
        const gaps: [number, number][] = [[180, gateGap], ...sealAngles.flatMap((a): [number, number][] => [[a, nodeGap], [360 - a, nodeGap]])];
        const inGap = (deg: number, pad = 0) => Math.abs(((deg + 540) % 360) - 180) > 180 - gateGap - pad
            || gaps.some(([m, w]) => Math.abs(((deg - m + 540) % 360) - 180) < w + pad);
        const arc = (a0: number, a1: number, rad: number) => {
            const mid = (a0 + a1) / 2;
            return `M${P(at(a0, rad))}A${f1(rad)} ${f1(rad)} 0 0 1 ${P(at(mid, rad))}A${f1(rad)} ${f1(rad)} 0 0 1 ${P(at(a1, rad))}`;
        };
        // A rail: arcs from gap to gap, starting past the gate.
        const rail = (rad: number) => {
            const cuts = gaps.map(([m, w]) => [m - w, m + w]).sort((a, b) => a[0] - b[0]);
            let p = '', from = gateGap;
            for (const [a0, a1] of cuts) { if (a0 > from) p += arc(from, a0, rad); from = a1; }
            return p + arc(from, 360 - gateGap, rad);
        };
        // Runes about every 17 px, none in a gap.
        const n = Math.max(24, Math.round((2 * Math.PI * r) / (17 * s) / 2) * 2);
        let runes = '';
        for (let i = 0; i < n; i++) {
            const deg = ((i + 0.5) * 360) / n;
            if (inGap(deg, toDeg(4 * s))) continue;
            for (const line of RUNES[(i * 5 + 3) % RUNES.length]) {
                runes += line.map(([x, y], j) => `${j ? 'L' : 'M'}${P(at(deg, r, x * 0.42 * s, -y * 0.42 * s))}`).join('');
            }
        }
        let ticks = '';
        for (let i = 0; i < 120; i++) {
            const deg = i * 3, long = i % 5 === 0;
            if (inGap(deg)) continue;
            ticks += `M${P(at(deg, r + h))}L${P(at(deg, r + h + (long ? 4 : 2) * s))}`;
        }
        return { c, r, s, h, medal, node, runes, ticks, outer: rail(r + h), inner: rail(r - h), sealAngles, at, P };
    }, [d, units]);

    if (!gate) return null;

    const { c, r, s, h, medal, node, runes, ticks, outer, inner, sealAngles, at, P } = gate;
    const C = 2 * Math.PI * r;
    const f = shown.frac;
    const closed = f >= 1;
    const arm = (f * C) / 2;
    const deg = f * 180;
    const rgb = theme.accentFillRGB;
    const animate = !still && !reduce;
    const glide = animate ? `stroke-dasharray 1200ms ${EASE}` : 'none';
    const turn = animate ? `transform 1200ms ${EASE}` : 'none';
    const hot = theme.isDark ? '#fff4d6' : '#ffffff';

    // The lit half-circles: one circle turned to start at the top, and its mirror image.
    const right = `rotate(-90 ${c} ${c})`;
    const left = `translate(${d} 0) scale(-1 1) rotate(-90 ${c} ${c})`;

    const star = (x: number, y: number, rad: number, n: number, k: number) => {
        let p = '';
        for (let j = 0; j < n; j++) {
            const a = -Math.PI / 2 + ((j * k) % n) * ((2 * Math.PI) / n);
            p += `${j ? 'L' : 'M'}${f1(x + rad * Math.cos(a))} ${f1(y + rad * Math.sin(a))}`;
        }
        return `${p}Z`;
    };
    const tri = (x: number, y: number, rad: number) => star(x, y, rad, 3, 1);

    /** The band itself: rails, graduation, runes. Drawn dim, then again lit under the mask. */
    const band = (alpha: number, runeAlpha: number) => (
        <>
            <path d={outer} fill="none" stroke={`rgba(${rgb},${alpha})`} strokeWidth="0.9" />
            <path d={inner} fill="none" stroke={`rgba(${rgb},${alpha * 0.8})`} strokeWidth="0.7" />
            <path d={ticks} fill="none" stroke={`rgba(${rgb},${alpha})`} strokeWidth="0.8" />
            <path d={runes} fill="none" stroke={`rgba(${rgb},${runeAlpha})`} strokeWidth="0.9" strokeLinejoin="round" />
        </>
    );

    return (
        <div className={`pointer-events-none absolute ${className}`} aria-hidden="true" data-mana-ring="">
            <svg viewBox={`0 0 ${d} ${d}`} className="w-full h-full" style={{ overflow: 'visible' }}>
                <defs>
                    {/* What is lit: the two arms, as wide strokes along the ring. */}
                    <mask id={maskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={d + 40} height={d + 40}>
                        <g key={shown.day}>
                            {arm > 0.5 && [right, left].map((t) => (
                                <g key={t} transform={t}>
                                    <circle cx={c} cy={c} r={r} fill="none" stroke="#fff" strokeWidth={2 * h + 14 * s} strokeDasharray={`${arm} ${C}`} style={{ transition: glide }} />
                                </g>
                            ))}
                        </g>
                    </mask>
                </defs>

                {/* The gate circle, unlit. */}
                {band(theme.isDark ? 0.2 : 0.24, theme.isDark ? 0.22 : 0.26)}

                {/* Lit: a band of mana, and the circle again in full light. Static: the ring sits
                    on the dashboard all day, and a breathing glow would repaint it every frame. */}
                <g mask={`url(#${maskId})`}>
                    <circle cx={c} cy={c} r={r} fill="none" stroke={`rgba(${rgb},${theme.isDark ? 0.12 : 0.1})`} strokeWidth={2 * h} />
                    <g style={{ filter: `drop-shadow(0 0 ${f1(2 * s)}px rgba(${rgb},0.7))` }}>
                        {band(0.95, 1)}
                    </g>
                </g>

                {/* A sealed node at the end of each unit, lit once the arm has passed it. */}
                {sealAngles.map((a) => [a, -a].map((g) => {
                    const on = a / 180 <= f + 1e-9;
                    const [x, y] = at(g, r);
                    return (
                        <g key={g}>
                            <circle cx={f1(x)} cy={f1(y)} r={f1(node)} fill="none" stroke={`rgba(${rgb},${on ? 0.95 : 0.45})`} strokeWidth="0.9" />
                            <path d={tri(x, y, node * 0.55)} fill={on ? `rgba(${rgb},0.95)` : 'none'} stroke={`rgba(${rgb},${on ? 0.95 : 0.45})`} strokeWidth="1" />
                        </g>
                    );
                }))}

                {/* The heads: mana orbs where each arm has reached. Gone once the ring is closed. */}
                <g key={`${shown.day}-heads`}>
                    {f > 0 && !closed && [deg, -deg].map((a) => (
                        <g key={a > 0 ? 'r' : 'l'} style={{ transform: `rotate(${a}deg)`, transformOrigin: `${c}px ${c}px`, transition: turn }}>
                            <circle cx={c} cy={c - r} r={f1(8 * s)} fill={`rgba(${rgb},0.2)`} />
                            <circle cx={c} cy={c - r} r={f1(3.4 * s)} fill={hot} stroke={`rgba(${rgb},0.95)`} strokeWidth="1" />
                        </g>
                    ))}
                </g>

                {/* The gate at the top, where the arms leave, and the seal at the bottom, where
                    they meet: star medallions, the seal lit once the ring closes. */}
                {([[c - r, true], [c + r, closed]] as const).map(([y, on], i) => (
                    <g key={i}>
                        <circle cx={c} cy={y} r={f1(medal)} fill="none" stroke={`rgba(${rgb},${on ? 0.95 : 0.5})`} strokeWidth="1.1" />
                        <circle cx={c} cy={y} r={f1(medal * 0.77)} fill="none" stroke={`rgba(${rgb},${on ? 0.6 : 0.3})`} strokeWidth="0.9" strokeDasharray="2 3" />
                        <path d={star(c, y, medal * 0.57, i ? 5 : 6, 2)} fill={on && i ? `rgba(${rgb},0.35)` : 'none'} stroke={`rgba(${rgb},${on ? 0.95 : 0.5})`} strokeWidth="1.2" />
                        <circle cx={c} cy={y} r={f1(2 * s)} fill={on ? hot : `rgba(${rgb},0.5)`} />
                        {/* Rays off the gate, fanning outward. */}
                        {!i && [-1, 0, 1].map((g) => (
                            <path key={g} d={`M${P(at(0, r, g * 5 * s, medal + 3 * s))}L${P(at(0, r, g * 9 * s, (g ? 25 : 30) * s))}`} stroke={`rgba(${rgb},0.6)`} strokeWidth="1" />
                        ))}
                    </g>
                ))}

                {/* The flare as the ring closes. */}
                {flare > 0 && (
                    <circle key={flare} cx={c} cy={c} r={r} fill="none" stroke={`rgb(${rgb})`} className="mana-flare" />
                )}
            </svg>
        </div>
    );
};

export default React.memo(ManaRing);
