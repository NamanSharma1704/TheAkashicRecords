import React from 'react';
import { CodexGlyph } from '../system/SystemGlyphs';
import { classColor } from './classColor';

/* The classes' emblems, as the profile draws them (moved out of HunterProfile.tsx,
   2026-11-13). */

// ── SYSTEM: HIGH-FIDELITY CUSTOM CLASS ARCHETYPES ──
const ArcaneIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Magic Circle Grid */}
        <circle cx="12" cy="12" r="9" strokeWidth="1" strokeDasharray="2 4" strokeLinecap="square" opacity="0.4" />
        <path d="M12 3 L12 21 M3 12 L21 12" strokeWidth="1" opacity="0.2" />
        {/* Core Crystal */}
        <polygon points="12,5 17,12 12,19 7,12" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" strokeLinejoin="miter" />
        {/* Floating Runes */}
        <polygon points="12,8 14,12 12,16 10,12" fill="currentColor" />
        <path d="M5 5 L7 7 M19 19 L17 17 M19 5 L17 7 M5 19 L7 17" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
);

const PlayerIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Shattered Impact Background */}
        <path d="M12 2L14 9L22 12L14 15L12 22L10 15L2 12L10 9Z" strokeWidth="1" strokeLinejoin="miter" opacity="0.2" fill="currentColor" fillOpacity="0.1" />
        {/* Aggressive Twin Serrated Daggers */}
        <path d="M4 20L10 14" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M8 12L17 3L21 3L21 7L12 16L8 12Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.3" strokeLinejoin="miter" />
        <path d="M20 4L14 10" strokeWidth="1.5" />
        <path d="M3 3L7 7" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
    </svg>
);

const IrregularIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Dimensional Rift */}
        <path d="M4 12 L10 4 L14 20 L20 12" strokeWidth="1" strokeLinejoin="miter" strokeDasharray="3 3" opacity="0.4" />
        {/* Erratic Strike */}
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" strokeLinejoin="miter" />
        <path d="M5 14H10M20 10H15" strokeWidth="3" strokeLinecap="square" />
        {/* Glitch Particles */}
        <rect x="2" y="5" width="2" height="2" fill="currentColor" />
        <rect x="19" y="19" width="3" height="1" fill="currentColor" />
    </svg>
);

const NecroIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Shadow Soldier Cowl */}
        <path d="M12 2 L6 8 L6 16 L12 22 L18 16 L18 8 Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1.5" strokeLinejoin="miter" />
        {/* Horns & Crown */}
        <path d="M12 2 L9 7 M12 2 L15 7" strokeWidth="1.5" />
        <path d="M5 6 L8 9 M19 6 L16 9" strokeWidth="1.5" />
        {/* Hollow Glaring Eyes */}
        <path d="M9 13 L11 11" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M15 13 L13 11" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M12 18 L12 16" strokeWidth="2" strokeLinecap="square" opacity="0.6" />
        {/* Aura Embers */}
        <circle cx="4" cy="18" r="1" fill="currentColor" />
        <circle cx="20" cy="18" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
);

const ConstellationIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Hexagonal Outer Eye Boundary */}
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        {/* Intersecting Orbit Coordinates */}
        <path d="M2 12 Q 12 2 22 12" strokeWidth="1.5" strokeLinecap="square" opacity="0.6" />
        <path d="M2 12 Q 12 22 22 12" strokeWidth="1.5" strokeLinecap="square" opacity="0.6" />
        {/* Inner God Eye Pupil */}
        <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
);

// ── CLASS ICON ENGINE ──
export const ClassIcon = ({ cls, isDark, className }: { cls: string, isDark?: boolean, className?: string }) => {
    const colorClass = classColor(cls, isDark ?? true);
    
    let Icon: React.ElementType = CodexGlyph;
    if (cls === 'MAGE') Icon = ArcaneIcon;
    else if (cls === 'PLAYER') Icon = PlayerIcon;
    else if (cls === 'IRREGULAR') Icon = IrregularIcon;
    else if (cls === 'NECROMANCER') Icon = NecroIcon;
    else if (cls === 'CONSTELLATION') Icon = ConstellationIcon;

    return (
        <div className={`relative flex items-center justify-center w-7 h-7 rounded bg-gradient-to-br from-current/20 to-transparent ${isDark ? 'border border-black/50' : 'border border-current/20'} ${colorClass} ${className}`}>
            <div className="absolute inset-0 bg-current/5 blur-sm" />
            <Icon className="relative z-10 w-4 h-4 drop-shadow-[0_0_8px_currentColor]" />
        </div>
    );
};
