import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
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
type BootPalette = { accent: string; ink: string; ground: string; isDark: boolean };

const paletteFor = (theme: Theme): BootPalette => theme.isDark
    ? { accent: '#fbbf24', ink: '#ffffff', ground: '#020202', isDark: true }
    : { accent: theme.accentColor, ink: '#0f172a', ground: '#f8fafc', isDark: false };

// Screen blending only lifts against a dark ground; on the light theme it erases the art.
const blendFor = (p: BootPalette) => p.isDark ? 'mix-blend-screen' : 'mix-blend-multiply';

// --- Pre-computed star data to avoid Math.random() in render ---
type StarData = {
    cx: number;
    cy: number;
    r: number;
    dx: number;
    opDur: number;
    opDelay: number;
    xDur: number;
};

function generateStars(count: number): StarData[] {
    // Deterministic positions in 1600x900 viewBox space (golden-ratio distribution)
    const stars: StarData[] = [];
    const phi = 1.6180339887;
    for (let i = 0; i < count; i++) {
        const t = (i * phi) % 1;
        const u = (i * 0.7319) % 1;
        stars.push({
            cx: (i * 37.1 * 16 + 13) % 1600,   // 0–1600 px space
            cy: (i * 23.7 * 9  +  7) % 900,    // 0–900 px space
            r:  0.4 + t * 0.8,                  // 0.4–1.2 px — pinpoint sized
            dx: (u * 12) - 6,                   // subtle horizontal drift in px
            opDur:  2 + t * 3,
            opDelay: u * 5,
            xDur:   12 + u * 10,
        });
    }
    return stars;
}

const STAR_DATA = generateStars(110);

// --- CELESTIAL & HUD COMPONENTS ---

