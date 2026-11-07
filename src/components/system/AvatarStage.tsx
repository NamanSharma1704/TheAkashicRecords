import React from 'react';

/**
 * The player avatar's rank stage: what EntityAvatar wears as the reader climbs.
 *
 *   0 DORMANT      DRIFTER, AWAKENED     the plain Apostle, two faint brackets (EntityAvatar's own)
 *   1 FORGED       ADEPT, VANGUARD       an iron frame: riveted corner plates, clasps top and bottom
 *   2 ARGENT       ASCENDANT, PARAGON    a silver double frame, corner studs, an accent halo
 *   3 PRISMATIC    SOVEREIGN, ECLIPSE    an iridescent frame with gems, a rayed halo, a crest
 *   4 SINGULARITY  MONARCH               a black sun behind the hood, its accretion disk, a crown,
 *                                        the frame lit by the void
 *
 * Two layers, both in the avatar's 100×100 box: the HALO sits behind the figure (only its edges
 * show around the hood), the FRAME over it. Metals (iron, silver, the prism) are the same in
 * both themes, each with a dark edge so it reads on the light card too; the halo and the
 * singularity take the theme accent. Decoration only: the rank is in words beside the avatar.
 */

// theme-color-ok: rank metals are artwork, the same in both themes (the accent comes in as a prop)
const IRON = { hi: '#b9bec6', mid: '#6b717b', lo: '#2b2f35' };
const SILVER = { hi: '#f4f6fa', mid: '#bcc4d0', lo: '#5d6678' };
const PRISM = ['#f0abfc', '#a5b4fc', '#67e8f9', '#86efac', '#fde68a'];
const UNDERLAY = '#1b1530';   // theme-color-ok: the dark edge under the prism, for the light card
const VOID = '#030206';       // theme-color-ok: the black sun

// The halo's centre, behind the hood (the figure is drawn at 94% and centred).
const HX = 50;
const HY = 29;

const MIRRORS = ['', 'translate(100,0) scale(-1,1)', 'translate(0,100) scale(1,-1)', 'translate(100,100) scale(-1,-1)'];

/** A spin about the halo's centre. Tailwind's spin turns an element about its own box, so an
 *  SVG group takes the origin in the viewBox's units. The class is passed whole (Tailwind only
 *  generates classes it can read in the source) and is off under reduced motion. */
const spin = (className: string): { className: string; style: React.CSSProperties } => ({
    className,
    style: { transformOrigin: `${HX}px ${HY}px`, transformBox: 'view-box' },
});

const Metal: React.FC<{ id: string; tone: { hi: string; mid: string; lo: string } }> = ({ id, tone }) => (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={tone.hi} />
        <stop offset="55%" stopColor={tone.mid} />
        <stop offset="100%" stopColor={tone.lo} />
    </linearGradient>
);

const Prism: React.FC<{ id: string }> = ({ id }) => (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        {PRISM.map((c, i) => <stop key={c} offset={`${(i / (PRISM.length - 1)) * 100}%`} stopColor={c} />)}
    </linearGradient>
);

const Glow: React.FC<{ id: string; blur?: number }> = ({ id, blur = 0.9 }) => (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={blur} result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
);

