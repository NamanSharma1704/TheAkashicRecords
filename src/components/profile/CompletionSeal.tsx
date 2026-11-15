import React, { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';

/**
 * OVERALL COMPLETION as a sigil of light in the banner's sky (2026-11-15). Not an object laid on
 * the art (a solid silver star read as a sticker): fine silver hairline rings and a graduation
 * like the medallion's, a rune band whose runes kindle as far as the archive has been read
 * (chapters read of all the chapters known) with a trail of light and a bright head running
 * round it, gem points at the quarters lit once passed, and the share set like the rank title on
 * the other side. A feathered shade of the sky's own dark sits under it, as one sits under the
 * title plate. The figure is the same as before: the profile's overall percentage, nothing else.
 */

const C = 60;
const f1 = (n: number) => +n.toFixed(2);
/** Degrees clockwise from the top. */
const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
};
/** Rune marks in a 10 x 14 box: line glyphs, not any real script (the dais's own). */
const RUNES = ['M0 -7V7M-4 -3L4 3', 'M-4 -7V7M-4 -7L4 0L-4 7', 'M-4 7L0 -7L4 7M-2 1H2', 'M0 -7V7M-4 -7L4 -1', 'M-4 -7L4 7M4 -7L-4 7', 'M-4 -6H4L-4 6H4'];
// theme-color-ok: the frame's silver, the same in both themes, as the banner's is
const SILVER = '228,231,238';

const springConfig = { type: 'spring' as const, stiffness: 60, damping: 15 };

