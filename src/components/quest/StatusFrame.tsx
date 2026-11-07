import React, { useId } from 'react';
import RelicFrame from './RelicFrame';

/**
 * A series' status, worn on its card. Each status tells its own state, and gold stays the one
 * that is earned:
 *
 *   CONQUERED  the gold Ascended Relic (RelicFrame), the richest of them
 *   ACTIVE     nothing: the calm default the others stand out against
 *   PLANNED    SEALED: silver-slate, chain-link corners, a seal at the head, the art dimmed
 *   STASIS     frost: ice-blue crystal corners, a frost crystal at the head, frost creeping in
 *              from the corners, the art drained of most of its colour, frozen in time
 *   SEVERED    broken: dull red, one corner broken off (the border cut away, a crack running
 *              in, chips by the break), the art greyed and darkened
 *
 * Stasis sky and severed red are the colours the editor already gives those statuses. All of
 * it is decoration (aria-hidden, no pointer events) laid over the art; the card's text sits
 * above it and the status is still in words. The art treatments are blend layers in the frame,
 * so it stays self-contained wherever it is used.
 */

type Variant = 'SEALED' | 'STASIS' | 'SEVERED';

// theme-color-ok: status frames are artwork on cover art, the same in both themes
const PALETTE: Record<Variant, { light: string; line: string; deep: string }> = {
    SEALED: { light: '#e6eaf2', line: '#aeb6c8', deep: '#6f788d' },
    STASIS: { light: '#e8f8ff', line: '#8fd3f4', deep: '#4f9fcf' },
    SEVERED: { light: '#f0a093', line: '#c2564a', deep: '#7c2b23' },
};
const SIZES = { card: 30, hero: 42, large: 48 } as const;

/** One corner's ornament, drawn for the top-left and mirrored into the others. */
const CornerArt: React.FC<{ variant: Variant; broken?: boolean; fill: string; line: string }> = ({ variant, broken, fill, line }) => {
    if (variant === 'SEALED') {
        return (
            <>
                <path d="M2.5 30 V9 Q2.5 2.5 9 2.5 H30" fill="none" stroke={fill} strokeWidth="1.3" strokeLinecap="round" />
                {/* Chain links along both arms. */}
                <rect x="11.5" y="0.9" width="5" height="3.2" rx="1.6" fill="none" stroke={fill} strokeWidth="0.9" />
                <rect x="17.5" y="0.9" width="5" height="3.2" rx="1.6" fill="none" stroke={fill} strokeWidth="0.9" />
                <rect x="0.9" y="11.5" width="3.2" height="5" rx="1.6" fill="none" stroke={fill} strokeWidth="0.9" />
                <rect x="0.9" y="17.5" width="3.2" height="5" rx="1.6" fill="none" stroke={fill} strokeWidth="0.9" />
                <circle cx="8" cy="8" r="1.4" fill={fill} />
            </>
        );
    }
    if (variant === 'STASIS') {
        return (
            <>
                <path d="M2.5 30 V13 M13 2.5 H30" fill="none" stroke={line} strokeWidth="0.8" opacity="0.8" />
                {/* Frost shards growing out of the corner. */}
                <path d="M2.5 2.5 L17 4.6 L7.5 8 Z" fill={fill} opacity="0.9" />
                <path d="M2.5 2.5 L4.6 17 L8 7.5 Z" fill={fill} opacity="0.9" />
                <path d="M2.5 2.5 L13 13 L9.5 6.5 Z" fill={fill} opacity="0.6" />
                <path d="M18.5 2.6 L24 3.8 L19.5 5.8 Z" fill={fill} opacity="0.7" />
                <path d="M2.6 18.5 L3.8 24 L5.8 19.5 Z" fill={fill} opacity="0.7" />
            </>
        );
    }
    // SEVERED.
    if (!broken) {
        return <path d="M2.5 30 V9 Q2.5 2.5 9 2.5 H30" fill="none" stroke={fill} strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />;
    }
    return (
        <>
            {/* The corner is gone: both arms end in jagged breaks short of it. */}
            <path d="M2.5 30 V21 L4.4 18.2 L2.9 15.6" fill="none" stroke={fill} strokeWidth="1.2" strokeLinejoin="bevel" />
            <path d="M30 2.5 H21 L18.2 4.4 L15.6 2.9" fill="none" stroke={fill} strokeWidth="1.2" strokeLinejoin="bevel" />
            {/* The crack running in, and chips knocked off by the break. */}
            <path d="M10 10 L13.5 12.5 L12.5 16.5 L16.5 19.5 L15.5 24" fill="none" stroke={line} strokeWidth="0.8" opacity="0.9" />
            <path d="M5.5 4.5 L9 5.6 L6.6 8 Z" fill={fill} opacity="0.85" />
            <path d="M3.6 8.8 L6 9.8 L4.4 11.6 Z" fill={fill} opacity="0.7" />
            <path d="M11 3.4 L13 4.6 L11.2 5.6 Z" fill={fill} opacity="0.6" />
        </>
    );
};

