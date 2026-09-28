import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';

// The boot centrepiece emblem is served from the public root as a keyed cutout of the
// reference art (see SpireEmblem). Pathed from `/` so it resolves under any route.
const SPIRE_SRC = '/spire-tower.webp';
const SPIRE_GLOW_SRC = '/spire-tower-glow.webp';

interface BootScreenProps {
    onComplete: () => void;
    theme: Theme;
}

const AWAKENING_PHASES = [
    "INITIATING_VOID_PROTOCOL...",
    "EXTRACTING_MANA_RESERVES...",
    "ALIGNING_SACRED_GEOMETRY...",
    "DECRYPTING_AKASHIC_CORE...",
    "SYSTEM_AWAKENING_COMPLETE"
];

// Boot timeline, in milliseconds from mount.
const FILL_MS = 8000;                                   // 0 → 100%
const AWAKEN_HOLD_MS = 1600;                            // logo flare before the outro
const OUTRO_MS = 1000;                                  // fade to the app
const PHASE_MS = FILL_MS / AWAKENING_PHASES.length;     // one label per slice
const TOTAL_MS = FILL_MS + AWAKEN_HOLD_MS + OUTRO_MS;

// Tick fast enough to look smooth in the foreground. Background tabs clamp this to
// roughly 1s (and to once a minute under Chrome's intensive throttling), which is
// exactly why nothing below counts ticks — every value is recomputed from elapsed time.
const TICK_MS = 30;

/**
 * Boot palette, derived from the active theme.
 *
 * These were two module constants (#fbbf24 gold, #ffffff white) and the component never
 * read its `theme` prop at all, so the boot sequence stayed amber-on-black even with the
 * app in Aureic. Deriving them keeps the celestial identity — which is the house
 * aesthetic — while letting it invert with everything else.
 */
type BootPalette = { accent: string; accentInk: string; ink: string; ground: string; isDark: boolean };

/**
 * `accent` is decorative — stars, constellations, the progress fill and its glow.
 * `accentInk` is for text. They are identical on the void, where amber-400 already reads
 * at a glance, and diverge on the light ground, where the decorative cyan measured 2.32:1
 * behind the HUD readouts.
 */
const paletteFor = (theme: Theme): BootPalette => theme.isDark
    ? { accent: '#fbbf24', accentInk: '#fbbf24', ink: '#ffffff', ground: '#020202', isDark: true }
    : { accent: theme.accentColor, accentInk: theme.accentInk, ink: '#0f172a', ground: '#f8fafc', isDark: false };

// Screen blending only lifts against a dark ground; on the light theme it erases the art.
const blendFor = (p: BootPalette) => p.isDark ? 'mix-blend-screen' : 'mix-blend-multiply';

// --- Pre-computed star data to avoid Math.random() in render ---
type StarData = {
    cx: number;
    cy: number;
    r: number;
    peak: number;
    dx: number;
    opDur: number;
    opDelay: number;
    xDur: number;
};

const frac = (n: number) => n - Math.floor(n);
/** Deterministic hash in [0,1). Stands in for Math.random() so renders stay stable. */
const hash = (n: number, seed: number) => frac(Math.sin(n * seed) * 43758.5453123);

/**
 * R2 low-discrepancy sequence (the 2D generalisation of the golden ratio).
 *
 * The previous generator was `(i * 593.6) % 1600` paired with `(i * 213.3) % 900`, which
 * advances every star by the SAME vector and wraps — putting all 110 of them on one
 * lattice line. Measured, it produced exactly one distinct dx and one distinct dy across
 * the whole field, which the eye reads as diagonal ruling rather than as stars. Its
 * comment claimed a golden-ratio distribution, but phi only ever touched the radius and
 * the timings, never the position.
 *
 * R2 genuinely equidistributes without repeating a step, and a small deterministic jitter
 * breaks up the residual regularity so the field clumps slightly, the way a real sky does.
 */
// Plastic number, at the precision a double actually carries.
const PLASTIC = 1.324717957244746;
const A1 = 1 / PLASTIC;
const A2 = 1 / (PLASTIC * PLASTIC);

