import React from 'react';
import { Theme } from '../../core/types';

const SanctuaryRing: React.FC<{ theme: Theme; isPaused?: boolean }> = ({ theme, isPaused = false }) => {
    const color = theme.isDark ? '#ffffff' : '#000000';
    return (
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-20 transition-opacity duration-700">
            <svg viewBox="0 0 500 500" className={`w-[150vh] h-[150vh] ${!isPaused ? 'animate-[spin_120s_linear_infinite]' : ''}`}>
                <circle cx="250" cy="250" r="240" fill="none" stroke={color} strokeWidth="1" strokeDasharray="10 20 40 20" opacity="0.5" className="transition-colors duration-700" />
                <circle cx="250" cy="250" r="200" fill="none" stroke={color} strokeWidth="2" strokeDasharray="100 200" opacity="0.3" className="transition-colors duration-700" />
                <circle cx="250" cy="250" r="220" fill="none" stroke={color} strokeWidth="4" strokeDasharray="5 15" opacity="0.2" className="transition-colors duration-700" />
            </svg>
        </div>
    );
};

export default SanctuaryRing;