/** The mark at the head: a seal for SEALED, a frost crystal for STASIS. */
const HeadMark: React.FC<{ variant: Variant; fill: string; line: string; deep: string; size: number }> = ({ variant, fill, line, deep, size }) => {
    if (variant === 'SEALED') {
        return (
            <svg viewBox="0 0 24 24" width={size} height={size}>
                <circle cx="12" cy="12" r="10" fill={deep} stroke={fill} strokeWidth="1.2" />
                <path d="M12 5 L18 8.5 V15.5 L12 19 L6 15.5 V8.5 Z" fill="none" stroke={fill} strokeWidth="0.9" />
                <circle cx="12" cy="10.6" r="2" fill={fill} />
                <path d="M11.1 11.8 H12.9 L13.4 15.4 H10.6 Z" fill={fill} />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" width={size} height={size}>
            <g stroke={fill} strokeWidth="1.1" strokeLinecap="round">
                <path d="M12 2.5 V21.5 M3.8 7.2 L20.2 16.8 M3.8 16.8 L20.2 7.2" />
                <path d="M9.6 4.2 L12 6.4 L14.4 4.2 M9.6 19.8 L12 17.6 L14.4 19.8" strokeWidth="0.8" />
            </g>
            <path d="M12 8.6 L15 10.3 V13.7 L12 15.4 L9 13.7 V10.3 Z" fill={line} opacity="0.85" />
        </svg>
    );
};

const MarkFrame: React.FC<{ variant: Variant; size: keyof typeof SIZES; className: string; artClassName: string }> = ({ variant, size, className, artClassName }) => {
    const id = useId().replace(/:/g, '');
    const p = PALETTE[variant];
    const gradient = `status-${variant.toLowerCase()}-${id}`;
    const fill = `url(#${gradient})`;
    const s = SIZES[size];
    const inset = size === 'card' ? 5 : 7;
    // Severed: the top-right corner of the hairline is cut away where the frame broke.
    const cut = Math.round(s * 0.75);
    const corners: { pos: string; flip: string; broken?: boolean }[] = [
        { pos: 'top-0 left-0', flip: 'none' },
        { pos: 'top-0 right-0', flip: 'scaleX(-1)', broken: variant === 'SEVERED' },
        { pos: 'bottom-0 left-0', flip: 'scaleY(-1)' },
        { pos: 'bottom-0 right-0', flip: 'scale(-1,-1)' },
    ];
    // What the status does to the art. Each layer is its OWN element on the card, beside the
    // frame rather than inside it: the frame's container takes a z-index (to sit over the
    // card's locked overlay), and that makes it an isolated group, where a blend mode has
    // nothing beneath it to blend with (it painted plain grey). Laid out as siblings, each
    // layer blends with the card's art underneath.
    const art: React.CSSProperties[] =
        variant === 'SEALED' ? [{ background: 'rgba(8,10,16,0.22)' }]
        : variant === 'STASIS' ? [
            { background: '#808080', mixBlendMode: 'saturation', opacity: 0.55 },
            { background: p.line, mixBlendMode: 'soft-light', opacity: 0.3 },
            { background: [0, 100].flatMap((x) => [0, 100].map((y) => `radial-gradient(circle at ${x}% ${y}%, ${p.light}66 0%, transparent 32%)`)).join(', ') },
        ]
        : [
            { background: '#808080', mixBlendMode: 'saturation', opacity: 0.85 },
            { background: 'rgba(0,0,0,0.25)' },
            { background: p.deep, mixBlendMode: 'multiply', opacity: 0.22 },
        ];
    return (
        <>
        {art.map((style, i) => (
            <div key={i} aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-[inherit] ${artClassName}`} style={style} />
        ))}
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={p.light} />
                        <stop offset="60%" stopColor={p.line} />
                        <stop offset="100%" stopColor={p.deep} />
                    </linearGradient>
                </defs>
            </svg>

            {/* The hairline border. */}
            <div
                className="absolute"
                style={{
                    inset,
                    border: `1px solid ${p.line}${variant === 'SEVERED' ? '99' : 'b3'}`,
                    borderRadius: 'inherit',
                    boxShadow: `inset 0 0 18px ${p.line}26`,
                    clipPath: variant === 'SEVERED' ? `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, 0 100%)` : undefined,
                }}
            />

            {corners.map(({ pos, flip, broken }) => (
                <svg key={pos} width={s} height={s} viewBox="0 0 32 32" className={`absolute ${pos}`} style={{ transform: flip, filter: variant === 'STASIS' ? `drop-shadow(0 0 3px ${p.line}aa)` : undefined }}>
                    <CornerArt variant={variant} broken={broken} fill={fill} line={p.line} />
                </svg>
            ))}

            {variant !== 'SEVERED' && (
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: inset + 3, filter: `drop-shadow(0 0 4px ${p.line}88)` }}>
                    <HeadMark variant={variant} fill={fill} line={p.line} deep={p.deep} size={Math.round(s * 0.62)} />
                </div>
            )}
        </div>
        </>
    );
};

/**
 * `className` places the frame; `artClassName` (default: the same) places the art treatments.
 * A Spire card sets them apart: its treatments go UNDER the card's locked overlay (they are
 * about the art, and over the light theme's pale overlay they turned the card muddy), its
 * frame over it.
 */
const StatusFrame: React.FC<{ status?: string; size?: keyof typeof SIZES; className?: string; artClassName?: string }> = ({ status, size = 'card', className = '', artClassName }) => {
    const art = artClassName ?? className;
    switch (String(status || '').toUpperCase()) {
        case 'CONQUERED': return <RelicFrame size={size} className={className} />;
        case 'PLANNED': return <MarkFrame variant="SEALED" size={size} className={className} artClassName={art} />;
        case 'STASIS': return <MarkFrame variant="STASIS" size={size} className={className} artClassName={art} />;
        case 'SEVERED': return <MarkFrame variant="SEVERED" size={size} className={className} artClassName={art} />;
        default: return null;   // ACTIVE, and anything older builds wrote
    }
};

export default React.memo(StatusFrame);
