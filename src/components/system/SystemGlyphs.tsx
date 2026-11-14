import React from 'react';

/**
 * THE SYSTEM GLYPH SET (2026-11-13): the app's meaningful actions and readings, drawn in the
 * System's own hand instead of stock icons. The phone tab bar started it (CustomIcons.tsx);
 * this is the rest of the family, in the same line-and-glass hand:
 *
 *   - a 24px grid; 1.5px lines in currentColor, 1px for the secondary marks (at reduced
 *     opacity); the HUD's own shapes: diamonds, hexagons, cut corners, brackets
 *   - a faint glass fill on each glyph's core shape, stronger when `active`
 *   - drop-in for the stock icons they replace: `size`, `className`, `style` and the aria
 *     props pass through (aria-hidden by default: a glyph sits beside its label)
 *
 * Stock icons stay only where the meaning is generic (close, chevrons, checks, alerts, sort,
 * filter, undo). Each glyph is drawn from the thing it means in the System:
 *
 *   SearchGlyph       a lens with a diamond core and calibration ticks
 *   ScanGlyph         a scanning frame: corner brackets, a scan line through a diamond
 *   ReticleGlyph      a target reticle: marking a series as the objective
 *   PurgeGlyph        a container whose contents dissolve (Trash, delete)
 *   RecalibrateGlyph  two arcs cycling round a diamond core (refresh, check, in progress)
 *   PulseGlyph        a pulse between brackets (metrics, activity, the console)
 *   ExportGlyph       a data crystal coming down into the device's tray
 *   ImportGlyph       the tray's contents rising into the crystal
 *   CoversGlyph       a cover with a cut corner and a plus spark (fetch covers)
 *   TuneGlyph         three rails with diamond knobs (settings)
 *   DisconnectGlyph   leaving through the gate (log out)
 *   VoidGlyph         a black hole and its disk (the Void, the dark theme)
 *   SigilGlyph        a four-point star in a dashed ring (Arcanum, the light theme; the hero mark)
 *   CodexGlyph        the open codex of the records (chapters absorbed, the archive)
 *   StackGlyph        stacked plates (titles, floors; the Spire's Tower view)
 *   MatrixGlyph       a cut-corner table, its first cell marked (the Command Matrix)
 *   ConquestGlyph     a hexagonal seal with its mark (conquered)
 *   TerminalGlyph     the System's console: a cut frame, a prompt, a cursor
 *   TransmitGlyph     a node broadcasting (share)
 *   ResonanceGlyph    three linked nodes (similar records)
 *   InscribeGlyph     a stylus over a baseline (edit)
 *   GaugeGlyph        an appraisal dial (rating)
 *   CrownGlyph        the rank's crown (as the avatar frame's)
 *   BladeGlyph        a blade (might, power)
 *   OpenRecordGlyph   a record with a ray leaving its corner (open the series page)
 *   ManaGlyph         a mana crystal (completion, energy)
 *   TitleGlyph        a hexagonal medal on ribbons (titles granted, rewards)
 *   ChronicleGlyph    a timeline of diamond nodes (history)
 *   ScrollGlyph       a page of the archive (synopsis)
 *   EntitiesGlyph     two hooded figures, as the avatar's hood (characters)
 *   NovaGlyph         a burst round a diamond core, the streak's supernova (streak titles)
 *   DepthGlyph        a plumb line sounding below the surface (the depth titles)
 *   RadarGlyph        rings, a sweep and a blip (Release Radar)
 *
 * Every glyph was checked enlarged and at the sizes it is used at (10-18px), in both themes.
 */

export type GlyphProps = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
    size?: number | string;
    /** A stronger glass fill, for the glyph of the thing on screen. */
    active?: boolean;
};

const svgProps = ({ size = 16, active: _active, strokeWidth: _sw, ...rest }: GlyphProps) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    focusable: 'false' as const,
    xmlns: 'http://www.w3.org/2000/svg',
    ...rest,
});

/** The glass fill of a glyph's core shape. */
const glass = (active?: boolean) => (active ? 0.3 : 0.12);

const diamond = (cx: number, cy: number, s: number) => `M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`;

export const SearchGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity={glass(p.active) * 0.6} />
        <path d="M10.5 5.3V6.6M10.5 14.4V15.7M5.3 10.5H6.6M14.4 10.5H15.7" strokeWidth="1" opacity="0.6" />
        <path d={diamond(10.5, 10.5, 1.9)} fill="currentColor" fillOpacity={p.active ? 0.8 : 0.45} strokeWidth="1" />
        <path d="M15.3 15.3L20.5 20.5" />
        <path d="M16.9 19.1L19.1 16.9" strokeWidth="1" opacity="0.7" />
    </svg>
);