const MythicalConstellations: React.FC<{ p: BootPalette }> = ({ p }) => {
    const { accent: gold, ink: white } = p;
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
                    r={star.r}        // 0.4–1.2 px in 1600x900 space — true pinpoints
                    fill={white}
                    animate={{
                        x:       [0, star.dx, 0],
                        opacity: [0.08, 0.60, 0.08],
                    }}
                    transition={{
                        x:       { duration: star.xDur, repeat: Infinity, ease: "linear" },
                        opacity: { duration: star.opDur, repeat: Infinity, ease: "easeInOut", delay: star.opDelay },
                    }}
                    style={{ willChange: 'transform, opacity' }}
                />
            ))}

            {/* ── LEFT CONSTELLATION: "The Monarch's Crown" ── */}
            <motion.g
                animate={{ x: [0, 10, 0], y: [0, 6, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                opacity={0.8}
                style={{ willChange: 'transform' }}
            >
                <g transform="translate(180, 520)">
                    {/* Faint distant connections */}
                    <line x1="-40" y1="20" x2="60" y2="-90" stroke={gold} strokeWidth="0.3" opacity="0.15" />
                    <line x1="60" y1="-90" x2="220" y2="-120" stroke={gold} strokeWidth="0.4" opacity="0.2" />
                    <line x1="140" y1="-10" x2="300" y2="40" stroke={gold} strokeWidth="0.3" opacity="0.15" strokeDasharray="2 4" />

                    {/* Primary constellation branches */}
                    <path d="M0,0 L60,-90 L140,-10 L200,60" fill="none" stroke={gold} strokeWidth="0.8" opacity="0.35" />
                    <path d="M140,-10 L220,-120 L270,-40 L200,60" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.25" />
                    <path d="M220,-120 L320,-80 L270,-40" fill="none" stroke={gold} strokeWidth="0.5" opacity="0.2" />

                    {/* Major star nodes */}
                    <circle cx="0" cy="0" r="2.5" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="60" cy="-90" r="1.5" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="140" cy="-10" r="3.5" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="200" cy="60" r="2" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="220" cy="-120" r="2.5" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="270" cy="-40" r="1.5" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="320" cy="-80" r="2" fill={gold} filter="url(#nodeGlow)" />

                    {/* Minor background stars */}
                    <circle cx="-40" cy="20" r="1" fill={white} opacity="0.5" />
                    <circle cx="300" cy="40" r="1.2" fill={gold} opacity="0.6" />
                </g>
            </motion.g>

            {/* ── RIGHT CONSTELLATION: "The Gatekeeper's Eye" ── */}
            <motion.g
                animate={{ x: [0, -12, 0], y: [0, 8, 0], rotate: [0, -1, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                opacity={0.8}
                style={{ willChange: 'transform' }}
                transformOrigin="center"
            >
                <g transform="translate(1050, 250)">
                    {/* Ethereal background web */}
                    <path d="M-50,80 L40,-30 L160,-60 L240,20 L130,120 Z" fill="none" stroke={gold} strokeWidth="0.3" opacity="0.1" />

                    {/* Core geometric frame */}
                    <path d="M0,0 L100,-40 L200,30 L110,80 Z" fill="none" stroke={gold} strokeWidth="0.8" opacity="0.4" />

                    {/* Intersecting central lines (The pupil) */}
                    <line x1="40" y1="20" x2="160" y2="10" stroke={gold} strokeWidth="0.6" strokeDasharray="4 6" opacity="0.3" />
                    <line x1="100" y1="-40" x2="110" y2="80" stroke={gold} strokeWidth="0.6" opacity="0.3" />

                    {/* Trailing tail */}
                    <path d="M200,30 L280,-10 L360,-20" fill="none" stroke={white} strokeWidth="0.5" opacity="0.25" strokeDasharray="3 3" />

                    {/* Star nodes */}
                    <circle cx="0" cy="0" r="2" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="100" cy="-40" r="3" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="200" cy="30" r="2.5" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="110" cy="80" r="1.5" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="40" cy="20" r="1.2" fill={gold} opacity="0.8" filter="url(#nodeGlow)" />
                    <circle cx="160" cy="10" r="1.2" fill={gold} opacity="0.8" filter="url(#nodeGlow)" />
                    <circle cx="280" cy="-10" r="2" fill={gold} filter="url(#nodeGlow)" />
                    <circle cx="360" cy="-20" r="1.5" fill={white} filter="url(#nodeGlow)" />

                    {/* Floating space dust around the eye */}
                    <circle cx="-50" cy="80" r="1" fill={white} opacity="0.4" />
                    <circle cx="40" cy="-30" r="0.8" fill={gold} opacity="0.5" />
                    <circle cx="160" cy="-60" r="1.2" fill={white} opacity="0.6" />
                    <circle cx="240" cy="20" r="0.8" fill={gold} opacity="0.5" />
                    <circle cx="130" cy="120" r="1" fill={white} opacity="0.4" />
                </g>
            </motion.g>
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

const LateralTelemetry: React.FC<{ side: 'left' | 'right'; p: BootPalette }> = ({ side, p }) => {
    // Memoize the hex data so it doesn't regenerate on each render
    const rows = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
        hex: ((i * 0x13a7 + 0x4f2b) & 0xffffffff).toString(16).substring(0, 8).toUpperCase().padStart(8, '0'),
        val: ((i * 7.31 + 13.47) % 100).toFixed(2),
    })), []);

    return (
        <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-6 xl:left-8' : 'right-6 xl:right-8'} w-28 xl:w-32 pointer-events-none hidden xl:flex flex-col ${p.isDark ? 'opacity-20' : 'opacity-30'} overflow-hidden font-orbitron z-0`}>
            <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="flex flex-col gap-8 text-[7px] tracking-[0.4em]"
                style={{ color: `${p.ink}80`, willChange: 'transform' }}
            >
                {rows.map((row, i) => (
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
                <span style={{ color: `${p.ink}66` }}>NODE:</span>
                <span className="font-medium" style={{ color: p.accent }}>[7F:SOVEREIGN]</span>
            </div>
            <div className="w-32 sm:w-48 md:w-64 h-[1px]" style={{ background: `linear-gradient(to right, ${p.ink}1a, transparent)` }} />
        </div>
        <div className="flex flex-col items-end gap-2 sm:gap-3 text-right">
            <div className="flex items-center gap-2 sm:gap-4">
                <span style={{ color: `${p.ink}66` }}>ACCESS:</span>
                <span className="font-medium" style={{ color: p.accent }}>GRANTED</span>
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

            <CelestialVoid p={p} />
            <SovereignHeader p={p} />

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
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.3em] font-medium uppercase truncate"
                                    style={{ color: `${p.ink}80` }}
                                >
                                    {AWAKENING_PHASES[phaseIndex]}
                                </motion.div>

                                <div className="flex gap-3 sm:gap-4 items-center text-[8px] sm:text-[9px] md:text-[10px] tracking-[0.3em] uppercase flex-shrink-0">
                                    <span
                                        className={isAwakened ? "animate-pulse" : ""}
                                        style={{ color: isAwakened ? p.ink : `${p.ink}33` }}
                                    >
                                        [STABLE]
                                    </span>
                                    <span className="font-orbitron font-bold tabular-nums" style={{ color: p.accent }}>
                                        {Math.floor(progress)}%
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full">
                                <div
                                    className="h-[2px] w-full relative overflow-hidden rounded-full"
                                    style={{ backgroundColor: `${p.ink}1a` }}
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

                {/* BOTTOM-LEFT TELEMETRY FOOTER */}
                <div className="absolute left-4 sm:left-8 md:left-12 bottom-4 sm:bottom-8 md:bottom-12 z-40 text-left text-[7px] sm:text-[9px] md:text-[10px] tracking-[0.3em] leading-[2] uppercase hidden sm:block">
                    <div className="flex gap-4 sm:gap-8">
                        <span className="font-medium" style={{ color: `${p.ink}66` }}>SEC: <span style={{ color: p.accent }}>57</span></span>
                        <span className="font-medium" style={{ color: `${p.ink}66` }}>M_ID: <span style={{ color: p.accent }}>6E28</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