function generateStars(count: number): StarData[] {
    const stars: StarData[] = [];
    for (let i = 1; i <= count; i++) {
        const jx = hash(i, 12.9898) - 0.5;
        const jy = hash(i, 78.2330) - 0.5;

        // Magnitude, skewed so most stars are faint and only a handful burn brightly —
        // a uniform size distribution is a large part of what made this read as a texture.
        const m = hash(i, 4.1237);
        const bright = Math.pow(m, 3);

        stars.push({
            cx: frac(0.5 + A1 * i) * 1600 + jx * 30,
            cy: frac(0.5 + A2 * i) * 900 + jy * 30,
            r: 0.35 + bright * 1.25,
            peak: 0.22 + bright * 0.55,
            dx: (hash(i, 33.71) * 12) - 6,
            opDur: 2 + hash(i, 55.13) * 3.5,
            opDelay: hash(i, 91.77) * 5,
            xDur: 12 + hash(i, 24.09) * 10,
        });
    }
    return stars;
}

const STAR_DATA = generateStars(140);

/**
 * The constellation network.
 *
 * The reference boot art is not a scattering of unconnected stars but a web: nodes joined
 * by fine lines that span the whole field and thicken the sky into a lattice. This builds
 * that web deterministically — nodes placed by the same R2 low-discrepancy sequence as the
 * starfield (even coverage, no ruled lines), each joined to its nearest few neighbours
 * within a distance cap so the edges read as local constellations rather than one long
 * mesh. It is computed once at module load and drawn as static SVG; the sky twinkles
 * through the separate starfield layer and a slow group-wide shimmer, so there is no
 * per-node animation to pay for.
 */
type NetNode = { x: number; y: number; r: number; bright: boolean };

function buildNetwork(count: number): { nodes: NetNode[]; edges: [number, number][] } {
    const nodes: NetNode[] = [];
    for (let i = 1; i <= count; i++) {
        const jx = hash(i, 12.9898) - 0.5;
        const jy = hash(i, 78.2330) - 0.5;
        const m = hash(i, 4.1237);
        nodes.push({
            x: frac(0.5 + A1 * i) * 1600 + jx * 74,
            y: frac(0.5 + A2 * i) * 900 + jy * 74,
            r: 1.1 + Math.pow(m, 2) * 2.6,
            bright: m > 0.8,
        });
    }

    // Join each node to its nearest neighbours within a cap. Capping both the count and the
    // distance keeps the web local — short struts between close stars — rather than a
    // fully-connected graph that would read as noise.
    const MAX_DIST = 236;
    const MAX_PER = 3;
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
        const near: { j: number; d: number }[] = [];
        for (let j = 0; j < count; j++) {
            if (j === i) continue;
            const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
            if (d < MAX_DIST) near.push({ j, d });
        }
        near.sort((a, b) => a.d - b.d);
        for (let k = 0; k < Math.min(MAX_PER, near.length); k++) {
            const j = near[k].j;
            const key = i < j ? i + ':' + j : j + ':' + i;
            if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
        }
    }
    return { nodes, edges };
}

const NETWORK = buildNetwork(92);