export const ScanGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4 8.5V4H8.5M15.5 4H20V8.5M20 15.5V20H15.5M8.5 20H4V15.5" />
        <path d="M3 12H21" strokeWidth="1" opacity="0.55" />
        <path d={diamond(12, 12, 3.6)} fill="currentColor" fillOpacity={glass(p.active)} />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
);

export const ReticleGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <circle cx="12" cy="12" r="7" fill="currentColor" fillOpacity={glass(p.active) * 0.6} />
        <path d="M12 2.5V6.2M12 17.8V21.5M2.5 12H6.2M17.8 12H21.5" />
        <path d={diamond(12, 12, 2)} fill="currentColor" fillOpacity={p.active ? 0.9 : 0.6} strokeWidth="1" />
    </svg>
);

export const PurgeGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4 6.5H20" />
        <path d="M9.4 6.5L10.3 4H13.7L14.6 6.5" strokeWidth="1" />
        <path d="M6 6.5L7.2 19L8.2 20H15.8L16.8 19L18 6.5" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M10 10V16.8M14 10V16.8" strokeWidth="1" strokeDasharray="1.2 1.8" opacity="0.85" />
    </svg>
);

export const RecalibrateGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M5.5 8.25A7.5 7.5 0 0 1 19.05 9.43" />
        <path d="M16.97 8.23L19.05 9.43L19.87 7.17" />
        <path d="M18.5 15.75A7.5 7.5 0 0 1 4.95 14.57" />
        <path d="M7.03 15.77L4.95 14.57L4.13 16.83" />
        <path d={diamond(12, 12, 2.3)} fill="currentColor" fillOpacity={p.active ? 0.6 : 0.35} strokeWidth="1" />
    </svg>
);

export const PulseGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M5.5 4.5H3.5V19.5H5.5M18.5 4.5H20.5V19.5H18.5" strokeWidth="1" opacity="0.6" />
        <path d="M5.2 12H8.2L10.1 7L13.6 17L15.4 11L16.4 12H18.8" />
        <path d={diamond(10.1, 7, 1.1)} fill="currentColor" stroke="none" opacity={p.active ? 1 : 0.7} />
    </svg>
);

const crystal = (cy: number) => `M12 ${cy - 3.5}L15 ${cy - 1.75}V${cy + 1.75}L12 ${cy + 3.5}L9 ${cy + 1.75}V${cy - 1.75}Z`;

export const ExportGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d={crystal(6.2)} fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M12 11.6V17.4" />
        <path d="M9.4 14.8L12 17.4L14.6 14.8" />
        <path d="M4 15.5V20.5H20V15.5" />
    </svg>
);

export const ImportGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d={crystal(6.2)} fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M12 17.4V11.9" />
        <path d="M9.4 14.5L12 11.9L14.6 14.5" />
        <path d="M4 15.5V20.5H20V15.5" />
    </svg>
);

export const CoversGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M5.6 2.5H15V17H4V4.1Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d={diamond(9.5, 8.6, 2.2)} strokeWidth="1" />
        <path d="M6.6 13.6H12.4" strokeWidth="1" opacity="0.6" />
        <path d="M19.5 15V21M16.5 18H22.5" />
    </svg>
);

export const TuneGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M3 6H5.8M10.2 6H21M3 12H12.8M17.2 12H21M3 18H7.8M12.2 18H21" />
        <path d={diamond(8, 6, 2.2)} fill="currentColor" fillOpacity={glass(p.active) * 2} />
        <path d={diamond(15, 12, 2.2)} fill="currentColor" fillOpacity={glass(p.active) * 2} />
        <path d={diamond(10, 18, 2.2)} fill="currentColor" fillOpacity={glass(p.active) * 2} />
    </svg>
);

export const DisconnectGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M10.5 4H6.5L4.5 6V18L6.5 20H10.5" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M7.6 9.2V14.8" strokeWidth="1" opacity="0.55" />
        <path d="M10 12H20" />
        <path d="M16.5 8.5L20 12L16.5 15.5" />
    </svg>
);

export const VoidGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        {/* the disk behind the hole, the hole, then the disk's near half over it */}
        <path d="M22 12A10 3.2 0 0 0 2 12" transform="rotate(-22 12 12)" strokeWidth="1" opacity="0.5" />
        <circle cx="12" cy="12" r="5.6" fill="currentColor" fillOpacity={p.active ? 0.4 : 0.22} />
        <path d="M2 12A10 3.2 0 0 0 22 12" transform="rotate(-22 12 12)" strokeWidth="1" opacity="0.9" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
);

