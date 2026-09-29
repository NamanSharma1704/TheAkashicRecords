import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';

/**
 * The arcane summoning-circle of the light theme — a slow, counter-rotating sigil of concentric
 * rings, a ruled astrolabe tick-band, a hexagram and a ring of orbiting runes.
 *
 * Unlike the flowing aurora ({@link IlluminatedCodex}), which is a full-page field, this is
 * centred on the HERO — the card and the holographic platform it stands on — so the platform
 * reads as sitting at the exact centre of the circle. It is therefore rendered by the hero and
 * positioned by its parent (via `className`), not pinned to the viewport. Line-art only and very
 * faint, so it adds motion and identity without clouding the content that sits inside it.
 *
 * Light only. Motion is pure transform and holds a still frame under reduced-motion / pause.
 */

const GLYPHS = ['✦', '◈', '✧', '⧫', '✵', '❉', '❖', '⟡'];

interface Props {
    theme: Theme;
    paused?: boolean;
    /** Positioning + sizing of the wrapper (e.g. "left-1/2 top-1/2 w-[230%] ..."). */
    className?: string;
}

const ArcaneSigil: React.FC<Props> = ({ theme, paused = false, className = '' }) => {
    const reducedMotion = useReducedMotion();
    const still = reducedMotion || paused;

    // Bare "r,g,b" of the accent so the sigil follows the theme token.
    const rgb = useMemo(() => {
        const h = theme.accentColor.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    }, [theme.accentColor]);

    // Ruled tick-band — 72 marks, every 6th longer, like an astrolabe scale.
    const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const long = i % 6 === 0;
        const r1 = 168;
        const r2 = long ? 180 : 174;
        return {
            x1: 200 + r1 * Math.cos(a), y1: 200 + r1 * Math.sin(a),
            x2: 200 + r2 * Math.cos(a), y2: 200 + r2 * Math.sin(a),
            w: long ? 1.4 : 0.8,
        };
    }), []);

    // Ring of orbiting runes.
    const runes = useMemo(() => Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = 143;
        return { x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a), g: GLYPHS[i % GLYPHS.length] };
    }), []);

    // Two point-sets for the hexagram (two overlaid triangles).
    const hexPts = (offset: number) => Array.from({ length: 3 }, (_, k) => {
        const a = (offset + k * 120) * Math.PI / 180 - Math.PI / 2;
        const r = 104;
        return `${(200 + r * Math.cos(a)).toFixed(1)},${(200 + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    return (
        <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
            <svg viewBox="0 0 400 400" className="w-full h-full" style={{ overflow: 'visible' }}>
                {/* Outer half — rings, ruled band and hexagram — turning one way. */}
                <motion.g
                    style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}
                    animate={still ? {} : { rotate: 360 }}
                    transition={{ duration: 260, repeat: Infinity, ease: 'linear' }}
                >
                    <circle cx="200" cy="200" r="190" fill="none" stroke={`rgba(${rgb},0.09)`} strokeWidth="1" />
                    <circle cx="200" cy="200" r="162" fill="none" stroke={`rgba(${rgb},0.11)`} strokeWidth="1" strokeDasharray="1 7" />
                    <circle cx="200" cy="200" r="120" fill="none" stroke={`rgba(${rgb},0.10)`} strokeWidth="1" />
                    {ticks.map((t, i) => (
                        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={`rgba(${rgb},0.12)`} strokeWidth={t.w} />
                    ))}
                    <polygon points={hexPts(0)} fill="none" stroke={`rgba(${rgb},0.08)`} strokeWidth="1" />
                    <polygon points={hexPts(60)} fill="none" stroke={`rgba(${rgb},0.08)`} strokeWidth="1" />
                </motion.g>

                {/* Inner half — a dashed ring and the runes — counter-rotating. */}
                <motion.g
                    style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}
                    animate={still ? {} : { rotate: -360 }}
                    transition={{ duration: 200, repeat: Infinity, ease: 'linear' }}
                >
                    <circle cx="200" cy="200" r="143" fill="none" stroke={`rgba(${rgb},0.07)`} strokeWidth="1" strokeDasharray="3 9" />
                    <circle cx="200" cy="200" r="64" fill="none" stroke={`rgba(${rgb},0.11)`} strokeWidth="1" />
                    {runes.map((r, i) => (
                        <text
                            key={i}
                            x={r.x}
                            y={r.y}
                            fill={`rgba(${rgb},0.20)`}
                            fontSize="13"
                            textAnchor="middle"
                            dominantBaseline="central"
                        >
                            {r.g}
                        </text>
                    ))}
                </motion.g>
            </svg>
        </div>
    );
};

export default React.memo(ArcaneSigil);
