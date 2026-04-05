import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';

interface AkashicCoreLogoProps {
    theme?: Theme;
    className?: string;
    animate?: boolean;
}

const AkashicCoreLogo: React.FC<AkashicCoreLogoProps> = ({ className = "w-full h-full", animate = true }) => {
    // Premium gold palette matching the reference image exactly
    const goldPrm = "#F4C430"; // Bright glowing gold for highlights
    const goldMid = "#D4AF37"; // Metallic mid-tone
    const goldDrk = "#B8860B"; // Dark goldenrod for 3D shadows/depth
    const glowPls = "#FFF8DC"; // Cornsilk/white for intense core flare
    
    // Animation timing logic for sequential architectural build
    const dur = 2.5; 
    const wireframeDraw = animate ? { duration: dur, ease: "easeInOut" as const } : { duration: 0 };
    const riseAnim = animate ? { duration: dur - 0.5, ease: "easeOut" as const } : { duration: 0 };
    const flashAnim = animate ? { duration: 1.5, ease: "easeOut" as const } : { duration: 0 };

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[120%] h-[120%] overflow-visible drop-shadow-2xl">
                <defs>
                    <filter id="hyperGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur1" />
                        <feGaussianBlur stdDeviation="15" result="blur2" />
                        <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={glowPls} />
                        <stop offset="30%" stopColor={goldPrm} />
                        <stop offset="80%" stopColor={goldMid} />
                        <stop offset="100%" stopColor={goldDrk} />
                    </linearGradient>
                    <linearGradient id="shadowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={goldMid} />
                        <stop offset="100%" stopColor="#8B6508" />
                    </linearGradient>
                </defs>

                {/* --- 1. THE CENTRAL SUN / CORE FLARE --- */}
                <motion.circle 
                    cx="200" cy="120" r="14" 
                    fill={glowPls} 
                    filter="url(#hyperGlow)"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: animate ? [0, 1.5, 1.1] : 1.1, opacity: animate ? [0, 1, 0.8] : 0.8 }}
                    transition={{ ...flashAnim, delay: dur }}
                />

                <g filter="url(#softGlow)">
                    {/* --- 2. THE TOP ASCENSION TRIANGLE (Halo) --- */}
                    <motion.path 
                        d="M200 60 L140 145 M200 60 L260 145" 
                        stroke={goldPrm} 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ ...wireframeDraw, delay: 0.1 }}
                    />
                    {/* Inner ascension accent lines */}
                    <motion.path 
                        d="M200 80 L160 140 M200 80 L240 140" 
                        stroke={goldMid} 
                        strokeWidth="1" 
                        opacity="0.6"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ ...wireframeDraw, delay: 0.3 }}
                    />

                    {/* --- 3. DIAMOND FACET WIREFRAME (Outer Shell) --- */}
                    {/* Outer V-Hull */}
                    <motion.path 
                        d="M200 300 L60 160 L120 120" 
                        stroke={goldPrm} strokeWidth="3" strokeLinejoin="round" fill="none"
                        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={wireframeDraw}
                    />
                    <motion.path 
                        d="M200 300 L340 160 L280 120" 
                        stroke={goldPrm} strokeWidth="3" strokeLinejoin="round" fill="none"
                        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={wireframeDraw}
                    />

                    {/* Left Truss Webbing */}
                    <motion.g stroke={goldMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{...wireframeDraw, delay: 0.4}}>
                        <path d="M60 160 L165 160" />
                        <path d="M100 135 L170 135" />
                        <path d="M120 120 L175 120" />
                        <path d="M120 120 L200 240 M100 135 L200 270 M80 147 L120 200" />
                    </motion.g>

                    {/* Right Truss Webbing */}
                    <motion.g stroke={goldMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{...wireframeDraw, delay: 0.4}}>
                        <path d="M340 160 L235 160" />
                        <path d="M300 135 L230 135" />
                        <path d="M280 120 L225 120" />
                        <path d="M280 120 L200 240 M300 135 L200 270 M320 147 L280 200" />
                    </motion.g>

                    {/* Left and Right Glowing Data Nodes */}
                    <motion.g stroke={goldPrm} strokeWidth="1.5"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: dur }}>
                        {/* Far Left Node */}
                        <line x1="130" y1="180" x2="130" y2="210" />
                        <circle cx="130" cy="180" r="3" fill={glowPls} />
                        {/* Mid Left Node */}
                        <line x1="145" y1="165" x2="145" y2="230" />
                        <circle cx="145" cy="165" r="3" fill={glowPls} />
                        
                        {/* Far Right Node */}
                        <line x1="270" y1="180" x2="270" y2="210" />
                        <circle cx="270" cy="180" r="3" fill={glowPls} />
                        {/* Mid Right Node */}
                        <line x1="255" y1="165" x2="255" y2="230" />
                        <circle cx="255" cy="165" r="3" fill={glowPls} />
                    </motion.g>

                    {/* --- 4. THE TOWERS (3D Architectural Extrusions) --- */}
                    <g transform="translate(0,0)" className="origin-bottom">
                        {/* Left Secondary Tower */}
                        <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ ...riseAnim, delay: 1.0 }} style={{ transformOrigin: "center 260px" }}>
                            {/* Face */}
                            <path d="M158 245 L158 160 L168 145 L178 160 L178 245 Z" fill="url(#goldGradient)" />
                            {/* Shadow Side */}
                            <path d="M168 145 L178 160 L178 245 L168 245 Z" fill="url(#shadowGradient)" />
                            {/* Tech Detailing */}
                            <path d="M168 210 L168 245" stroke={glowPls} strokeWidth="1" />
                        </motion.g>

                        {/* Right Secondary Tower */}
                        <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ ...riseAnim, delay: 1.2 }} style={{ transformOrigin: "center 260px" }}>
                            {/* Face */}
                            <path d="M222 245 L222 160 L232 145 L242 160 L242 245 Z" fill="url(#goldGradient)" />
                            {/* Shadow Side */}
                            <path d="M232 145 L242 160 L242 245 L232 245 Z" fill="url(#shadowGradient)" />
                            {/* Tech Detailing */}
                            <path d="M232 210 L232 245" stroke={glowPls} strokeWidth="1" />
                        </motion.g>

                        {/* The Prime Central Tower */}
                        <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ ...riseAnim, delay: 1.4 }} style={{ transformOrigin: "center 280px" }}>
                            {/* Main Hexagonal Face */}
                            <path d="M182 280 L182 130 L200 100 L218 130 L218 280 Z" fill="url(#goldGradient)" />
                            {/* 3D Depth Shadow Split */}
                            <path d="M200 100 L218 130 L218 280 L200 280 Z" fill="url(#shadowGradient)" />
                            
                            {/* Central Glowing Arch Doorway */}
                            <path d="M190 280 L200 240 L210 280 Z" fill={glowPls} filter="url(#hyperGlow)" />
                            <path d="M190 280 L200 240 L210 280 Z" fill="#FFF" />

                            {/* Cybernet Lines/Windows */}
                            <g stroke={glowPls} strokeWidth="2" opacity="0.8">
                                <line x1="192" y1="140" x2="192" y2="150" />
                                <line x1="192" y1="160" x2="192" y2="170" />
                                <line x1="192" y1="180" x2="192" y2="190" />
                            </g>
                        </motion.g>
                    </g>
                </g>

                {/* --- 5. ORBITRON TEXT LOGO --- */}
                <motion.text 
                    x="200" y="340" 
                    textAnchor="middle" 
                    fill="url(#goldGradient)"
                    className="font-orbitron font-black uppercase tracking-[0.4em] text-[22px]"
                    style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.8)) drop-shadow(0px 0px 8px rgba(244,196,48,0.4))" }}
                    initial={{ opacity: 0, y: 10, letterSpacing: "1em" }}
                    animate={{ opacity: 1, y: 0, letterSpacing: "0.4em" }}
                    transition={{ duration: 1.5, delay: dur + 0.5, ease: "easeOut" }}
                >
                    AKASHIC RECORDS
                </motion.text>
            </svg>
        </div>
    );
};

export default React.memo(AkashicCoreLogo);
