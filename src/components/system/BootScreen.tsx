import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, useAnimationFrame } from 'motion/react';
import { Theme } from '../../core/types';
import AkashicCoreLogo from './AkashicCoreLogo';

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

type Star3D = { x: number; y: number; z: number; mag: number };
type Asterism3D = {
    label: string;
    center: [number, number];   // where the constellation's midpoint sits in the 1600x900 field
    stars: Star3D[];
    edges: [number, number][];
    field?: Star3D[];           // scattered, unconnected stars that sit around the shape
    yawAmp: number; yawPeriod: number;   // radians, seconds
    tiltAmp: number; tiltPeriod: number;
    phase: number;
};

/**
 * Two constellations invented for this archive rather than borrowed from the sky.
 *
 * The Sovereign's Crown is a crown of peaks with a tall central spire — the highest rank
 * the System grants. The Ascendant Gate is a diamond gateway crowned by a spire, echoing
 * the diamond halo of this very screen and the Divine Spire: a gate you open and a tower
 * you climb. Each carries a few loose field stars so it reads as part of a real sky, not
 * a figure drawn on the glass.
 */
const ASTERISMS: Asterism3D[] = [
    {
        label: "The Sovereign's Crown",
        center: [300, 545],
        stars: [
            { x: 0,   y: 46,  z:  42, mag: 2.6 },  // left base
            { x: 44,  y: 2,   z: -28, mag: 2.2 },  // left peak
            { x: 86,  y: 30,  z:  16, mag: 2.9 },  // left dip
            { x: 128, y: -34, z: -62, mag: 1.5 },  // central spire — the sovereign star
            { x: 170, y: 30,  z:  16, mag: 2.9 },  // right dip
            { x: 212, y: 2,   z: -28, mag: 2.2 },  // right peak
            { x: 256, y: 46,  z:  42, mag: 2.6 },  // right base
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
        field: [
            { x: 22,  y: 68,  z:  25, mag: 3.6 },
            { x: 234, y: 66,  z: -18, mag: 3.8 },
            { x: 128, y: -58, z:  30, mag: 3.9 },
        ],
        yawAmp: 0.58, yawPeriod: 21, tiltAmp: 0.20, tiltPeriod: 27, phase: 0,
    },
    {
        label: "The Ascendant Gate",
        center: [1200, 250],
        stars: [
            { x: 0,   y: -102, z: -52, mag: 1.5 },  // 0 spire tip — the summit above the gate
            { x: 0,   y: -54,  z: -26, mag: 2.3 },  // 1 gate top (keystone)
            { x: -58, y: 6,    z:  34, mag: 2.6 },  // 2 left post
            { x: 58,  y: 6,    z:  34, mag: 2.6 },  // 3 right post
            { x: 0,   y: 66,   z: -26, mag: 2.2 },  // 4 gate foot
            { x: 0,   y: 6,    z:   6, mag: 3.0 },  // 5 threshold, inside the arch
        ],
        edges: [[0, 1], [1, 2], [2, 4], [4, 3], [3, 1], [1, 5], [5, 4]],
        field: [
            { x: -78, y: -28, z:  28, mag: 3.7 },
            { x: 74,  y: 50,  z: -20, mag: 3.9 },
            { x: 0,   y: 96,  z:  40, mag: 3.9 },
        ],
        yawAmp: 0.52, yawPeriod: 24, tiltAmp: 0.24, tiltPeriod: 19, phase: 1.7,
    },
];

/** Base star radius from magnitude (brighter = larger), before the depth scale. */
const magRadius = (mag: number) => Math.max(1.1, 3.9 - mag * 0.65);

// Perspective strength. Larger flattens; this gives clear parallax without the nearer
// stars ballooning as the shape turns edge-on.
const FOCAL = 540;

type Projected = { sx: number; sy: number; scale: number };

/** Rotate a centroid-relative point by yaw (about Y) then tilt (about X), and project it. */
const project = (
    lx: number, ly: number, lz: number,
    yaw: number, tilt: number, cx: number, cy: number
): Projected => {
    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    const rx = lx * cosY + lz * sinY;
    const rz = -lx * sinY + lz * cosY;
    const sinX = Math.sin(tilt), cosX = Math.cos(tilt);
    const ry = ly * cosX - rz * sinX;
    const rz2 = ly * sinX + rz * cosX;
    const scale = FOCAL / (FOCAL + rz2);
    return { sx: cx + rx * scale, sy: cy + ry * scale, scale };
};

/**
 * Renders the asterisms with a live perspective projection.
 *
 * The projection is recomputed each frame from performance.now() and written straight to
 * the SVG elements through refs, so there is no per-frame React render. Using absolute
 * time (not accumulated frames) means a tab returning from the background lands on the
 * correct pose instead of catching up. rAF is suspended while hidden, so the shape simply
 * holds its last pose there; the initial attributes below are the yaw=0/tilt=0 front view,
 * which is what shows before the first frame and in a frozen tab.
 */
const Constellations3D: React.FC<{ p: BootPalette }> = ({ p }) => {
    const { accent: gold, ink: white } = p;

    // Centroid-relative geometry, computed once. The centroid comes from the connected
    // stars only, so field stars keep their offset around the same pivot.
    const model = useMemo(() => ASTERISMS.map(a => {
        const n = a.stars.length;
        const mx = a.stars.reduce((s, v) => s + v.x, 0) / n;
        const my = a.stars.reduce((s, v) => s + v.y, 0) / n;
        const mz = a.stars.reduce((s, v) => s + v.z, 0) / n;
        const rebase = (s: Star3D) => ({ x: s.x - mx, y: s.y - my, z: s.z - mz, mag: s.mag });
        return { ...a, local: a.stars.map(rebase), fieldLocal: (a.field ?? []).map(rebase) };
    }), []);

    const dotRefs = useRef<(SVGCircleElement | null)[][]>(model.map(() => []));
    const haloRefs = useRef<(SVGCircleElement | null)[][]>(model.map(() => []));
    const lineRefs = useRef<(SVGLineElement | null)[][]>(model.map(() => []));
    const fieldRefs = useRef<(SVGCircleElement | null)[][]>(model.map(() => []));

    useAnimationFrame(() => {
        const t = performance.now() / 1000;
        model.forEach((a, ai) => {
            const yaw = a.yawAmp * Math.sin((t / a.yawPeriod) * Math.PI * 2 + a.phase);
            const tilt = a.tiltAmp * Math.sin((t / a.tiltPeriod) * Math.PI * 2 + a.phase * 1.3);
            const cx = a.center[0] + Math.sin(t / 8 + a.phase) * 5;
            const cy = a.center[1] + Math.sin(t / 6 + a.phase * 2) * 4;

            const proj = a.local.map(s => project(s.x, s.y, s.z, yaw, tilt, cx, cy));

            a.edges.forEach(([from, to], ei) => {
                const el = lineRefs.current[ai][ei];
                if (!el) return;
                const pa = proj[from], pb = proj[to];
                el.setAttribute('x1', pa.sx.toFixed(1));
                el.setAttribute('y1', pa.sy.toFixed(1));
                el.setAttribute('x2', pb.sx.toFixed(1));
                el.setAttribute('y2', pb.sy.toFixed(1));
                const avg = (pa.scale + pb.scale) / 2;
                el.setAttribute('opacity', (0.10 + Math.max(0, avg - 0.75) * 0.42).toFixed(3));
            });

            a.local.forEach((s, si) => {
                const pr = proj[si];
                const r = magRadius(s.mag) * pr.scale;
                const dot = dotRefs.current[ai][si];
                if (dot) {
                    dot.setAttribute('cx', pr.sx.toFixed(1));
                    dot.setAttribute('cy', pr.sy.toFixed(1));
                    dot.setAttribute('r', r.toFixed(2));
                    dot.setAttribute('opacity', Math.min(1, Math.max(0.3, (pr.scale - 0.7) / 0.55)).toFixed(3));
                }
                const halo = haloRefs.current[ai][si];
                if (halo) {
                    halo.setAttribute('cx', pr.sx.toFixed(1));
                    halo.setAttribute('cy', pr.sy.toFixed(1));
                    halo.setAttribute('r', (r * 2.6).toFixed(2));
                    halo.setAttribute('opacity', (0.09 * pr.scale).toFixed(3));
                }
            });

            a.fieldLocal.forEach((s, si) => {
                const pr = project(s.x, s.y, s.z, yaw, tilt, cx, cy);
                const el = fieldRefs.current[ai][si];
                if (!el) return;
                el.setAttribute('cx', pr.sx.toFixed(1));
                el.setAttribute('cy', pr.sy.toFixed(1));
                el.setAttribute('r', (magRadius(s.mag) * pr.scale).toFixed(2));
                el.setAttribute('opacity', (0.4 * Math.min(1, pr.scale)).toFixed(3));
            });
        });
    });

    return (
        <>
            {model.map((a, ai) => {
                const p0 = a.local.map(s => project(s.x, s.y, s.z, 0, 0, a.center[0], a.center[1]));
                const f0 = a.fieldLocal.map(s => project(s.x, s.y, s.z, 0, 0, a.center[0], a.center[1]));
                return (
                    <g key={a.label} opacity={0.9}>
                        {a.edges.map(([from, to], ei) => (
                            <line
                                key={ei}
                                ref={el => { lineRefs.current[ai][ei] = el; }}
                                x1={p0[from].sx} y1={p0[from].sy}
                                x2={p0[to].sx} y2={p0[to].sy}
                                stroke={gold} strokeWidth="0.6" opacity="0.25"
                            />
                        ))}
                        {a.fieldLocal.map((s, si) => (
                            <circle
                                key={`f${si}`}
                                ref={el => { fieldRefs.current[ai][si] = el; }}
                                cx={f0[si].sx} cy={f0[si].sy} r={magRadius(s.mag) * f0[si].scale}
                                fill={white} opacity="0.4"
                            />
                        ))}
                        {a.local.map((s, si) => {
                            const r0 = magRadius(s.mag) * p0[si].scale;
                            return (
                                <g key={si}>
                                    {s.mag < 2.0 && (
                                        <circle
                                            ref={el => { haloRefs.current[ai][si] = el; }}
                                            cx={p0[si].sx} cy={p0[si].sy} r={r0 * 2.6}
                                            fill={gold} opacity="0.09"
                                        />
                                    )}
                                    <circle
                                        ref={el => { dotRefs.current[ai][si] = el; }}
                                        cx={p0[si].sx} cy={p0[si].sy} r={r0}
                                        fill={s.mag < 2.1 ? white : gold}
                                        filter="url(#nodeGlow)"
                                    />
                                </g>
                            );
                        })}
                    </g>
                );
            })}
        </>
    );
};

// --- CELESTIAL & HUD COMPONENTS ---

const MythicalConstellations: React.FC<{ p: BootPalette }> = ({ p }) => {
    // The starfield uses only the ink colour; the asterisms are drawn by Constellations3D.
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

            <Constellations3D p={p} />
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

const DiamondHalo: React.FC<{ p: BootPalette }> = ({ p }) => {
    const diamondPoints = "50,0 100,50 50,100 0,50";

    // Sizes relative to viewport so they look right on all screen sizes
    const rings = [
        { sizeVmin: 115, maxPx: 900, speed: 60, op: 0.05, color: p.accent, rev: false, dash: undefined },
        { sizeVmin: 70,  maxPx: 540, speed: 45, op: 0.15, color: p.ink,    rev: true,  dash: "4 12" },
        { sizeVmin: 52,  maxPx: 400, speed: 20, op: 0.25, color: p.accent, rev: false, dash: undefined },
    ];

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-60">
            {rings.map((ring, idx) => (
                <motion.svg
                    key={idx}
                    animate={{ rotate: ring.rev ? -360 : 360 }}
                    transition={{ duration: ring.speed, repeat: Infinity, ease: "linear" }}
                    viewBox="0 0 100 100"
                    className={`absolute ${blendFor(p)}`}
                    style={{
                        width: `clamp(120px, ${ring.sizeVmin}vmin, ${ring.maxPx}px)`,
                        height: `clamp(120px, ${ring.sizeVmin}vmin, ${ring.maxPx}px)`,
                        opacity: ring.op,
                        willChange: 'transform',
                    }}
                >
                    <polygon
                        points={diamondPoints}
                        fill="none"
                        stroke={ring.color}
                        strokeWidth="0.3"
                        strokeDasharray={ring.dash}
                    />
                </motion.svg>
            ))}
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
                    <DiamondHalo p={p} />
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={
                            isShattering
                                ? { scale: 3.5, opacity: 0, filter: 'drop-shadow(0 0 0px transparent)' }
                                : { scale: 1, opacity: 1, filter: isAwakened ? `drop-shadow(0 0 70px ${p.accent}80)` : `drop-shadow(0 0 20px ${p.accent}1a)` }
                        }
                        transition={{
                            duration: isShattering ? 1.0 : 1.8,
                            ease: isShattering ? "easeIn" : "easeOut",
                        }}
                        className={`relative z-30 flex items-center justify-center ${blendFor(p)}`}
                        style={{
                            /* Viewport-relative size: fills well on phones → tablets → laptops */
                            width:  'clamp(200px, min(70vw, 55vh), 560px)',
                            height: 'clamp(200px, min(70vw, 55vh), 560px)',
                            willChange: 'transform, opacity, filter',
                        }}
                    >
                        <AkashicCoreLogo theme={theme} animate={true} />
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
