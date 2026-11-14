import React from 'react';

/**
 * Custom 'Akashic System' icon set.
 * Designed with a high-tech HUD aesthetic, featuring calibration lines and geometric cores.
 */

interface IconProps {
    size?: number;
    color?: string;
    className?: string;
    /** Accepted for drop-in use beside the stock icons; the glyph is always decorative. */
    'aria-hidden'?: boolean | 'true' | 'false';
}

/**
 * InfinitePortalIcon - Represents a dimensional gate.
 * Features a diamond core with radiating data lines.
 */
export const InfinitePortalIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
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

/*
 * THE PHONE TAB BAR'S GLYPHS (MobileTabBar). Each is drawn from the thing it opens, in the
 * same line-and-glass hand as the rest of the set: 24px grid, 1.5px lines in currentColor,
 * a faint inner fill when its tab is the one on screen (`active`).
 */
interface TabGlyphProps {
    size?: number;
    className?: string;
    active?: boolean;
    /** Accepted for drop-in use beside the stock icons; the glyph is always decorative. */
    'aria-hidden'?: boolean | 'true' | 'false';
    style?: React.CSSProperties;
}

/** THE SANCTUM (Home): the hero card, projected in a cone of light over its holo-dais. */
export const SanctumIcon: React.FC<TabGlyphProps> = ({ size = 22, className, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        {/* the cone, from the dais's emitter up to the card */}
        <path d="M12 18.4L7.6 14.2M12 18.4L16.4 14.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        {/* the card and its cover frame */}
        <rect x="7.6" y="1.9" width="8.8" height="12.3" rx="0.6" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity={active ? 0.24 : 0} />
        <rect x="9.5" y="3.9" width="5" height="6.4" stroke="currentColor" strokeWidth="1" opacity="0.65" />
        {/* the dais */}
        <ellipse cx="12" cy="19.2" rx="9" ry="2.6" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="12" cy="19.2" rx="4.2" ry="1.1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
);

/** A floating isle of the Spire: a flat crystal, pointed underneath. */
const isle = (cx: number, cy: number, w: number, h: number) =>
    `M${cx - w} ${cy}L${cx} ${cy - h}L${cx + w} ${cy}L${cx} ${cy + h * 1.7}Z`;

/** One isle's facet: the crease from its crown down to its tip. */
const facet = (cx: number, cy: number, h: number) => `M${cx} ${cy - h}L${cx} ${cy + h * 1.7}`;

/** THE DIVINE SPIRE: three faceted isles climbing a spiral, the top one lit. */
export const SpireIcon: React.FC<TabGlyphProps> = ({ size = 22, className, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <path d={isle(14.4, 4.2, 4.2, 1.8)} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity={active ? 0.45 : 0.15} />
        <path d={facet(14.4, 4.2, 1.8)} stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <path d={isle(8.6, 11, 4.8, 2)} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={facet(8.6, 11, 2)} stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <path d={isle(15, 17.6, 5.6, 2.1)} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={facet(15, 17.6, 2.1)} stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
);

/** The hex plate the rank sigil stands on (RankSigil), pointy-top, around (12, 12). */
const HEX_PLATE = 'M12 2.8L19.97 7.4V16.6L12 21.2L4.03 16.6V7.4Z';

/** THE HUNTER (Profile): a hunter's bust on the rank sigil's hex plate. */
export const HunterIcon: React.FC<TabGlyphProps> = ({ size = 22, className, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <path d={HEX_PLATE} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity={active ? 0.2 : 0} />
        <circle cx="12" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.6 17.3C8.6 14.9 10.2 13.9 12 13.9C13.8 13.9 15.4 14.9 16.4 17.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/** A NEW GATE: the portal diamond (InfinitePortalIcon's) with the sign of making one. */
export const NewGateIcon: React.FC<TabGlyphProps> = ({ size = 20, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <path d="M12 2.5L21.5 12L12 21.5L2.5 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 8.2V15.8M8.2 12H15.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);
