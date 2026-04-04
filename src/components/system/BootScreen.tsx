import React, { useState, useEffect } from 'react';
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

// --- CELESTIAL & HUD COMPONENTS ---

const MythicalConstellations: React.FC = () => {
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
            <defs>
                <filter id="magnitudeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Left Constellation: "The Monarch's Crown" */}
            <motion.g 
                animate={{ x: [0, 10, 0], y: [0, 5, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="opacity-70"
            >
                <g style={{ transform: 'translate(15vw, 40vh)' }}>
                    <line x1="0" y1="0" x2="40" y2="-60" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    <line x1="40" y1="-60" x2="100" y2="-40" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    <line x1="100" y1="-40" x2="140" y2="20" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    <line x1="140" y1="20" x2="80" y2="80" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    <line x1="80" y1="80" x2="20" y2="60" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    <line x1="20" y1="60" x2="0" y2="0" stroke={gold} strokeWidth="0.4" opacity="0.25" />
                    
                    <circle cx="0" cy="0" r="2" fill={white} filter="url(#magnitudeGlow)" />
                    <circle cx="40" cy="-60" r="1.2" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="100" cy="-40" r="3" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="140" cy="20" r="1.6" fill={white} filter="url(#magnitudeGlow)" />
                    <circle cx="80" cy="80" r="1.4" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="20" cy="60" r="0.8" fill={white} filter="url(#magnitudeGlow)" />
                </g>
            </motion.g>

            {/* Right Constellation: "The Gatekeeper's Sigil" */}
            <motion.g 
                animate={{ x: [0, -10, 0], y: [0, 8, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="opacity-70"
            >
                <g style={{ transform: 'translate(80vw, 30vh)' }}>
                    <path d="M0 0 L50 30 L80 -20 L130 50 L90 100 L40 80 Z" fill="none" stroke={gold} strokeWidth="0.4" strokeDasharray="4 4" opacity="0.25" />
                    <circle cx="0" cy="0" r="1.8" fill={white} filter="url(#magnitudeGlow)" />
                    <circle cx="50" cy="30" r="1.2" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="80" cy="-20" r="2.6" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="130" cy="50" r="1.4" fill={gold} filter="url(#magnitudeGlow)" />
                    <circle cx="90" cy="100" r="2.2" fill={white} filter="url(#magnitudeGlow)" />
                    <circle cx="40" cy="80" r="1" fill={gold} filter="url(#magnitudeGlow)" />
                </g>
            </motion.g>

            {/* Deep Starfield with Stellar Drift */}
            {Array.from({ length: 140 }).map((_, i) => (
                <motion.circle 
                    key={i}
                    animate={{ x: [0, Math.random() * 20 - 10, 0], opacity: [0.1, 0.6, 0.1] }}
                    transition={{ 
                        x: { duration: Math.random() * 10 + 10, repeat: Infinity, ease: "linear" },
                        opacity: { duration: Math.random() * 4 + 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 5 }
                    }}
                    cx={`${Math.random() * 100}vw`} 
                    cy={`${Math.random() * 100}vh`} 
                    r={Math.random() * 1.5 + 0.3} 
                    fill="white" 
                />
            ))}
        </svg>
    );
};

const BackgroundDials: React.FC = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] mix-blend-screen">
            {/* Massive Outer Compass Rings */}
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 160, repeat: Infinity, ease: "linear" }} className="absolute w-[1800px] h-[1800px] border border-amber-500 rounded-full border-dashed" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 120, repeat: Infinity, ease: "linear" }} className="absolute w-[1400px] h-[1400px] border border-white rounded-full opacity-50" />
            {/* Coordinate Markers */}
            {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="absolute w-[1400px] h-[1px] bg-amber-500/30" style={{ transform: `rotate(${i * (360/16)}deg)` }} />
            ))}
            {/* Diamond Frame Crosshairs to Harmonize with Logo */}
            <div className="absolute w-full h-full">
               <div className="absolute top-[15%] left-1/2 w-px h-24 bg-gradient-to-b from-white/0 to-white/40 -translate-x-1/2" />
               <div className="absolute bottom-[15%] left-1/2 w-px h-24 bg-gradient-to-t from-white/0 to-white/40 -translate-x-1/2" />
               <div className="absolute top-1/2 left-[15%] w-24 h-px bg-gradient-to-r from-white/0 to-white/40 -translate-y-1/2" />
               <div className="absolute top-1/2 right-[15%] w-24 h-px bg-gradient-to-l from-white/0 to-white/40 -translate-y-1/2" />
            </div>
        </div>
    );
};

