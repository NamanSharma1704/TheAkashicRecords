import React, { useState, useEffect, useMemo } from 'react';
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

const gold = "#fbbf24";
const white = "#ffffff";

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

const MythicalConstellations: React.FC = () => {
    return (
        /*
         * KEY FIX: viewBox="0 0 1600 900" with preserveAspectRatio="xMidYMid slice"
         * keeps the coordinate system uniformly scaled on all screens so circles
         * remain circular (not stretched ovals) on phones, tablets, and laptops.
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
                    fill="white"
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
            {/* Positioned at ~15% x, 40% y of the 1600x900 viewport */}
            <motion.g
                animate={{ x: [0, 8, 0], y: [0, 5, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                opacity={0.75}
                style={{ willChange: 'transform' }}
            >
                <g transform="translate(240, 360)">
                    {/* Connection lines — thin gold threads */}
                    <line x1="0"   y1="0"    x2="48"  y2="-90"  stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    <line x1="48"  y1="-90" x2="128" y2="-60"  stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    <line x1="128" y1="-60" x2="176" y2="30"   stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    <line x1="176" y1="30"  x2="96"  y2="110"  stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    <line x1="96"  y1="110" x2="24"  y2="85"   stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    <line x1="24"  y1="85"  x2="0"   y2="0"    stroke={gold} strokeWidth="0.6" opacity="0.3" />
                    {/* Node dots — small, with glow filter only on these */}
                    <circle cx="0"   cy="0"   r="2"   fill={white} filter="url(#nodeGlow)" />
                    <circle cx="48"  cy="-90" r="1.5" fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="128" cy="-60" r="3"   fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="176" cy="30"  r="1.8" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="96"  cy="110" r="1.6" fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="24"  cy="85"  r="1.2" fill={white} filter="url(#nodeGlow)" />
                </g>
            </motion.g>

            {/* ── RIGHT CONSTELLATION: "The Gatekeeper's Sigil" ── */}
            {/* Positioned at ~80% x, 30% y */}
            <motion.g
                animate={{ x: [0, -8, 0], y: [0, 7, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                opacity={0.75}
                style={{ willChange: 'transform' }}
            >
                <g transform="translate(1280, 270)">
                    <path
                        d="M0 0 L64 45 L100 -30 L165 75 L115 150 L50 120 Z"
                        fill="none" stroke={gold} strokeWidth="0.6" strokeDasharray="6 6" opacity="0.3"
                    />
                    <circle cx="0"   cy="0"   r="2.2" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="64"  cy="45"  r="1.5" fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="100" cy="-30" r="3"   fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="165" cy="75"  r="1.8" fill={gold}  filter="url(#nodeGlow)" />
                    <circle cx="115" cy="150" r="2.5" fill={white} filter="url(#nodeGlow)" />
                    <circle cx="50"  cy="120" r="1.3" fill={gold}  filter="url(#nodeGlow)" />
                </g>
            </motion.g>
        </svg>
    );
};

const BackgroundDials: React.FC = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] mix-blend-screen">
            {/* Compass rings use clamp-based vmin sizing so they feel right on all screens */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
                className="absolute border border-amber-500 rounded-full border-dashed"
                style={{ width: 'clamp(320px, 90vmin, 1800px)', height: 'clamp(320px, 90vmin, 1800px)', willChange: 'transform' }}
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                className="absolute border border-white rounded-full opacity-50"
                style={{ width: 'clamp(240px, 70vmin, 1400px)', height: 'clamp(240px, 70vmin, 1400px)', willChange: 'transform' }}
            />
            {/* Coordinate Markers */}
            {Array.from({ length: 16 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute h-[1px] bg-amber-500/30"
                    style={{ width: 'clamp(240px, 70vmin, 1400px)', transform: `rotate(${i * (360 / 16)}deg)` }}
                />
            ))}
            {/* Diamond Frame Crosshairs */}
            <div className="absolute w-full h-full">
                <div className="absolute top-[15%] left-1/2 w-px h-16 sm:h-24 bg-gradient-to-b from-white/0 to-white/40 -translate-x-1/2" />
                <div className="absolute bottom-[15%] left-1/2 w-px h-16 sm:h-24 bg-gradient-to-t from-white/0 to-white/40 -translate-x-1/2" />
                <div className="absolute top-1/2 left-[15%] h-px w-16 sm:w-24 bg-gradient-to-r from-white/0 to-white/40 -translate-y-1/2" />
                <div className="absolute top-1/2 right-[15%] h-px w-16 sm:w-24 bg-gradient-to-l from-white/0 to-white/40 -translate-y-1/2" />
            </div>
        </div>
    );
};

const LateralTelemetry: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
    // Memoize the hex data so it doesn't regenerate on each render
    const rows = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
        hex: ((i * 0x13a7 + 0x4f2b) & 0xffffffff).toString(16).substring(0, 8).toUpperCase().padStart(8, '0'),
        val: ((i * 7.31 + 13.47) % 100).toFixed(2),
    })), []);

    return (
        <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-6 xl:left-8' : 'right-6 xl:right-8'} w-28 xl:w-32 pointer-events-none hidden xl:flex flex-col opacity-20 overflow-hidden font-orbitron z-0`}>
            <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="flex flex-col gap-8 text-[7px] text-white/50 tracking-[0.4em]"
                style={{ willChange: 'transform' }}
            >
                {rows.map((row, i) => (
                    <div key={i} className={`flex items-center gap-4 ${side === 'right' ? 'justify-end' : ''}`}>
                        {side === 'left' && <div className="w-[1px] h-4 bg-amber-500/50" />}
                        <span>{row.hex}</span>
                        <span>[{row.val}]</span>
                        {side === 'right' && <div className="w-[1px] h-4 bg-amber-500/50" />}
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

const CelestialVoid: React.FC = () => (
    <div className="absolute inset-0 z-0 bg-[#020202] overflow-hidden">
        {/* Layer 1: The 3D Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ perspective: '800px' }}>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:80px_80px] sm:bg-[size:100px_100px] [transform:rotateX(65deg)_translateZ(-200px)]" />
        </div>

        {/* Layer 2: Mana Mist — use motion instead of animate-pulse for GPU acceleration */}
        <motion.div
            animate={{ opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,transparent_70%)]"
            style={{ willChange: 'opacity' }}
        />

        <MythicalConstellations />
        <BackgroundDials />
        <LateralTelemetry side="left" />
        <LateralTelemetry side="right" />

        {/* Layer 3: Spatial Expansion Pulse */}
        <motion.div
            animate={{ scale: [0.3, 1.3], opacity: [0.15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-amber-500/30 rounded-full"
            style={{
                width: 'clamp(200px, 55vmin, 800px)',
                height: 'clamp(200px, 55vmin, 800px)',
                willChange: 'transform, opacity',
            }}
        />
    </div>
);

const DiamondHalo: React.FC = () => {
    const diamondPoints = "50,0 100,50 50,100 0,50";

    // Sizes relative to viewport so they look right on all screen sizes
    const rings = [
        { sizeVmin: 115, maxPx: 900, speed: 60, op: 0.05, color: gold, rev: false, dash: undefined },
        { sizeVmin: 70,  maxPx: 540, speed: 45, op: 0.15, color: white, rev: true,  dash: "4 12" },
        { sizeVmin: 52,  maxPx: 400, speed: 20, op: 0.25, color: gold, rev: false, dash: undefined },
    ];

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-60">
            {rings.map((ring, idx) => (
                <motion.svg
                    key={idx}
                    animate={{ rotate: ring.rev ? -360 : 360 }}
                    transition={{ duration: ring.speed, repeat: Infinity, ease: "linear" }}
                    viewBox="0 0 100 100"
                    className="absolute mix-blend-screen"
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

const SovereignHeader: React.FC = () => (
    <div className="absolute top-4 sm:top-8 md:top-12 left-4 sm:left-8 md:left-12 right-4 sm:right-8 md:right-12 z-40 flex justify-between items-start pointer-events-none font-orbitron text-[7px] sm:text-[9px] md:text-[11px] tracking-[0.4em] sm:tracking-[0.5em] uppercase">
        <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-sm animate-pulse" />
                <span className="text-white/40">NODE:</span>
                <span className="text-amber-400 font-medium">[7F:SOVEREIGN]</span>
            </div>
            <div className="w-32 sm:w-48 md:w-64 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <div className="flex flex-col items-end gap-2 sm:gap-3 text-right">
            <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-white/40">ACCESS:</span>
                <span className="text-amber-400 font-medium">GRANTED</span>
            </div>
            <div className="w-32 sm:w-48 md:w-64 h-[1px] bg-gradient-to-l from-white/10 to-transparent" />
        </div>
    </div>
);

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [isShattering, setIsShattering] = useState(false);
    const [isAwakened, setIsAwakened] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                const next = Math.min(prev + (100 / (8000 / 30)), 100);
                if (next === 100) {
                    clearInterval(interval);
                    setIsAwakened(true);
                    setTimeout(() => setIsShattering(true), 1600);
                    setTimeout(onComplete, 2600);
                }
                return next;
            });
        }, 30);

        const phaseInterval = setInterval(() => {
            setPhaseIndex(prev => (prev + 1) % AWAKENING_PHASES.length);
        }, 1600);

        return () => {
            clearInterval(interval);
            clearInterval(phaseInterval);
        };
    }, [onComplete]);

    return (
        <div
            className="fixed inset-0 z-[100] bg-[#020202] flex items-center justify-center overflow-hidden font-orbitron"
            style={{ willChange: 'opacity' }}
        >
            {/* Fade-out overlay — separate element for smoother composite */}
            <motion.div
                className="absolute inset-0 z-[200] bg-[#020202] pointer-events-none"
                animate={{ opacity: isShattering ? 1 : 0 }}
                transition={{ duration: 1.0, ease: "easeIn" }}
                style={{ willChange: 'opacity' }}
                onAnimationComplete={() => {
                    if (isShattering) onComplete();
                }}
            />

            <CelestialVoid />
            <SovereignHeader />

            <div className="relative z-30 flex flex-col items-center justify-between w-full h-full py-16 sm:py-20 md:py-24">

                {/* TOP SPACER for header clearance */}
                <div className="flex-shrink-0" style={{ height: 'clamp(40px, 6vh, 80px)' }} />

                {/* LOGO AREA — fills available vertical space between header and HUD */}
                <div className="relative flex items-center justify-center flex-1 w-full">
                    <DiamondHalo />
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={
                            isShattering
                                ? { scale: 3.5, opacity: 0, filter: 'drop-shadow(0 0 0px transparent)' }
                                : { scale: 1, opacity: 1, filter: isAwakened ? `drop-shadow(0 0 70px rgba(251,191,36,0.5))` : `drop-shadow(0 0 20px rgba(251,191,36,0.1))` }
                        }
                        transition={{
                            duration: isShattering ? 1.0 : 1.8,
                            ease: isShattering ? "easeIn" : "easeOut",
                        }}
                        className="relative z-30 flex items-center justify-center mix-blend-screen"
                        style={{
                            /* Viewport-relative size: fills well on phones → tablets → laptops */
                            width:  'clamp(200px, min(70vw, 55vh), 560px)',
                            height: 'clamp(200px, min(70vw, 55vh), 560px)',
                            willChange: 'transform, opacity, filter',
                        }}
                    >
                        <AkashicCoreLogo animate={true} />
                    </motion.div>
                </div>

                {/* BOTTOM LOADING HUD */}
                <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-xs sm:max-w-md md:max-w-2xl px-6 sm:px-10 md:px-12 flex-shrink-0 relative z-40">
                    <div className="flex w-full justify-between items-end gap-4">
                        {/* Phase label */}
                        <motion.div
                            key={phaseIndex}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="text-[7px] sm:text-[9px] md:text-[10px] tracking-[0.4em] sm:tracking-[0.5em] font-medium uppercase text-white/50 truncate"
                        >
                            {AWAKENING_PHASES[phaseIndex]}
                        </motion.div>

                        <div className="flex gap-3 sm:gap-4 items-center text-[7px] sm:text-[9px] md:text-[11px] tracking-[0.4em] sm:tracking-[0.5em] uppercase flex-shrink-0">
                            <span className={isAwakened ? "text-white animate-pulse" : "text-white/20"}>[STABLE]</span>
                            <span className="text-amber-400 font-bold tabular-nums">{Math.floor(progress)}%</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full">
                        <div className="h-[2px] w-full bg-white/10 relative overflow-hidden rounded-full">
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.12, ease: "linear" }}
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                    backgroundColor: gold,
                                    boxShadow: `0 0 16px ${gold}`,
                                    willChange: 'width',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* BOTTOM-LEFT TELEMETRY FOOTER */}
                <div className="absolute left-4 sm:left-8 md:left-12 bottom-4 sm:bottom-8 md:bottom-12 z-40 text-left text-[7px] sm:text-[9px] md:text-[11px] tracking-[0.4em] sm:tracking-[0.5em] leading-[2] uppercase hidden sm:block">
                    <div className="flex gap-4 sm:gap-8">
                        <span className="text-white/40 font-medium">SEC: <span className="text-amber-400">57</span></span>
                        <span className="text-white/40 font-medium">M_ID: <span className="text-amber-400">6E28</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
