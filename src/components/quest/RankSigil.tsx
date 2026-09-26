import React from 'react';
import { Rank, Theme } from '../../core/types';

/**
 * RankSigil — a System-HUD rank node, built from the site's own kit:
 * corner brackets (as in SystemFrame), a glass hexagon plate, a monospace
 * rank glyph, a scanline sweep, and a thin dashed reticle. Each rank is
 * distinguished by colour, glow, an escalating reticle, and a "signal
 * readout" tick bar whose count equals the rank tier.
 *
 *   E  bare bracketed node                    (1 tick)
 *   D  + dashed spin ring                      (2 ticks)
 *   C  + inner hex outline                     (3 ticks)
 *   B  + counter-rotating segment ring         (4 ticks)
 *   A  + rotating bracket ring                 (5 ticks)
 *   S  + outer spinning hex frame + max aura   (6 ticks)
 *
 * All motion holds under prefers-reduced-motion.
 */

// Raw hex per rank (SVG can't consume Tailwind text-* classes).
const RANK_HEX: Record<string, string> = {
    S: '#fbbf24', // amber
    A: '#fb7185', // rose
    B: '#c084fc', // purple
    C: '#60a5fa', // blue
    D: '#22d3ee', // cyan
    E: '#cbd5e1', // slate
};

/**
 * The same ranks on a LIGHT plate. The -400 set above is tuned to glow on the void; on the
 * light theme's white core face the letter measured 1.3–1.7:1 and the rings all but
 * vanished. These are the -700 rungs, which keep each rank's hue while reading as ink.
 */
const RANK_HEX_LIGHT: Record<string, string> = {
    S: '#b45309', // amber-700
    A: '#be123c', // rose-700
    B: '#7e22ce', // purple-700
    C: '#1d4ed8', // blue-700
    D: '#0e7490', // cyan-700
    E: '#475569', // slate-600
};

const TIER: Record<string, number> = { E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };

const CX = 24;
const CY = 22;

