import React, { useId } from 'react';
import { Theme } from '../../core/types';
import { avatarStageOf } from '../../utils/ranks';
import { StageFrame, StageHalo } from './AvatarStage';
import HunterPortrait from './HunterPortrait';

interface EntityAvatarProps {
    theme: Pick<Theme, 'id' | 'accentInk' | 'accentColor' | 'accentFillRGB' | 'border' | 'isDark'>;
    size?: number;
    className?: string;
    /** The player's rank: the frame evolves with it (AvatarStage.tsx). None, as on the sign-in
     *  screen, is the plain DORMANT Apostle. */
    rank?: string;
    /** No square of its own (border, plate, hover glow, the square rank frame): standing in
     *  the banner's portal, which is its frame there. The rank halo and the rings stay. */
    bare?: boolean;
}

const EntityAvatar: React.FC<EntityAvatarProps> = ({ theme, size = 64, className = "", rank, bare = false }) => {
    const stage = avatarStageOf(rank);
    const uid = `av${useId().replace(/:/g, '')}`;
    const goldColor = '#f59e0b';
    const mainColor = theme.id === 'LIGHT' ? '#7c3aed' : goldColor;
    const secondaryColor = theme.id === 'LIGHT' ? '#a78bfa' : '#fbbf24';


    return (
        <div
            className={`relative isolate group flex items-center justify-center overflow-hidden ${bare ? '' : `border ${theme.border} ${theme.isDark ? 'bg-[#0a0a0a]' : 'bg-[#eae1f5]'} hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)]`} ${className} transition-all duration-700`}
            style={{
                width: size,
                height: size,
                // The hover glow takes the accent fill: light still carried the cyan
                // ('6, 182, 212') from before the amethyst theme.
                ['--primary-rgb' as any]: theme.accentFillRGB
            }}
        >
            {/* 1. BACKGROUND HUD RINGS (DEFINED AS PHYSICAL HOLOGRAMS) */}
            <svg className="absolute inset-0 w-full h-full opacity-30 group-hover:opacity-60 transition-opacity duration-700 p-1">
                <defs>
                    <filter id="physGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="0.8" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={mainColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.2" />
                    </linearGradient>
                </defs>
                <g filter="url(#physGlow)">
                    {/* Background Circuitry Plate */}
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#ringGrad)" strokeWidth="0.5" strokeDasharray="5 2" className="opacity-40" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={mainColor} strokeWidth="0.25" strokeDasharray="1 10" className="motion-safe:animate-[spin_40s_linear_infinite]" />
                </g>
            </svg>

            {/* 1b. THE RANK HALO, behind the figure (from ARGENT). */}
            <StageHalo stage={stage} accent={theme.accentColor} uid={uid} />

            {/* 2. THE HUNTER: the owner's portrait (HunterPortrait.tsx), alive where the art glows,
                in the avatar's own rings and rank frame. It replaced the drawn Apostle. */}
            <HunterPortrait isDark={theme.isDark} size={size} />

            {/* The corner decals that named the drawn Apostle ("LVL_99 Root.Apostle",
                "Defined_State://True") went with it: they printed over the portrait's frame, and
                the level was not a real one. */}

            {/* THE RANK FRAME, over the figure. At DORMANT it is these two faint brackets; from
                FORGED the stage's own frame takes their place, and from PRISMATIC a band of
                light crosses it now and then. */}
            {bare ? null : stage === 0 ? (
                <>
                    <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${theme.border} opacity-40`} />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${theme.border} opacity-40`} />
                </>
            ) : (
                <StageFrame stage={stage} accent={theme.accentColor} uid={uid} />
            )}
            {stage >= 3 && !bare && <div aria-hidden="true" className="absolute inset-0 z-20 pointer-events-none rank-sheen" />}
        </div>
    );
};

export default EntityAvatar;