const ConstellationNetwork: React.FC<{ p: BootPalette }> = ({ p }) => {
    const { accent: gold, ink: white } = p;
    const reducedMotion = useReducedMotion();
    return (
        <motion.g
            animate={reducedMotion ? { opacity: 0.85 } : { opacity: [0.6, 0.92, 0.6] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            style={{ willChange: 'opacity' }}
        >
            {NETWORK.edges.map(([a, b], i) => {
                const na = NETWORK.nodes[a];
                const nb = NETWORK.nodes[b];
                return (
                    <line
                        key={i}
                        x1={na.x.toFixed(1)} y1={na.y.toFixed(1)}
                        x2={nb.x.toFixed(1)} y2={nb.y.toFixed(1)}
                        stroke={gold} strokeWidth="0.6" opacity="0.3"
                    />
                );
            })}
            {NETWORK.nodes.map((n, i) => (
                <circle
                    key={i}
                    cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={n.r.toFixed(2)}
                    fill={n.bright ? white : gold}
                    opacity={n.bright ? 0.95 : 0.6}
                    filter={n.bright ? 'url(#nodeGlow)' : undefined}
                />
            ))}
        </motion.g>
    );
};

// --- CELESTIAL & HUD COMPONENTS ---

const MythicalConstellations: React.FC<{ p: BootPalette }> = ({ p }) => {
    // The starfield uses only the ink colour; the joined web is drawn by ConstellationNetwork.
    const { ink: white } = p;
    return (
        /*
         * viewBox="0 0 1600 900" with preserveAspectRatio="xMidYMid slice" keeps the
         * coordinate system uniformly scaled on all screens so circles remain circular
         * (not stretched ovals) on phones, tablets, and laptops.
         * Stars have NO blur filter — they are crisp 1px pinpoints of light.
         * Only constellation node dots get the subtle glow filter.
         */
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
        >
            <defs>
                {/* Only used for constellation node circles — NOT stars */}
                <filter id="nodeGlow" x="-150%" y="-150%" width="400%" height="400%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* ── STARFIELD ── crisp pinpoints, no blur filter */}
            {STAR_DATA.map((star, i) => (
                <motion.circle
                    key={i}
                    cx={star.cx}
                    cy={star.cy}
                    r={star.r}
                    fill={white}
                    animate={{
                        x:       [0, star.dx, 0],
                        // Peak brightness varies per star, so the field twinkles unevenly
                        // instead of every point pulsing to the same value together.
                        opacity: [star.peak * 0.15, star.peak, star.peak * 0.15],
                    }}
                    transition={{
                        x:       { duration: star.xDur, repeat: Infinity, ease: "linear" },
                        opacity: { duration: star.opDur, repeat: Infinity, ease: "easeInOut", delay: star.opDelay },
                    }}
                    style={{ willChange: 'transform, opacity' }}
                />
            ))}

            <ConstellationNetwork p={p} />
        </svg>
    );
};

const BackgroundDials: React.FC<{ p: BootPalette }> = ({ p }) => {
    return (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden ${p.isDark ? 'opacity-[0.05]' : 'opacity-[0.12]'} ${blendFor(p)}`}>
            {/* Compass rings use clamp-based vmin sizing so they feel right on all screens */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
                className="absolute rounded-full border border-dashed"
                style={{ width: 'clamp(320px, 90vmin, 1800px)', height: 'clamp(320px, 90vmin, 1800px)', borderColor: p.accent, willChange: 'transform' }}
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                className="absolute rounded-full border opacity-50"
                style={{ width: 'clamp(240px, 70vmin, 1400px)', height: 'clamp(240px, 70vmin, 1400px)', borderColor: p.ink, willChange: 'transform' }}
            />
            {/* Coordinate Markers */}
            {Array.from({ length: 16 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute h-[1px]"
                    style={{ width: 'clamp(240px, 70vmin, 1400px)', backgroundColor: `${p.accent}4d`, transform: `rotate(${i * (360 / 16)}deg)` }}
                />
            ))}
            {/* Diamond Frame Crosshairs */}
            <div className="absolute w-full h-full">
                <div className="absolute top-[15%] left-1/2 w-px h-16 sm:h-24 -translate-x-1/2" style={{ background: `linear-gradient(to bottom, transparent, ${p.ink}66)` }} />
                <div className="absolute bottom-[15%] left-1/2 w-px h-16 sm:h-24 -translate-x-1/2" style={{ background: `linear-gradient(to top, transparent, ${p.ink}66)` }} />
                <div className="absolute top-1/2 left-[15%] h-px w-16 sm:w-24 -translate-y-1/2" style={{ background: `linear-gradient(to right, transparent, ${p.ink}66)` }} />
                <div className="absolute top-1/2 right-[15%] h-px w-16 sm:w-24 -translate-y-1/2" style={{ background: `linear-gradient(to left, transparent, ${p.ink}66)` }} />
            </div>
        </div>
    );
};

const TELEMETRY_ROWS = 20;

/**
 * Scrolling coordinate readout down each edge.
 *
 * The addresses used to be `i * 0x13a7 + 0x4f2b`, which over 40 rows produced only four
 * distinct leading nibbles — ten consecutive rows all began "0000", so the column read as
 * a counter rather than a memory dump. The values were `i * 7.31 + 13.47`, a straight
 * ramp climbing the screen. Both now come from an integer avalanche hash, so every digit
 * varies and the numbers no longer march in order.
 */
const LateralTelemetry: React.FC<{ side: 'left' | 'right'; p: BootPalette }> = ({ side, p }) => {
    const rows = useMemo(() => {
        const mix = (n: number) => {
            let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b) >>> 0;
            h ^= h >>> 13;
            h = Math.imul(h, 0xc2b2ae35) >>> 0;
            h ^= h >>> 16;
            return h >>> 0;
        };
        return Array.from({ length: TELEMETRY_ROWS }).map((_, i) => {
            const a = mix(i * 2 + 1);
            const b = mix(i * 2 + 2);
            return {
                hex: a.toString(16).toUpperCase().padStart(8, '0'),
                val: ((b % 10000) / 100).toFixed(2).padStart(5, '0'),
            };
        });
    }, []);

    // Rendered twice. The track animates a full -50%, so the second copy is exactly what
    // scrolls into view as the first leaves — without the duplicate the loop snapped back
    // to the top instead of wrapping.
    const track = [...rows, ...rows];

    return (
        <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-6 xl:left-8' : 'right-6 xl:right-8'} w-28 xl:w-32 pointer-events-none hidden xl:flex flex-col ${p.isDark ? 'opacity-20' : 'opacity-30'} overflow-hidden font-mono z-0`}>
            <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="flex flex-col gap-8 text-[7px] tracking-[0.3em]"
                style={{ color: `${p.ink}80`, willChange: 'transform' }}
            >
                {track.map((row, i) => (
                    <div key={i} className={`flex items-center gap-4 ${side === 'right' ? 'justify-end' : ''}`}>
                        {side === 'left' && <div className="w-[1px] h-4" style={{ backgroundColor: `${p.accent}80` }} />}
                        <span>{row.hex}</span>
                        <span>[{row.val}]</span>
                        {side === 'right' && <div className="w-[1px] h-4" style={{ backgroundColor: `${p.accent}80` }} />}
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

const CelestialVoid: React.FC<{ p: BootPalette }> = ({ p }) => (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ backgroundColor: p.ground }}>
        {/* Layer 1: The 3D Grid */}
        <div className={p.isDark ? 'absolute inset-0 opacity-[0.03]' : 'absolute inset-0 opacity-[0.06]'} style={{ perspective: '800px' }}>
            <div
                className="absolute inset-0 bg-[size:80px_80px] sm:bg-[size:100px_100px] [transform:rotateX(65deg)_translateZ(-200px)]"
                style={{
                    backgroundImage: `linear-gradient(90deg, ${p.ink}33 1px, transparent 1px), linear-gradient(${p.ink}33 1px, transparent 1px)`
                }}
            />
        </div>

        {/* Layer 2: Mana Mist — motion instead of animate-pulse for GPU acceleration */}
        <motion.div
            animate={{ opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
                background: `radial-gradient(circle at center, ${p.accent}14 0%, transparent 70%)`,
                willChange: 'opacity'
            }}
        />

        <MythicalConstellations p={p} />
        <BackgroundDials p={p} />
        <LateralTelemetry side="left" p={p} />
        <LateralTelemetry side="right" p={p} />

        {/* Layer 3: Spatial Expansion Pulse */}
        <motion.div
            animate={{ scale: [0.3, 1.3], opacity: [0.15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border rounded-full"
            style={{
                width: 'clamp(200px, 55vmin, 800px)',
                height: 'clamp(200px, 55vmin, 800px)',
                borderColor: `${p.accent}4d`,
                willChange: 'transform, opacity',
            }}
        />
    </div>
);

/**
 * The sacred-geometry frame the tower stands inside.
 *
 * Where the old halo was three diamonds spinning at different rates, the reference is a
 * precise, still figure: an outer square, an inscribed diamond touching its edge midpoints,
 * and an eight-point star radiating from the centre. It reads as a reliquary the relic
 * stands within — the diamond's lower edges make the downward chevron under the tower and
 * its upper edges the peak the spire rises into — so it is drawn crisp and near-static, with
 * only a slow glow-breath for life.
 *
 * It is sized to ENCLOSE the tower: a near-square on wide screens (matching the reference)
 * that becomes a portrait rhombus on a phone, where a square wide enough for the tower's
 * height would overflow the width. The lines live in a stretched 0..100 viewBox with a
 * non-scaling stroke, so they stay hairline-thin at any aspect; the glowing vertex nodes are
 * round elements positioned by percentage, so they never distort into ellipses.
 */
const SacredFrame: React.FC<{ p: BootPalette }> = ({ p }) => {
    const reducedMotion = useReducedMotion();
    const stroke = p.accent;

    // Vertices in the 0..100 box, inset slightly from the container edge.
    const TL = '3,3', TR = '97,3', BR = '97,97', BL = '3,97';
    const T = '50,3', R = '97,50', B = '50,97', L = '3,50';

    // Round vertex nodes, positioned by percentage to match the polygon points above.
    const nodes = [
        { l: 50, t: 3, big: true }, { l: 97, t: 50, big: true },
        { l: 50, t: 97, big: true }, { l: 3, t: 50, big: true },
        { l: 3, t: 3 }, { l: 97, t: 3 }, { l: 97, t: 97 }, { l: 3, t: 97 },
    ];

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <motion.div
                className="relative"
                style={{
                    width: 'min(94vw, clamp(340px, 74vh, 752px))',
                    height: 'clamp(384px, 78vh, 796px)',
                    willChange: 'opacity',
                }}
                animate={reducedMotion ? { opacity: 0.88 } : { opacity: [0.62, 0.92, 0.62] }}
                transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ overflow: 'visible' }}
                >
                    <defs>
                        <filter id="frameGlow" x="-15%" y="-15%" width="130%" height="130%">
                            <feGaussianBlur stdDeviation="0.6" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <g fill="none" stroke={stroke} filter="url(#frameGlow)" strokeLinejoin="round">
                        {/* Eight-point star — centre to the four square corners. */}
                        <path d={`M50,50 L${TL} M50,50 L${TR} M50,50 L${BR} M50,50 L${BL}`}
                            vectorEffect="non-scaling-stroke" strokeWidth="1" opacity="0.28" />
                        {/* Diamond diagonals — the vertical and horizontal axes. */}
                        <path d={`M${T} L${B} M${L} L${R}`}
                            vectorEffect="non-scaling-stroke" strokeWidth="1" opacity="0.22" />
                        {/* Outer square. */}
                        <polygon points={`${TL} ${TR} ${BR} ${BL}`}
                            vectorEffect="non-scaling-stroke" strokeWidth="1.25" opacity="0.5" />
                        {/* Inscribed diamond. */}
                        <polygon points={`${T} ${R} ${B} ${L}`}
                            vectorEffect="non-scaling-stroke" strokeWidth="1.6" opacity="0.85" />
                    </g>
                </svg>
                {nodes.map((n, i) => (
                    <span
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            left: `${n.l}%`,
                            top: `${n.t}%`,
                            width: n.big ? 7 : 5,
                            height: n.big ? 7 : 5,
                            marginLeft: n.big ? -3.5 : -2.5,
                            marginTop: n.big ? -3.5 : -2.5,
                            background: stroke,
                            boxShadow: `0 0 9px ${stroke}, 0 0 3px ${stroke}`,
                            opacity: n.big ? 0.95 : 0.7,
                        }}
                    />
                ))}
            </motion.div>
        </div>
    );
};

const SovereignHeader: React.FC<{ p: BootPalette }> = ({ p }) => (
    <div className="absolute top-4 sm:top-8 md:top-12 left-4 sm:left-8 md:left-12 right-4 sm:right-8 md:right-12 z-40 flex justify-between items-start pointer-events-none font-mono text-[7px] sm:text-[9px] md:text-[10px] tracking-[0.3em] uppercase">
        <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-1.5 h-1.5 rounded-sm animate-pulse" style={{ backgroundColor: p.accent }} />
                <span style={{ color: `${p.ink}99` }}>NODE:</span>
                <span className="font-medium" style={{ color: p.accentInk }}>[7F:SOVEREIGN]</span>
            </div>
            <div className="w-32 sm:w-48 md:w-64 h-[1px]" style={{ background: `linear-gradient(to right, ${p.ink}1a, transparent)` }} />
        </div>
        <div className="flex flex-col items-end gap-2 sm:gap-3 text-right">
            <div className="flex items-center gap-2 sm:gap-4">
                <span style={{ color: `${p.ink}99` }}>ACCESS:</span>
                <span className="font-medium" style={{ color: p.accentInk }}>GRANTED</span>
            </div>
            <div className="w-32 sm:w-48 md:w-64 h-[1px]" style={{ background: `linear-gradient(to left, ${p.ink}1a, transparent)` }} />
        </div>
    </div>
);

/** The app's signature corner brackets, drawn inline so the boot HUD matches SystemFrame. */
const BracketCorners: React.FC<{ color: string }> = ({ color }) => (
    <>
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color }} />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color }} />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color }} />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color }} />
    </>
);