/** Behind the figure. Nothing below ARGENT. */
export const StageHalo: React.FC<{ stage: number; accent: string; uid: string }> = ({ stage, accent, uid }) => {
    if (stage < 2) return null;
    const glow = `${uid}-hglow`;
    const ring = (
        <circle cx={HX} cy={HY} r="26" fill="none" stroke={accent} strokeWidth={stage === 2 ? 0.7 : 0.85} opacity="0.9" filter={`url(#${glow})`} />
    );

    if (stage === 2) {
        const dashed = spin('motion-safe:animate-[spin_60s_linear_infinite]');
        return (
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
                <defs><Glow id={glow} /></defs>
                {ring}
                <circle cx={HX} cy={HY} r="29.5" fill="none" stroke={accent} strokeWidth="0.35" strokeDasharray="1.2 2.4" opacity="0.7" className={dashed.className} style={dashed.style} />
            </svg>
        );
    }

    if (stage === 3) {
        const rays = spin('motion-safe:animate-[spin_90s_linear_infinite]');
        const bloom = `${uid}-bloom`;
        return (
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
                <defs>
                    <Glow id={glow} />
                    <radialGradient id={bloom}>
                        <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={accent} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <circle cx={HX} cy={HY} r="30" fill={`url(#${bloom})`} />
                {ring}
                <g className={rays.className} style={rays.style} stroke={accent} strokeLinecap="round" opacity="0.75">
                    {Array.from({ length: 16 }, (_, i) => {
                        const a = (i / 16) * Math.PI * 2;
                        const outer = i % 2 ? 30.5 : 32.5;
                        return <line key={i} x1={HX + Math.cos(a) * 28} y1={HY + Math.sin(a) * 28} x2={HX + Math.cos(a) * outer} y2={HY + Math.sin(a) * outer} strokeWidth={i % 2 ? 0.4 : 0.6} />;
                    })}
                </g>
            </svg>
        );
    }

    // SINGULARITY: a black sun. A corona, the dark disk (it shows as a band around the hood),
    // the bright accretion ring, the disk seen edge-on crossing behind the figure, and motes
    // on an orbit.
    const corona = `${uid}-corona`;
    const accretion = `${uid}-accretion`;
    const motes = spin('motion-safe:animate-[spin_24s_linear_infinite]');
    return (
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
            <defs>
                <Glow id={glow} blur={1.1} />
                <radialGradient id={corona}>
                    <stop offset="55%" stopColor={accent} stopOpacity="0" />
                    <stop offset="68%" stopColor={accent} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={accretion} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor={accent} />
                    <stop offset="100%" stopColor={accent} stopOpacity="0.6" />
                </linearGradient>
            </defs>
            <circle cx={HX} cy={HY} r="38" fill={`url(#${corona})`} />
            <g transform={`rotate(-14 ${HX} ${HY})`} fill="none">
                <ellipse cx={HX} cy={HY} rx="45" ry="7.5" stroke={accent} strokeWidth="0.9" opacity="0.75" filter={`url(#${glow})`} />
                <ellipse cx={HX} cy={HY} rx="40" ry="5.6" stroke="#ffffff" strokeWidth="0.35" opacity="0.55" />
            </g>
            <circle cx={HX} cy={HY} r="25" fill={VOID} />
            <circle cx={HX} cy={HY} r="25.6" fill="none" stroke={`url(#${accretion})`} strokeWidth="1.4" filter={`url(#${glow})`} />
            <g className={motes.className} style={motes.style}>
                {[0, 1, 2].map((i) => {
                    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
                    return <circle key={i} cx={HX + Math.cos(a) * 33} cy={HY + Math.sin(a) * 33} r="0.8" fill="#ffffff" filter={`url(#${glow})`} />;
                })}
            </g>
        </svg>
    );
};