const hexPts = (r: number): string =>
    Array.from({ length: 6 }, (_, i) => {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        return `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');

interface RankSigilProps {
    rank: Rank;
    theme: Theme;
    size?: number;
}

const RankSigil = React.memo<RankSigilProps>(({ rank, theme, size = 48 }) => {
    const name = (rank.name?.[0] || 'E').toUpperCase();
    const palette = theme.isDark ? RANK_HEX : RANK_HEX_LIGHT;
    const c = palette[name] || palette.E;
    const tier = TIER[name] ?? 1;
    const clipId = `hx-${name}`;
    const coreFace = theme.isDark ? 'rgba(11,11,17,0.9)' : 'rgba(255,255,255,0.85)';

    // corner brackets (SystemFrame motif)
    const b = 17;
    const L = 4;
    const corners: Array<[number, number]> = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ];

    // signal readout ticks = tier
    const tw = tier * 3.4;
    const x0 = CX - tw / 2 + 1.2;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }} aria-hidden>
            <svg
                viewBox="0 0 48 48"
                width={size}
                height={size}
                shapeRendering="geometricPrecision"
                className="rank-sigil overflow-visible"
            >
                <defs>
                    <clipPath id={clipId}>
                        <polygon points={hexPts(13)} />
                    </clipPath>
                </defs>

                {/* S: outer spinning hex frame */}
                {tier === 6 && (
                    <polygon className="spin-cw" points={hexPts(18)} fill="none" stroke={c} strokeWidth={0.5} opacity={0.25} />
                )}

                {/* D+: dashed spin ring */}
                {tier >= 2 && (
                    <circle
                        className="spin-cw"
                        cx={CX}
                        cy={CY}
                        r={16}
                        fill="none"
                        stroke={c}
                        strokeWidth={0.6}
                        strokeDasharray={tier >= 4 ? '1 4' : '2 4'}
                        opacity={0.5}
                    />
                )}

                {/* B+: counter-rotating segment ring */}
                {tier >= 4 && (
                    <circle
                        className="spin-ccw"
                        cx={CX}
                        cy={CY}
                        r={15}
                        fill="none"
                        stroke={c}
                        strokeWidth={0.5}
                        strokeDasharray="8 10"
                        opacity={0.55}
                    />
                )}

                {/* A+: rotating bracket ring (4 short arcs) */}
                {tier >= 5 && (
                    <g className="spin-ccw">
                        {[0, 1, 2, 3].map((i) => {
                            const a0 = ((i * 90 - 14) * Math.PI) / 180;
                            const a1 = ((i * 90 + 14) * Math.PI) / 180;
                            const r = 19;
                            return (
                                <path
                                    key={i}
                                    d={`M${CX + r * Math.cos(a0)},${CY + r * Math.sin(a0)} A${r},${r} 0 0 1 ${CX + r * Math.cos(a1)},${CY + r * Math.sin(a1)}`}
                                    fill="none"
                                    stroke={c}
                                    strokeWidth={1}
                                    opacity={0.7}
                                />
                            );
                        })}
                    </g>
                )}

                {/* C+: inner hex outline */}
                {tier >= 3 && <polygon points={hexPts(9.5)} fill="none" stroke={c} strokeWidth={0.6} opacity={0.5} />}

                {/* core hex plate (glass) */}
                <polygon points={hexPts(13)} fill={coreFace} stroke={c} strokeWidth={1.3} strokeLinejoin="round" />
                <polygon points={hexPts(13)} fill={c} fillOpacity={0.1} />

                {/* scanline (clipped to core) */}
                <g clipPath={`url(#${clipId})`}>
                    <rect className="scan" x={CX - 13} y={CY - 2} width={26} height={1.4} fill={c} fillOpacity={0.8} />
                </g>

                {/* corner brackets (slowly spinning as a set) */}
                <g className="brackets">
                    {corners.map(([sx, sy], i) => {
                        const x = CX + sx * b;
                        const y = CY + sy * b;
                        return (
                            <path
                                key={i}
                                d={`M${x - sx * L},${y} L${x},${y} L${x},${y - sy * L}`}
                                fill="none"
                                stroke={c}
                                strokeWidth={1.4}
                                strokeLinecap="round"
                            />
                        );
                    })}
                </g>

                {/* rank letter */}
                <text
                    x={CX}
                    y={CY + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    fontWeight={900}
                    fontFamily="ui-monospace, monospace"
                    fill={c}
                    stroke={theme.isDark ? '#000' : '#fff'}
                    strokeWidth={0.4}
                    paintOrder="stroke"
                >
                    {name}
                </text>

                {/* signal readout ticks = tier */}
                {Array.from({ length: tier }, (_, i) => (
                    <rect
                        key={i}
                        x={(x0 + i * 3.4).toFixed(1)}
                        y={CY + 20}
                        width={1.8}
                        height={3.2}
                        rx={0.4}
                        fill={c}
                        opacity={0.9}
                    />
                ))}
            </svg>

            <style>{`
                @keyframes sigil-scan { 0%{transform:translateY(-16px);opacity:0} 20%{opacity:.9} 80%{opacity:.9} 100%{transform:translateY(16px);opacity:0} }
                @keyframes sigil-spin { to { transform: rotate(360deg); } }
                @keyframes sigil-spin-rev { to { transform: rotate(-360deg); } }
                @keyframes sigil-revolve { from { transform: perspective(120px) rotateY(0deg); } to { transform: perspective(120px) rotateY(360deg); } }
                .rank-sigil .scan { animation: sigil-scan 3.4s ease-in-out infinite; }
                .rank-sigil .spin-cw,
                .rank-sigil .spin-ccw,
                .rank-sigil .brackets { transform-box: fill-box; transform-origin: center; }
                .rank-sigil .spin-cw { animation: sigil-spin 14s linear infinite; }
                .rank-sigil .spin-ccw { animation: sigil-spin-rev 18s linear infinite; }
                .rank-sigil .brackets { animation: sigil-revolve 9s linear infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .rank-sigil .scan,
                    .rank-sigil .spin-cw,
                    .rank-sigil .spin-ccw,
                    .rank-sigil .brackets { animation: none; }
                }
            `}</style>
        </div>
    );
});

RankSigil.displayName = 'RankSigil';

export default RankSigil;