const LateralTelemetry: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
    return (
        <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-8' : 'right-8'} w-32 pointer-events-none hidden xl:flex flex-col opacity-20 overflow-hidden font-orbitron z-0`}>
             <motion.div 
                animate={{ y: ["0%", "-50%"] }} 
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="flex flex-col gap-8 text-[7px] text-white/50 tracking-[0.4em]"
             >
                {/* Scroll effect */}
                {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className={`flex items-center gap-4 ${side === 'right' ? 'justify-end' : ''}`}>
                         {side === 'left' && <div className="w-[1px] h-4 bg-amber-500/50" />}
                         <span>{Math.random().toString(16).substring(2, 10).toUpperCase()}</span>
                         <span>[{(Math.random() * 100).toFixed(2)}]</span>
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
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:100px_100px] [transform:rotateX(65deg)_translateZ(-200px)]" />
        </div>
        
        {/* Layer 2: Mana Mist & Mythical Stars */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,transparent_70%)] animate-pulse" />
        <MythicalConstellations />
        <BackgroundDials />
        <LateralTelemetry side="left" />
        <LateralTelemetry side="right" />

        {/* Layer 3: Spatial Expansion Pulse */}
        <motion.div 
            animate={{ scale: [0.3, 1.3], opacity: [0.15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-amber-500/30 rounded-full"
        />
    </div>
);

const DiamondHalo: React.FC = () => {
    // Points for a regular diamond/rhombus matching the logo shape
    const diamondPoints = "50,0 100,50 50,100 0,50";
    
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-[1.3] md:scale-[1.6] z-10 opacity-60">
            {/* Luminous Rotating Diamond Rims */}
            {[
                { size: 900, speed: 60, op: 0.05, color: gold, rev: false },
                { size: 540, speed: 45, op: 0.15, color: white, rev: true, dash: "4 12" }, 
                { size: 400, speed: 20, op: 0.25, color: gold, rev: false },
            ].map((diamond, idx) => (
                <motion.svg 
                    key={idx}
                    animate={{ rotate: diamond.rev ? -360 : 360 }}
                    transition={{ duration: diamond.speed, repeat: Infinity, ease: "linear" }}
                    viewBox="0 0 100 100"
                    className="absolute mix-blend-screen"
                    style={{ width: diamond.size, height: diamond.size, opacity: diamond.op }}
                >
                    <polygon 
                        points={diamondPoints}
                        fill="none" 
                        stroke={diamond.color} 
                        strokeWidth="0.3" 
                        strokeDasharray={diamond.dash}
                    />
                </motion.svg>
            ))}
        </div>
    );
};

const SovereignHeader: React.FC = () => (
    <div className="absolute top-8 md:top-12 left-8 md:left-12 right-8 md:right-12 z-40 flex justify-between items-start pointer-events-none font-orbitron text-[9px] md:text-[11px] tracking-[0.5em] uppercase">
        <div className="flex flex-col gap-3">
             <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-sm animate-pulse" />
                <span className="text-white/40">NODE:</span>
                <span className="text-amber-400 font-medium">[7F:SOVEREIGN]</span>
             </div>
             <div className="w-64 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <div className="flex flex-col items-end gap-3 text-right">
             <div className="flex items-center gap-4">
                <span className="text-white/40">ACCESS:</span>
                <span className="text-amber-400 font-medium">GRANTED</span>
             </div>
             <div className="w-64 h-[1px] bg-gradient-to-l from-white/10 to-transparent" />
        </div>
    </div>
);

const BootScreen: React.FC<BootScreenProps> = ({ onComplete, theme }) => {
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
            className={`fixed inset-0 z-[100] bg-[#020202] flex items-center justify-center overflow-hidden font-orbitron transition-opacity duration-[1200ms] ease-in-out ${isShattering ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            style={{ willChange: 'opacity' }}
        >
            <CelestialVoid />
            <SovereignHeader />

            <div className="relative z-30 flex flex-col items-center justify-center w-full h-full">
                
                {/* HARMONIZED DIAMOND CORE (No more Hexagons) */}
                <div className="relative flex items-center justify-center flex-1 w-full max-w-4xl max-h-[60vh] mt-12 md:mt-0">
                    <DiamondHalo />
                    {/* The logo itself serves as the hero text, so we make it much larger to command the space */}
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={
                            isShattering 
                                ? { scale: 3.5, rotate: 12, opacity: 0, filter: 'drop-shadow(0 0 0px transparent)' }
                                : { scale: 1, opacity: 1, filter: isAwakened ? `drop-shadow(0 0 70px rgba(251,191,36,0.5))` : `drop-shadow(0 0 30px rgba(251,191,36,0.1))` }
                        }
                        transition={{ duration: isShattering ? 1.2 : 2, ease: isShattering ? "easeIn" : "easeInOut" }}
                        className="relative z-30 w-full h-full md:w-[600px] md:h-[600px] flex items-center justify-center mix-blend-screen"
                    >
                        <AkashicCoreLogo animate={true} />
                    </motion.div>
                </div>

                {/* BOTTOM LOADING HUD (Replaces the massive redundant text block) */}
                <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-12 pb-16 md:pb-24 relative z-40">
                    <div className="flex w-full justify-between items-end">
                        {/* Current Protocol Phase displayed directly above the bar */}
                        <motion.div 
                            key={phaseIndex}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[9px] md:text-[10px] tracking-[0.5em] font-medium uppercase text-white/50"
                        >
                            {AWAKENING_PHASES[phaseIndex]}
                        </motion.div>

                        <div className="flex gap-4 items-center text-[9px] md:text-[11px] tracking-[0.5em] uppercase">
                            <span className={isAwakened ? "text-white animate-pulse" : "text-white/20"}>[STABLE]</span>
                            <span className="text-amber-400 font-bold">{Math.floor(progress)}%</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full space-y-2">
                        <div className="h-[2px] w-full bg-white/10 relative overflow-hidden rounded-full">
                            <motion.div 
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                className="h-full relative transition-all duration-300 rounded-full"
                                style={{ backgroundColor: gold, boxShadow: `0 0 20px ${gold}` }}
                            />
                        </div>
                    </div>
                </div>

                {/* BOTTOM-LEFT TELEMETRY FOOTER */}
                <div className="absolute left-8 md:left-12 bottom-8 md:bottom-12 z-40 text-left text-[9px] md:text-[11px] tracking-[0.5em] leading-[2] uppercase hidden sm:block">
                    <div className="flex gap-8">
                         <span className="text-white/40 font-medium">SEC: <span className="text-amber-400">57</span></span>
                         <span className="text-white/40 font-medium">M_ID: <span className="text-amber-400">6E28</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