export const SigilGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <circle cx="12" cy="12" r="9.2" strokeWidth="1" strokeDasharray="1.6 2.2" opacity="0.65" />
        <path d="M12 4.2L13.7 10.3L19.8 12L13.7 13.7L12 19.8L10.3 13.7L4.2 12L10.3 10.3Z" fill="currentColor" fillOpacity={p.active ? 0.45 : 0.22} />
    </svg>
);

export const CodexGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 6.5C9.6 5.1 6.6 4.7 3.5 5.1V18.6C6.6 18.2 9.6 18.6 12 20C14.4 18.6 17.4 18.2 20.5 18.6V5.1C17.4 4.7 14.4 5.1 12 6.5Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M12 6.5V20" strokeWidth="1" />
        <path d="M6 9.2H9.5M6 12H9.5M14.5 9.2H18M14.5 12H18M14.5 14.8H16.8" strokeWidth="1" opacity="0.6" />
    </svg>
);

export const StackGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 3.5L20.5 8L12 12.5L3.5 8Z" fill="currentColor" fillOpacity={glass(p.active) * 1.6} />
        <path d="M3.5 12L12 16.5L20.5 12" />
        <path d="M3.5 16L12 20.5L20.5 16" strokeWidth="1" opacity="0.6" />
    </svg>
);

export const MatrixGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4.5 4H21V18.5L19.5 20H3V5.5Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M3 9.4H21M3 14.7H21M8.6 4V20" strokeWidth="1" opacity="0.6" />
        <path d={diamond(5.8, 6.7, 1.1)} fill="currentColor" stroke="none" />
    </svg>
);

export const ConquestGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 2.8L19.8 7.3V16.7L12 21.2L4.2 16.7V7.3Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M8.4 12.2L11 14.8L15.8 9.6" />
    </svg>
);

export const TerminalGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4.5 4H21V18.5L19.5 20H3V5.5Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M7 9.5L10 12L7 14.5" />
        <path d="M12.5 15H16.5" />
    </svg>
);

export const TransmitGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d={diamond(6, 12, 2.4)} fill="currentColor" fillOpacity={p.active ? 0.7 : 0.4} />
        <path d="M9.5 8.5A5 5 0 0 1 9.5 15.5" />
        <path d="M12.4 5.6A9 9 0 0 1 12.4 18.4" opacity="0.8" />
        <path d="M16 3.6A13 13 0 0 1 16 20.4" strokeWidth="1" opacity="0.5" />
    </svg>
);

export const ResonanceGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M8.2 11L14.8 7M8.2 13L14.8 17" strokeWidth="1" />
        <path d="M17 8.6V15.4" strokeWidth="1" strokeDasharray="1.2 1.6" opacity="0.7" />
        <path d={diamond(6, 12, 2.4)} fill="currentColor" fillOpacity={p.active ? 0.6 : 0.35} />
        <path d={diamond(17, 6, 2.4)} fill="currentColor" fillOpacity={glass(p.active)} />
        <path d={diamond(17, 18, 2.4)} fill="currentColor" fillOpacity={glass(p.active)} />
    </svg>
);

export const InscribeGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M15.5 4.2L19.8 8.5L9 19.3H4.7V15Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M13.4 6.3L17.7 10.6" strokeWidth="1" />
        <path d="M13 20.5H20.5" strokeWidth="1" opacity="0.6" />
    </svg>
);

export const GaugeGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M5.5 18A8.5 8.5 0 1 1 18.5 18" />
        <path d="M12 5.4V6.9M6.6 8.2L7.6 9.1M17.4 8.2L16.4 9.1" strokeWidth="1" opacity="0.6" />
        <path d="M12 12.5L15.6 8.6" />
        <path d={diamond(12, 12.5, 1.6)} fill="currentColor" fillOpacity={p.active ? 0.9 : 0.6} strokeWidth="1" />
    </svg>
);

export const CrownGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4 17.3L4.8 7.6L8.7 11.6L12 4.8L15.3 11.6L19.2 7.6L20 17.3Z" fill="currentColor" fillOpacity={glass(p.active) * 1.5} />
        <path d="M4 20.2H20" />
    </svg>
);

export const BladeGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <g transform="rotate(45 12 12)">
            <path d="M12 1.8L13.5 3.8V14H10.5V3.8Z" fill="currentColor" fillOpacity={glass(p.active)} />
            <path d="M12 4.6V12.4" strokeWidth="0.8" opacity="0.6" />
            <path d="M7.8 14H16.2" />
            <path d="M12 14V19" />
            <path d={diamond(12, 20.6, 1.2)} fill="currentColor" strokeWidth="1" />
        </g>
    </svg>
);

