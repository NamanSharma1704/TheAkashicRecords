import React from 'react';
import { Theme } from '../../core/types';

/**
 * The background ring system of the Void, turning slowly: a summoning circle in the language of
 * the Mage's dais (2026-11-14). A graduated outer ring; a dotted ring; two seven-point star
 * figures inscribed together, {7/3} and the fainter {7/2}, with a seal at each point; an inner
 * pair of rings.
 *
 * Positioned by the parent via `className` (absolute) rather than pinned to the viewport; on
 * the dashboard that is HeroRings, which centres it on the hero card and sizes it so the outer
 * ring (radius 240 of 250) spans the screen's height. The light theme uses its own summoning
 * sigil (ArcaneSigil) instead; this is the dark theme's ring system.
 */

const C = 250;
const f1 = (n: number) => +n.toFixed(1);
/** Degrees clockwise from the top, as an SVG point. */
const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [f1(C + r * Math.sin(a)), f1(C - r * Math.cos(a))] as const;
};

/** The graduation: 120 marks inside the outer ring, every fifth one longer. */
const TICKS = Array.from({ length: 120 }, (_, i) => {
    const [x0, y0] = pt(i * 3, 240), [x1, y1] = pt(i * 3, i % 5 === 0 ? 228 : 234);
    return `M${x0} ${y0}L${x1} ${y1}`;
}).join('');

/** The star polygon {7/k} on radius 206. */
const STAR = (k: number) => Array.from({ length: 7 }, (_, j) => {
    const [x, y] = pt(((j * k) % 7) * (360 / 7), 206);
    return `${j ? 'L' : 'M'}${x} ${y}`;
}).join('') + 'Z';

/** A seal at each of the star's points. */
const SEALS = Array.from({ length: 7 }, (_, j) => pt(j * (360 / 7), 206));

const SanctuaryRing: React.FC<{ theme: Theme; isPaused?: boolean; className?: string }> = ({ theme, isPaused = false, className = '' }) => {
    const color = theme.isDark ? '#ffffff' : `rgb(${theme.starColor})`;
    return (
        <div className={`pointer-events-none absolute opacity-20 transition-opacity duration-700 ${className}`} aria-hidden="true">
            {/* motion-safe: the ring holds still under prefers-reduced-motion. */}
            <svg viewBox="0 0 500 500" className={`w-full h-full ${!isPaused ? 'motion-safe:animate-[spin_120s_linear_infinite]' : ''}`} style={{ overflow: 'visible' }}>
                <circle cx={C} cy={C} r="240" fill="none" stroke={color} strokeWidth="1.2" opacity="0.55" />
                <path d={TICKS} fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
                <circle cx={C} cy={C} r="220" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 7" opacity="0.4" />
                <circle cx={C} cy={C} r="206" fill="none" stroke={color} strokeWidth="1" opacity="0.25" />
                <path d={STAR(3)} fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />
                <path d={STAR(2)} fill="none" stroke={color} strokeWidth="1" opacity="0.2" />
                {SEALS.map(([x, y], i) => (
                    <g key={i}>
                        <circle cx={x} cy={y} r="9" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
                        <circle cx={x} cy={y} r="2.5" fill={color} opacity="0.55" />
                    </g>
                ))}
                <circle cx={C} cy={C} r="132" fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
                <circle cx={C} cy={C} r="120" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 6" opacity="0.25" />
            </svg>
        </div>
    );
};

export default SanctuaryRing;
