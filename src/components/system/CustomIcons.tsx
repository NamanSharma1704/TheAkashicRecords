import React from 'react';

/**
 * Custom 'Akashic System' icon set.
 * Designed with a high-tech HUD aesthetic, featuring calibration lines and geometric cores.
 */

interface IconProps {
    size?: number;
    color?: string;
    className?: string;
}

/**
 * InfinitePortalIcon - Represents a dimensional gate.
 * Features a diamond core with radiating data lines.
 */
export const InfinitePortalIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12 4L20 12L12 20L4 12Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8L16 12L12 16L8 12Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
        <path d="M2 12H6M18 12H22M12 2V6M12 18V22" stroke={color} strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2" className="opacity-60" />
    </svg>
);

/**
 * CalibratedPlusIcon - Precision augmentation icon.
 * A targeting-reticle style plus sign with tech brackets.
 */
export const CalibratedPlusIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12 7V17M7 12H17" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M4 8V4H8M16 4H20V8M20 16V20H16M8 20H4V16" stroke={color} strokeWidth="1.2" className="opacity-70" />
        <circle cx="12" cy="12" r="1.5" fill={color} className="animate-pulse" />
    </svg>
);

/**
 * CalibratedMinusIcon - Precision reduction icon.
 * Horizontal bar with tech brackets and calibration lines.
 */
export const CalibratedMinusIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M7 12H17" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M4 8V4H8M16 4H20V8M20 16V20H16M8 20H4V16" stroke={color} strokeWidth="1.2" className="opacity-70" />
        <path d="M10 12H14" stroke={color} strokeWidth="0.5" strokeLinecap="round" className="opacity-40" />
    </svg>
);
