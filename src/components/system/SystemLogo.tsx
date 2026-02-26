import React from 'react';
import { Theme } from '../../core/types';

interface SystemLogoProps {
    theme: Theme;
    className?: string;
}

const SystemLogo: React.FC<SystemLogoProps> = ({ theme, className = "w-12 h-12" }) => {
    const isLight = theme?.id === 'LIGHT';
    const primaryColor = isLight ? '#0ea5e9' : '#d97706';
    const secondaryColor = isLight ? '#6366f1' : '#fbbf24';

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="coreGradient" x1="50" y1="20" x2="50" y2="80" gradientUnits="userSpaceOnUse">
                        <stop stopColor={primaryColor} />
                        <stop offset="1" stopColor={secondaryColor} stopOpacity="0.5" />
                    </linearGradient>
                </defs>
                <g className="origin-center animate-[spin_10s_linear_infinite_reverse]">
                    <path d="M50 5 L85 25 L85 35" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" fill="none" className="transition-colors duration-700" />
                    <path d="M50 5 L15 25 L15 35" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" fill="none" className="transition-colors duration-700" />
                    <path d="M50 95 L85 75 L85 65" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" fill="none" className="transition-colors duration-700" />
                    <path d="M50 95 L15 75 L15 65" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" fill="none" className="transition-colors duration-700" />
                </g>
                <path d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z" stroke={secondaryColor} strokeWidth="1" fill="none" className="opacity-50 transition-colors duration-700" />
                <g className="origin-center animate-[pulse_3s_ease-in-out_infinite]">
                    <path d="M50 25 L65 50 L50 75 L35 50 Z" fill="url(#coreGradient)" stroke={isLight ? '#fff' : '#fff'} strokeWidth="1" className="transition-colors duration-700" style={{ filter: `drop-shadow(0 0 3px ${primaryColor})` }} />
                    <rect x="49" y="35" width="2" height="30" rx="1" fill={isLight ? '#fff' : '#fff'} className="opacity-80" />
                </g>
            </svg>
        </div>
    );
};

export default React.memo(SystemLogo);