/**
 * The Spire emblem — the boot centrepiece.
 *
 * This is the reference tower itself: its own pixels, keyed off the white plate to a
 * transparent cutout, not a redrawing of it. It reads pixel-for-pixel like the art the
 * owner supplied — every filigree line, lit window and gold shade — which a procedural
 * mesh could only approximate. A projection has no back, so it cannot turn in full 3D; it
 * is staged at the reference's fixed three-quarter angle and given life instead through a
 * slow float, a breathing window-glow, and a sheen that sweeps the gilt.
 *
 * A dark "reliquary" pool sits behind it so the gold relic keeps its contrast on the
 * Aureic light ground as well as on the Void. The tower stays the Void artefact it is in
 * both themes; only the surrounding HUD inverts.
 */
const SpireEmblem: React.FC<{ p: BootPalette; awakened: boolean }> = ({ p, awakened }) => {
    const reducedMotion = useReducedMotion();

    return (
        <div
            className="relative flex items-center justify-center pointer-events-none"
            style={{
                width: 'clamp(260px, 90vw, 520px)',
                height: 'clamp(360px, 71vh, 736px)',
            }}
        >
            {/* Reliquary pool — a wash of void that grounds the gold relic in either theme.
                On the Void it is a faint warm bloom (the tower already sits on black); on the
                Aureic ground it is a defined dark niche, deep at the core and falling off
                cleanly so it reads as a medallion rather than a grey smudge. */}
            <div
                className="absolute"
                style={{
                    width: p.isDark ? '132%' : '122%',
                    height: p.isDark ? '120%' : '112%',
                    background: p.isDark
                        ? `radial-gradient(46% 46% at 50% 47%, ${p.accent}24 0%, ${p.accent}0d 34%, transparent 66%)`
                        : 'radial-gradient(44% 47% at 50% 46%, rgba(6,13,22,0.94) 0%, rgba(6,13,22,0.80) 30%, rgba(6,13,22,0.32) 56%, transparent 73%)',
                    filter: p.isDark ? 'blur(4px)' : 'blur(7px)',
                }}
            />

            {/* The tower, floating. */}
            <motion.div
                className="relative w-full h-full"
                style={{ willChange: 'transform' }}
                animate={reducedMotion ? {} : { y: [0, -10, 0] }}
                transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
            >
                {/* Base cutout — the reference's own pixels. */}
                <img
                    src={SPIRE_SRC}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain select-none"
                    style={{ filter: `drop-shadow(0 22px 40px ${p.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(4,10,18,0.7)'})` }}
                />

                {/* Window & lantern glow — screen-blended and breathing; it quickens at awakening. */}
                <motion.img
                    src={SPIRE_GLOW_SRC}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain select-none"
                    style={{ mixBlendMode: 'screen', willChange: 'opacity' }}
                    animate={reducedMotion ? { opacity: 0.9 } : { opacity: awakened ? [0.82, 1, 0.82] : [0.5, 0.9, 0.5] }}
                    transition={{ duration: awakened ? 2.2 : 3.6, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Light sweep — a sheen crossing the gilt, clipped to the tower silhouette. */}
                {!reducedMotion && (
                    <div
                        className="absolute inset-0 overflow-hidden"
                        style={{
                            WebkitMaskImage: `url(${SPIRE_SRC})`,
                            maskImage: `url(${SPIRE_SRC})`,
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'center',
                            maskPosition: 'center',
                            mixBlendMode: 'screen',
                        }}
                    >
                        <motion.div
                            className="absolute top-[-30%] bottom-[-30%] w-1/2"
                            style={{
                                background: `linear-gradient(105deg, transparent 0%, ${p.isDark ? 'rgba(255,240,205,0.45)' : 'rgba(255,255,255,0.5)'} 50%, transparent 100%)`,
                                filter: 'blur(6px)',
                                willChange: 'transform',
                            }}
                            animate={{ x: ['-160%', '360%'] }}
                            transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
                        />
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const BootScreen: React.FC<BootScreenProps> = ({ onComplete, theme }) => {
    const p = paletteFor(theme);
    const [progress, setProgress] = useState(0);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [isShattering, setIsShattering] = useState(false);
    const [isAwakened, setIsAwakened] = useState(false);

    // onComplete can be reached from three places (the timeline, the outro animation, and
    // a return-to-tab catch-up), so it is latched to fire exactly once.
    const completedRef = useRef(false);
    const finish = useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
    }, [onComplete]);

    // The sequence start is pinned to the first render, not to the effect.
    //
    // The effect depends on the completion callback, and a parent passing an inline arrow
    // gives it a fresh identity on every render — which re-ran this effect and restarted
    // the clock from zero mid-boot. The old tick-accumulating version masked that (a
    // restart just kept adding to the previous total); computing from elapsed time does
    // not, so the origin has to survive re-runs.
    const startRef = useRef<number | null>(null);
    if (startRef.current === null) startRef.current = performance.now();

    // Skip. The sequence runs ~10.6s with no way out, and it plays on every signed-out
    // visit — Escape, Enter or Space, or the SKIP control, jump straight to the entry
    // screen. finish() is latched, so a skip racing the timeline still completes once.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                finish();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [finish]);

    useEffect(() => {
        const start = startRef.current as number;

        /**
         * Recompute the whole timeline from elapsed time.
         *
         * Nothing here accumulates per tick. That matters because a hidden tab has its
         * timers clamped to ~1s, so the old tick-counting version needed roughly 267
         * throttled ticks — over four minutes — to reach 100%. Deriving from the clock
         * means a single late tick lands on the correct state, so the sequence finishes
         * on schedule whether or not anyone is watching.
         */
        const sync = () => {
            const elapsed = performance.now() - start;

            setProgress(Math.min(100, (elapsed / FILL_MS) * 100));
            setPhaseIndex(Math.min(
                AWAKENING_PHASES.length - 1,
                Math.floor(elapsed / PHASE_MS)
            ));

            if (elapsed >= FILL_MS) setIsAwakened(true);
            if (elapsed >= FILL_MS + AWAKEN_HOLD_MS) setIsShattering(true);
            if (elapsed >= TOTAL_MS) finish();
        };

        const interval = setInterval(sync, TICK_MS);

        // A frozen or heavily throttled tab may not have ticked for a while. Resync the
        // moment it comes back so the user never sees a stale bar catch up in front of them.
        const onVisibility = () => { if (!document.hidden) sync(); };
        document.addEventListener('visibilitychange', onVisibility);

        // Backstop: one absolute timer for the end of the sequence. A single long timeout
        // is not subject to the repeating-interval clamp, so even if the interval is
        // starved this still lands close to on time.
        const failsafe = setTimeout(finish, TOTAL_MS);

        sync();

        return () => {
            clearInterval(interval);
            clearTimeout(failsafe);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [finish]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden font-mono"
            style={{ backgroundColor: p.ground, willChange: 'opacity' }}
        >
            {/* Fade-out overlay — separate element for smoother composite */}
            <motion.div
                className="absolute inset-0 z-[200] pointer-events-none"
                style={{ backgroundColor: p.ground, willChange: 'opacity' }}
                animate={{ opacity: isShattering ? 1 : 0 }}
                transition={{ duration: 1.0, ease: "easeIn" }}
                onAnimationComplete={() => {
                    // Foreground fast path. In a hidden tab rAF is suspended so this never
                    // fires; the elapsed-time timeline and the failsafe cover that case.
                    if (isShattering) finish();
                }}
            />

            {/* The field and its telemetry are texture — forty rows of hex are noise to a
                screen reader — so only the phase and the progress are exposed. */}
            <div aria-hidden="true"><CelestialVoid p={p} /></div>
            <div aria-hidden="true"><SovereignHeader p={p} /></div>
            <span className="sr-only" aria-live="polite">{AWAKENING_PHASES[phaseIndex]}</span>

            <div className="relative z-30 flex flex-col items-center justify-between w-full h-full py-16 sm:py-20 md:py-24">

                {/* TOP SPACER for header clearance */}
                <div className="flex-shrink-0" style={{ height: 'clamp(40px, 6vh, 80px)' }} />

                {/* LOGO AREA — fills available vertical space between header and HUD */}
                <div className="relative flex items-center justify-center flex-1 w-full">
                    <SacredFrame p={p} />
                    {/*
                     * The emblem composites its own pixels over a dark pool, so it must not
                     * carry the line-art blend mode the core logo used — screen/multiply on a
                     * photographic cutout would wash it out on the void or crush it on the
                     * light ground. The reveal/awaken/outro lives on this wrapper; the emblem's
                     * own float, glow and sheen live inside it.
                     */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={
                            isShattering
                                ? { scale: 1.55, opacity: 0 }
                                : { scale: 1, opacity: 1 }
                        }
                        transition={{
                            duration: isShattering ? 1.0 : 1.8,
                            ease: isShattering ? "easeIn" : "easeOut",
                        }}
                        className="relative z-30 flex items-center justify-center"
                        style={{ willChange: 'transform, opacity' }}
                    >
                        <SpireEmblem p={p} awakened={isAwakened} />
                    </motion.div>
                </div>

                {/* BOTTOM LOADING HUD — bracketed like every panel in the app */}
                <div className="w-full max-w-xs sm:max-w-md md:max-w-2xl px-6 sm:px-10 md:px-12 flex-shrink-0 relative z-40">
                    <div className="relative px-5 py-4">
                        <BracketCorners color={p.accent} />

                        <div className="flex flex-col items-center gap-3 sm:gap-4 w-full">
                            <div className="flex w-full justify-between items-end gap-4">
                                {/* Phase label */}
                                <motion.div
                                    key={phaseIndex}
                                    aria-hidden="true"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.3em] font-medium uppercase truncate"
                                    style={{ color: `${p.ink}b3` }}
                                >
                                    {AWAKENING_PHASES[phaseIndex]}
                                </motion.div>

                                <div className="flex gap-3 sm:gap-4 items-center text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.3em] uppercase flex-shrink-0">
                                    {/* Awakening is marked by the step to full ink. It also used to
                                        pulse, which faded the word under AA on each beat. */}
                                    <span style={{ color: isAwakened ? p.ink : `${p.ink}99` }}>
                                        [STABLE]
                                    </span>
                                    <span className="font-orbitron font-bold tabular-nums" style={{ color: p.accentInk }}>
                                        {Math.floor(progress)}%
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full">
                                <div
                                    className="h-[2px] w-full relative overflow-hidden rounded-full"
                                    style={{ backgroundColor: `${p.ink}1a` }}
                                    role="progressbar"
                                    aria-label="System boot"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.floor(progress)}
                                >
                                    <motion.div
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.12, ease: "linear" }}
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                            backgroundColor: p.accent,
                                            boxShadow: `0 0 16px ${p.accent}`,
                                            willChange: 'width',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM-RIGHT: skip, set in the same telemetry voice as the footer opposite
                    so it reads as part of the HUD rather than a web control laid on top. */}
                <button
                    type="button"
                    onClick={finish}
                    aria-label="Skip intro"
                    className="absolute right-4 sm:right-8 md:right-12 bottom-4 sm:bottom-8 md:bottom-12 z-[210] px-2 py-1 font-mono text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-medium border border-transparent outline-none focus-visible:border-current cursor-pointer"
                    style={{ color: p.isDark ? `${p.ink}b3` : `${p.ink}cc` }}
                >
                    SKIP <span style={{ color: p.accentInk }}>[ESC]</span>
                </button>

                {/* BOTTOM-LEFT TELEMETRY FOOTER */}
                <div aria-hidden="true" className="absolute left-4 sm:left-8 md:left-12 bottom-4 sm:bottom-8 md:bottom-12 z-40 text-left text-[7px] sm:text-[9px] md:text-[10px] tracking-[0.3em] leading-[2] uppercase hidden sm:block">
                    <div className="flex gap-4 sm:gap-8">
                        <span className="font-medium" style={{ color: `${p.ink}99` }}>SEC: <span style={{ color: p.accentInk }}>57</span></span>
                        <span className="font-medium" style={{ color: `${p.ink}99` }}>M_ID: <span style={{ color: p.accentInk }}>6E28</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