const CompletionSeal: React.FC<{ theme: Theme; pct: number; size: number }> = ({ theme, pct, size }) => {
    const id = useId().replace(/:/g, '');
    const share = Math.max(0, Math.min(1, pct / 100));
    // The banner is dark in both themes: Arcanum's ink is its pale amethyst.
    const ink = theme.isDark ? '#fbbf24' : theme.accentPlateInk; // theme-color-ok: amber-400, the Void's bright accent on its dark sky
    const glow = theme.isDark ? '245, 158, 11' : '167, 139, 250'; // theme-color-ok: the rune glow, accent-family per theme
    const gem = theme.isDark ? { hi: '#fde68a', lo: '#b45309' } : { hi: '#ede9fe', lo: '#6d28d9' }; // theme-color-ok: gem facets, accent-family per theme

    const shape = useMemo(() => {
        let ticks = '', majors = '';
        for (let i = 0; i < 72; i++) {
            const deg = i * 5, long = i % 6 === 0;
            const [x0, y0] = pt(deg, 50.5), [x1, y1] = pt(deg, long ? 55 : 52.5);
            const seg = `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
            if (long) majors += seg; else ticks += seg;
        }
        const runes = Array.from({ length: 24 }, (_, i) => ({
            d: RUNES[(i * 5 + 1) % RUNES.length],
            t: `rotate(${f1((i + 0.5) * 15)} ${C} ${C}) translate(${C} ${C - 42.5}) scale(0.3)`,
        }));
        return { ticks, majors, runes };
    }, []);

    const R = 42.5, TRAIL = 47.5;
    const [hx, hy] = pt(share * 360, TRAIL);
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Overall completion ${Math.round(pct)}%`}>
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }} aria-hidden="true">
                <defs>
                    {/* The sky's own dark, feathered: no edge to it. */}
                    <radialGradient id={`${id}-shade`}>
                        <stop offset="0%" stopColor="rgba(3,2,6,0.82)" />
                        <stop offset="55%" stopColor="rgba(3,2,6,0.6)" />
                        <stop offset="100%" stopColor="rgba(3,2,6,0)" />
                    </radialGradient>
                    <mask id={`${id}-lit`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
                        <motion.circle
                            cx={C} cy={C} r={R} fill="none" stroke="#fff" strokeWidth="9"
                            transform={`rotate(-90 ${C} ${C})`}
                            initial={{ pathLength: 0 }} animate={{ pathLength: share }} transition={springConfig}
                        />
                    </mask>
                </defs>

                <circle cx={C} cy={C} r="66" fill={`url(#${id}-shade)`} />

                {/* Hairline rings and the graduation, in the frame's silver. */}
                <circle cx={C} cy={C} r="50.5" fill="none" stroke={`rgba(${SILVER},0.6)`} strokeWidth="0.7" />
                <path d={shape.ticks} stroke={`rgba(${SILVER},0.35)`} strokeWidth="0.6" />
                <path d={shape.majors} stroke={`rgba(${SILVER},0.7)`} strokeWidth="0.8" />
                <circle cx={C} cy={C} r="36.5" fill="none" stroke={`rgba(${SILVER},0.5)`} strokeWidth="0.6" />
                <circle cx={C} cy={C} r="34.5" fill="none" stroke={`rgba(${SILVER},0.2)`} strokeWidth="0.5" strokeDasharray="1 2.5" />

                {/* The rune band: faint, then kindled as far as the archive has been read. */}
                <g fill="none" stroke={`rgba(${glow},0.3)`} strokeWidth="3.2">
                    {shape.runes.map((r, i) => <path key={i} d={r.d} transform={r.t} />)}
                </g>
                <g mask={`url(#${id}-lit)`}>
                    <g fill="none" stroke={ink} strokeWidth="3.2" style={{ filter: `drop-shadow(0 0 2px rgba(${glow},1))` }}>
                        {shape.runes.map((r, i) => <path key={i} d={r.d} transform={r.t} />)}
                    </g>
                </g>

                {/* The trail of light, and its head. */}
                <motion.circle
                    cx={C} cy={C} r={TRAIL} fill="none" stroke={ink} strokeWidth="1.1" strokeLinecap="round"
                    transform={`rotate(-90 ${C} ${C})`}
                    style={{ filter: `drop-shadow(0 0 2.5px rgba(${glow},1))` }}
                    initial={{ pathLength: 0 }} animate={{ pathLength: share }} transition={springConfig}
                />
                {share > 0 && share < 1 && (
                    <g style={{ filter: `drop-shadow(0 0 4px rgba(${glow},1))` }}>
                        <circle cx={f1(hx)} cy={f1(hy)} r="2.4" fill="#fff8e6" />
                        <circle cx={f1(hx)} cy={f1(hy)} r="4.5" fill={`rgba(${glow},0.35)`} />
                    </g>
                )}

                {/* Gem points at the quarters, lit once the band has passed them. */}
                {[0, 90, 180, 270].map((deg) => {
                    const [x, y] = pt(deg, 57.5);
                    const on = share >= deg / 360 + 0.001 || (deg === 0 && share > 0);
                    return (
                        <g key={deg} transform={`rotate(${deg} ${f1(x)} ${f1(y)})`} opacity={on ? 1 : 0.6} style={on ? { filter: `drop-shadow(0 0 3px rgba(${glow},1))` } : undefined}>
                            <path d={`M${f1(x)} ${f1(y - 4.6)}L${f1(x + 2.7)} ${f1(y)}L${f1(x - 2.7)} ${f1(y)}Z`} fill={on ? gem.hi : `rgba(${SILVER},0.55)`} />
                            <path d={`M${f1(x - 2.7)} ${f1(y)}L${f1(x + 2.7)} ${f1(y)}L${f1(x)} ${f1(y + 4.6)}Z`} fill={on ? gem.lo : `rgba(${SILVER},0.25)`} />
                        </g>
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
                {/* The share, set like the rank title opposite it. */}
                <div
                    className={`font-black font-orbitron leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${theme.isDark ? theme.inkGradient : 'from-[#c4b5fd] via-[#ddd6fe] to-white'}`}
                    style={{ fontSize: size * 0.2, filter: `drop-shadow(0 2px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 2px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(${glow},0.5))` }}
                >
                    {Math.round(pct)}<span style={{ fontSize: size * 0.1 }}>%</span>
                </div>
                <div
                    className="mt-[4%] font-mono font-bold uppercase text-accent-plate"
                    style={{ fontSize: Math.max(6, size * 0.052), letterSpacing: size < 80 ? '0.08em' : '0.22em', textShadow: '0 0 2px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9)' }}
                >
                    Complete
                </div>
            </div>
        </div>
    );
};

export default React.memo(CompletionSeal);
