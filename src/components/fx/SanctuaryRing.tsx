import React from 'react';
import { Theme } from '../../core/types';

/**
 * The concentric background rings of the Void — simple dashed circles that turn slowly.
 *
 * Positioned by the parent via `className` (absolute) rather than pinned to the viewport, so on
 * the dashboard it can sit centred on the hero card instead of the screen centre. The light theme
 * uses its own summoning-sigil (ArcaneSigil) instead; this is the dark theme's ring system.
 */
const SanctuaryRing: React.FC<{ theme: Theme; isPaused?: boolean; className?: string }> = ({ theme, isPaused = false, className = '' }) => {
    const color = theme.isDark ? '#ffffff' : `rgb(${theme.starColor})`;
    return (
        <div className={`pointer-events-none absolute opacity-20 transition-opacity duration-700 ${className}`} aria-hidden="true">
            {/* motion-safe: the ring holds still under prefers-reduced-motion. */}
            <svg viewBox="0 0 500 500" className={`w-full h-full ${!isPaused ? 'motion-safe:animate-[spin_120s_linear_infinite]' : ''}`} style={{ overflow: 'visible' }}>
                <circle cx="250" cy="250" r="240" fill="none" stroke={color} strokeWidth="1" strokeDasharray="10 20 40 20" opacity="0.5" className="transition-colors duration-700" />
                <circle cx="250" cy="250" r="200" fill="none" stroke={color} strokeWidth="2" strokeDasharray="100 200" opacity="0.3" className="transition-colors duration-700" />
                <circle cx="250" cy="250" r="220" fill="none" stroke={color} strokeWidth="4" strokeDasharray="5 15" opacity="0.2" className="transition-colors duration-700" />
            </svg>
        </div>
    );
};

export default SanctuaryRing;