export const OpenRecordGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 4H5.5L4 5.5V20H18.5L20 18.5V12" fill="currentColor" fillOpacity={glass(p.active) * 0.6} />
        <path d="M11 13L20 4" />
        <path d="M14.5 4H20V9.5" />
    </svg>
);

export const ManaGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 2.5L17 10L12 21.5L7 10Z" fill="currentColor" fillOpacity={glass(p.active) * 1.6} />
        <path d="M7 10H17M12 2.5V21.5" strokeWidth="1" opacity="0.5" />
    </svg>
);

export const TitleGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M8.8 13.3L7.5 21L12 18.6L16.5 21L15.2 13.3" />
        <path d="M12 2.5L17.2 5.5V11.5L12 14.5L6.8 11.5V5.5Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M12 5.6L12.9 7.6L14.9 8.5L12.9 9.4L12 11.4L11.1 9.4L9.1 8.5L11.1 7.6Z" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
);

export const ChronicleGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M6.5 3.5V20.5" strokeWidth="1" opacity="0.6" />
        <path d={diamond(6.5, 6, 1.8)} fill="currentColor" fillOpacity={p.active ? 0.8 : 0.5} strokeWidth="1" />
        <path d={diamond(6.5, 12, 1.8)} fill="currentColor" fillOpacity={glass(p.active)} strokeWidth="1" />
        <path d={diamond(6.5, 18, 1.8)} fill="currentColor" fillOpacity={glass(p.active)} strokeWidth="1" />
        <path d="M10.5 6H19.5M10.5 12H17.5M10.5 18H18.5" />
    </svg>
);

export const ScrollGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M4.5 3.5H19.5V18.5L17.5 20.5H4.5Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d="M7.8 8H16.2M7.8 11.5H16.2M7.8 15H12.8" strokeWidth="1" opacity="0.75" />
    </svg>
);

export const NovaGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M12 2.5V7M12 17V21.5M2.5 12H7M17 12H21.5" />
        <path d="M5.6 5.6L8.3 8.3M18.4 5.6L15.7 8.3M5.6 18.4L8.3 15.7M18.4 18.4L15.7 15.7" strokeWidth="1" opacity="0.7" />
        <path d={diamond(12, 12, 3)} fill="currentColor" fillOpacity={p.active ? 0.6 : 0.3} />
    </svg>
);

export const DepthGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <path d="M3 5.5C5 4.3 7 4.3 9 5.5C11 6.7 13 6.7 15 5.5C17 4.3 19 4.3 21 5.5" strokeWidth="1" opacity="0.7" />
        <path d="M12 7.5V14.6" />
        <path d="M10 10H14M10.8 12.6H13.2" strokeWidth="1" opacity="0.6" />
        <path d={diamond(12, 18, 3)} fill="currentColor" fillOpacity={glass(p.active) * 2} />
    </svg>
);

export const RadarGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        <circle cx="12" cy="12" r="8.5" strokeWidth="1" opacity="0.55" />
        <circle cx="12" cy="12" r="4.5" strokeWidth="1" opacity="0.55" />
        <path d="M12 3.5A8.5 8.5 0 0 1 20.5 12" />
        <path d="M12 12L18 6" />
        <path d={diamond(15.6, 15.2, 1.4)} fill="currentColor" fillOpacity={p.active ? 0.9 : 0.6} strokeWidth="1" />
    </svg>
);

export const EntitiesGlyph: React.FC<GlyphProps> = (p) => (
    <svg {...svgProps(p)}>
        {/* the one behind */}
        <path d="M14.4 5.1C16.8 5.4 18.6 7.4 18.6 10V12.2" strokeWidth="1" opacity="0.6" />
        <path d="M17.2 14.2C19.6 14.8 21.5 16.8 21.5 19.8" strokeWidth="1" opacity="0.6" />
        {/* the one in front: the avatar's hood, its visor, its shoulders */}
        <path d="M9 4.2C11.8 4.2 13.6 6.4 13.6 9.3V12.2H4.4V9.3C4.4 6.4 6.2 4.2 9 4.2Z" fill="currentColor" fillOpacity={glass(p.active)} />
        <path d={diamond(9, 8.8, 1.3)} fill="currentColor" stroke="none" opacity="0.8" />
        <path d="M2.5 19.8C2.5 16.2 5.4 14 9 14C12.6 14 15.5 16.2 15.5 19.8" />
    </svg>
);