/** Over the figure. Nothing at DORMANT (EntityAvatar keeps its own two brackets there). */
export const StageFrame: React.FC<{ stage: number; accent: string; uid: string }> = ({ stage, accent, uid }) => {
    if (stage < 1) return null;
    const fill = `${uid}-fill`;

    if (stage === 1) {
        return (
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <defs><Metal id={fill} tone={IRON} /></defs>
                <rect x="1.6" y="1.6" width="96.8" height="96.8" fill="none" stroke={`url(#${fill})`} strokeWidth="1.1" />
                {MIRRORS.map((t) => (
                    <g key={t || 'tl'} transform={t || undefined}>
                        {/* A riveted L-plate, its inner ends chamfered. */}
                        <path d="M1 22 V1 H22 L19 4 H4 V19 Z" fill={`url(#${fill})`} stroke={IRON.lo} strokeWidth="0.3" />
                        <circle cx="2.6" cy="2.6" r="1" fill={IRON.hi} stroke={IRON.lo} strokeWidth="0.2" />
                        <circle cx="12" cy="2.5" r="0.7" fill={IRON.hi} />
                        <circle cx="2.5" cy="12" r="0.7" fill={IRON.hi} />
                    </g>
                ))}
                {/* Clasps at the head and foot. */}
                <rect x="45" y="0.6" width="10" height="2.6" fill={`url(#${fill})`} stroke={IRON.lo} strokeWidth="0.3" />
                <rect x="45" y="96.8" width="10" height="2.6" fill={`url(#${fill})`} stroke={IRON.lo} strokeWidth="0.3" />
            </svg>
        );
    }

    if (stage === 2) {
        return (
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <defs><Metal id={fill} tone={SILVER} /></defs>
                <rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke={SILVER.lo} strokeWidth="1.5" opacity="0.65" />
                <rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke={`url(#${fill})`} strokeWidth="0.9" />
                <rect x="4.2" y="4.2" width="91.6" height="91.6" fill="none" stroke={`url(#${fill})`} strokeWidth="0.45" opacity="0.75" />
                {MIRRORS.map((t) => (
                    <g key={t || 'tl'} transform={t || undefined}>
                        {/* A diamond stud where the two borders turn, and bridges between them. */}
                        <path d="M9 1.5 V4.2 M1.5 9 H4.2" stroke={`url(#${fill})`} strokeWidth="0.5" />
                        <path d="M4.2 0.9 L7.5 4.2 L4.2 7.5 L0.9 4.2 Z" fill={`url(#${fill})`} stroke={SILVER.lo} strokeWidth="0.3" />
                    </g>
                ))}
                {/* Chevrons at the middle of each side. */}
                <g fill="none" stroke={`url(#${fill})`} strokeWidth="0.6" strokeLinejoin="round">
                    <path d="M46 1.5 L50 4.6 L54 1.5" />
                    <path d="M46 98.5 L50 95.4 L54 98.5" />
                    <path d="M1.5 46 L4.6 50 L1.5 54" />
                    <path d="M98.5 46 L95.4 50 L98.5 54" />
                </g>
            </svg>
        );
    }

    if (stage === 3) {
        return (
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <defs><Prism id={fill} /></defs>
                <rect x="1.6" y="1.6" width="96.8" height="96.8" fill="none" stroke={UNDERLAY} strokeWidth="2" opacity="0.45" />
                <rect x="1.6" y="1.6" width="96.8" height="96.8" fill="none" stroke={`url(#${fill})`} strokeWidth="1.2" />
                <rect x="4.4" y="4.4" width="91.2" height="91.2" fill="none" stroke={`url(#${fill})`} strokeWidth="0.4" opacity="0.7" />
                {MIRRORS.map((t) => (
                    <g key={t || 'tl'} transform={t || undefined}>
                        {/* A faceted gem in each corner. */}
                        <path d="M4.4 0.4 L8.4 4.4 L4.4 8.4 L0.4 4.4 Z" fill={`url(#${fill})`} stroke={UNDERLAY} strokeWidth="0.35" />
                        <path d="M0.4 4.4 H8.4 M4.4 0.4 V8.4" stroke="#ffffff" strokeWidth="0.25" opacity="0.7" />
                    </g>
                ))}
                {/* The crest: three points on the hood's peak. */}
                <path d="M43.5 7.2 L44.4 2.6 L47.2 4.9 L50 0.8 L52.8 4.9 L55.6 2.6 L56.5 7.2 Z" fill={`url(#${fill})`} stroke={UNDERLAY} strokeWidth="0.35" strokeLinejoin="round" />
                <circle cx="50" cy="5.4" r="0.8" fill="#ffffff" />
            </svg>
        );
    }

    // SINGULARITY.
    const glow = `${uid}-fglow`;
    const crown = `${uid}-crown`;
    return (
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-20">
            <defs>
                <Glow id={glow} />
                <linearGradient id={crown} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff6dc" />
                    <stop offset="55%" stopColor={accent} />
                </linearGradient>
            </defs>
            <rect x="1.6" y="1.6" width="96.8" height="96.8" fill="none" stroke={accent} strokeWidth="1" filter={`url(#${glow})`} />
            <rect x="4.2" y="4.2" width="91.6" height="91.6" fill="none" stroke={accent} strokeWidth="0.35" strokeDasharray="6 3" opacity="0.6" />
            {MIRRORS.map((t) => (
                <g key={t || 'tl'} transform={t || undefined}>
                    {/* A small black hole in each corner, its disk tilted. */}
                    <ellipse cx="5.2" cy="5.2" rx="4.4" ry="1.5" transform="rotate(-35 5.2 5.2)" fill="none" stroke="#ffffff" strokeWidth="0.3" opacity="0.8" />
                    <circle cx="5.2" cy="5.2" r="2.4" fill={VOID} stroke={accent} strokeWidth="0.6" filter={`url(#${glow})`} />
                </g>
            ))}
            {/* The crown: five points, a jewel on each. */}
            <g filter={`url(#${glow})`}>
                <path d="M40.5 8.2 L41 2.8 L43.3 5.6 L45.5 1.4 L47.8 4.6 L50 0.4 L52.2 4.6 L54.5 1.4 L56.7 5.6 L59 2.8 L59.5 8.2 Z" fill={`url(#${crown})`} stroke={VOID} strokeWidth="0.55" strokeLinejoin="round" />
                <rect x="40.5" y="6.8" width="19" height="1.4" fill={VOID} opacity="0.55" />
                {[[41, 2.8], [45.5, 1.4], [50, 0.4], [54.5, 1.4], [59, 2.8]].map(([x, y]) => (
                    <circle key={x} cx={x} cy={y} r="0.6" fill="#ffffff" />
                ))}
            </g>
        </svg>
    );
};
