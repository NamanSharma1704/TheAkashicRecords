import React from 'react';

interface EntityAvatarProps {
    theme: {
        id: string;
        highlightText: string;
        border: string;
        isDark: boolean;
        gradient: string;
        primary: string;
    };
    size?: number;
    className?: string;
}

const EntityAvatar: React.FC<EntityAvatarProps> = ({ theme, size = 64, className = "" }) => {
    const goldColor = '#f59e0b';
    const mainColor = theme.id === 'LIGHT' ? '#06b6d4' : goldColor;
    const secondaryColor = theme.id === 'LIGHT' ? '#22d3ee' : '#fbbf24';

    // Trifold Palette: Black hood/armor, White face/chest, Golden energy
    const hoodColor = '#0a0a0a'; // Always black hood for structure
    const whitePlate = '#fafafa';
    const armorBase = '#1a1a1a';
    const armorMid = '#2a2a2a';
    const armorDeep = '#111111';

    return (
        <div
            className={`relative group flex items-center justify-center overflow-hidden border ${theme.border} ${theme.isDark ? 'bg-[#0a0a0a]' : 'bg-[#f5f5f5]'} ${className} transition-all duration-700 hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)]`}
            style={{
                width: size,
                height: size,
                ['--primary-rgb' as any]: theme.id === 'LIGHT' ? '6, 182, 212' : '245, 158, 11'
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
                    <circle cx="50" cy="50" r="42" fill="none" stroke={mainColor} strokeWidth="0.25" strokeDasharray="1 10" className="animate-[spin_40s_linear_infinite]" />
                </g>
            </svg>

            {/* 2. HIGH-DEFINITION SYNTHETIC APOSTLE (SOLID VOLUMETRIC) */}
            <svg
                viewBox="0 0 100 100"
                className="w-[94%] h-[94%] relative z-10"
            >
                <defs>
                    {/* Metallic Armor Gradient */}
                    <linearGradient id="armorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={armorBase} />
                        <stop offset="50%" stopColor={armorMid} />
                        <stop offset="100%" stopColor={armorDeep} />
                    </linearGradient>
                    {/* White Divine Plate Gradient */}
                    <linearGradient id="whiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fff" />
                        <stop offset="100%" stopColor="#ddd" />
                    </linearGradient>
                    {/* Themed Overlay Gradient (Makes the Apostle feel themed) */}
                    <linearGradient id="themeOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={mainColor} stopOpacity="0.05" />
                        <stop offset="100%" stopColor={mainColor} stopOpacity="0.15" />
                    </linearGradient>
                    {/* Energy Highlight Gradient */}
                    <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={mainColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
                    </linearGradient>
                    {/* Volumetric Shadow Filter */}
                    <filter id="volScale" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
                    </filter>
                </defs>

                <g className="transition-all duration-1000 group-hover:scale-[1.03] origin-bottom" filter="url(#volScale)">

                    {/* A. ARMORED SHOULDERS (SOLID DEFINITION) - BLACK */}
                    <g fill="url(#armorGrad)" stroke="#333" strokeWidth="0.4">
                        {/* Shadow layers for depth */}
                        <path d="M12 85 L22 55 L40 50 L45 85 Z" fill="#000" transform="translate(1,1)" opacity="0.3" />
                        {/* Main Shoulder Plate Left */}
                        <path d="M12 85 L22 55 L40 50 L45 85 Z" className="transition-all duration-700 group-hover:opacity-90" />
                        {/* Main Shoulder Plate Right */}
                        <path d="M88 85 L78 55 L60 50 L55 85 Z" className="transition-all duration-700 group-hover:opacity-90" />

                        {/* Themed definition lines on shoulders */}
                        <path d="M15 82 L24 58" fill="none" stroke={mainColor} strokeWidth="0.3" opacity="0.4" />
                        <path d="M85 82 L76 58" fill="none" stroke={mainColor} strokeWidth="0.3" opacity="0.4" />

                        {/* Chest Base - Black */}
                        <path d="M38 55 L62 55 L60 85 L40 85 Z" fill="#111" />
                    </g>

                    {/* B. CENTRAL DIVINE PLATES - WHITE */}
                    <g fill="url(#whiteGrad)" stroke="#333" strokeWidth="0.2">
                        {/* Central Chest Plate */}
                        <path d="M42 58 L58 58 L56 80 L44 80 Z" />
                        <path d="M42 58 L58 58 L56 80 L44 80 Z" fill="url(#themeOverlay)" opacity="0.4" />
                    </g>

                    {/* C. ENERGY CORE & VENTS - GOLDEN */}
                    <g fill={mainColor}>
                        {/* Shoulder Lights */}
                        <rect x="20" y="60" width="3" height="12" className="animate-pulse" opacity="0.4" />
                        <rect x="77" y="60" width="3" height="12" className="animate-pulse" opacity="0.4" />
                        {/* Chest Reactor */}
                        <path d="M48 62 L52 62 L51 68 L49 68 Z" className="animate-ping" opacity="0.6" />
                        <rect x="47" y="60" width="6" height="1" opacity="0.8" />
                    </g>

                    {/* D. THE HOOD - BLACK */}
                    <g>
                        {/* Outer Hood - Deep Black */}
                        <path
                            d="M28 50 Q28 2 50 2 Q72 2 72 50 L78 62 Q50 54 22 62 Z"
                            fill={hoodColor}
                            stroke="#222"
                            strokeWidth="0.75"
                        />
                        {/* Themed Hood definition line */}
                        <path d="M50 2 L50 15" fill="none" stroke={mainColor} strokeWidth="0.2" opacity="0.4" />

                        {/* Inner Hood Lip - Theme Accent */}
                        <path
                            d="M32 50 Q32 8 50 8 Q68 8 68 50"
                            fill="none"
                            stroke={mainColor}
                            strokeWidth="0.5"
                            strokeDasharray="10 5"
                            className="opacity-20 group-hover:opacity-50 transition-opacity duration-1000"
                        />
                    </g>

                    {/* E. THE FACE PLATE - WHITE */}
                    <g>
                        {/* Main Visor Block - White */}
                        <path d="M43 32 L50 28 L57 32 V46 L50 50 L43 46 Z" fill={whitePlate} stroke={mainColor} strokeWidth="0.3" opacity="0.95" />
                        {/* Internal Glowing Ocular Sensor - Golden */}
                        <g filter="url(#physGlow)">
                            <circle cx="50" cy="38" r="1.5" fill={mainColor} className="animate-pulse" />
                            <circle cx="50" cy="38" r="0.5" fill="black" />
                        </g>
                        {/* Technical Trim */}
                        <path d="M45 46 L50 49 L55 46" fill="none" stroke={mainColor} strokeWidth="0.5" strokeDasharray="1 1" opacity="0.5" />
                    </g>

                    {/* F. MECHANICAL SEAMS & BOLTS */}
                    <g fill={mainColor} opacity="0.3">
                        <circle cx="18" cy="80" r="0.4" />
                        <circle cx="82" cy="80" r="0.4" />
                        <circle cx="38" cy="53" r="0.4" />
                        <circle cx="62" cy="53" r="0.4" />
                    </g>
                </g>
            </svg>

            {/* 3. PERIPHERAL TECH DECAL (DEFINED METADATA) */}
            <div className="absolute top-2 left-2 flex flex-col items-start pointer-events-none group-hover:translate-x-1 transition-transform">
                <div className="flex items-center gap-1">
                    <div className="w-1 h-3 bg-current" style={{ color: mainColor }} />
                    <span className="text-[5px] font-mono font-black tracking-tight" style={{ color: mainColor }}>LVL_99</span>
                </div>
                <span className="text-[4px] font-mono opacity-40 uppercase tracking-widest mt-0.5" style={{ color: mainColor }}>Root.Apostle</span>
            </div>

            {/* Bottom Status Ticker (Physical Integration) */}
            <div className="absolute bottom-1 right-2 flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                <div className="w-[2px] h-[2px] rounded-full bg-white animate-ping" />
                <span className="text-[4px] font-mono text-white/50 lowercase tracking-widest">Defined_State://True</span>
            </div>

            {/* Corner Decorative Brackets (Theme Integrated) */}
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${theme.border} opacity-40`} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${theme.border} opacity-40`} />
        </div>
    );
};

export default EntityAvatar;
