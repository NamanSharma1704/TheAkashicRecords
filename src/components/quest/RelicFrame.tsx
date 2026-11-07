import React, { useId } from 'react';

/**
 * ASCENDED RELIC: the permanent mark of a conquered series.
 *
 * A gold-leaf frame laid over the card's art: a fine double border with a soft inner glow,
 * filigree in the four corners (a scrolled double bracket set with a gem) and a small glowing
 * constellation at the head. Purely decorative (aria-hidden, no pointer events); the card
 * still says CONQUERED in words.
 *
 * Gold in both themes: a relic is the same object on the void and on the vellum, and the
 * frame sits on cover art, which is dark under its scrim either way.
 *
 * `size` scales the ornaments: `card` (Spire cards, ~200-300px wide), `hero` (the dashboard
 * card), `large` (the series page cover and the conquest rite).
 */

// theme-color-ok: relic gold is artwork, the same in both themes (not the accent)
const GOLD_LIGHT = '#fbe9b0';
const GOLD = '#e2b552';
const GOLD_DEEP = '#a8791d';

const SIZES = { card: 30, hero: 42, large: 48 } as const;

const Corner: React.FC<{ gradient: string; size: number; className: string; flip: string }> = ({ gradient, size, className, flip }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`absolute ${className}`} style={{ transform: flip }}>
        {/* Outer bracket with a scrolled turn at the corner. */}
        <path d="M2.5 30 V10 Q2.5 2.5 10 2.5 H30" fill="none" stroke={`url(#${gradient})`} strokeWidth="1.6" strokeLinecap="round" />
        {/* Inner bracket, finer. */}
        <path d="M7 30 V13 Q7 7 13 7 H30" fill="none" stroke={`url(#${gradient})`} strokeWidth="0.8" strokeLinecap="round" opacity="0.75" />
        {/* The curl that joins them. */}
        <path d="M10 2.5 Q13 5 10 7.5 Q7.5 10 2.5 10" fill="none" stroke={`url(#${gradient})`} strokeWidth="0.9" opacity="0.9" />
        {/* The gem. */}
        <path d="M13 9.5 L15.5 12 L13 14.5 L10.5 12 Z" fill={`url(#${gradient})`} />
        {/* Two studs along the edges. */}
        <circle cx="22" cy="2.5" r="1.1" fill={GOLD_LIGHT} />
        <circle cx="2.5" cy="22" r="1.1" fill={GOLD_LIGHT} />
    </svg>
);

const RelicFrame: React.FC<{ size?: keyof typeof SIZES; className?: string }> = ({ size = 'card', className = '' }) => {
    const id = useId().replace(/:/g, '');
    const gradient = `relic-gold-${id}`;
    const s = SIZES[size];
    const inset = size === 'card' ? 5 : 7;
    return (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={GOLD_LIGHT} />
                        <stop offset="55%" stopColor={GOLD} />
                        <stop offset="100%" stopColor={GOLD_DEEP} />
                    </linearGradient>
                </defs>
            </svg>
            {/* The gold-leaf border: a hairline, a second one inside it, and a soft inner glow. */}
            <div
                className="absolute rounded-[inherit]"
                style={{
                    inset,
                    border: `1px solid ${GOLD}cc`,
                    boxShadow: `inset 0 0 0 3px #00000040, inset 0 0 0 4px ${GOLD}55, inset 0 0 26px ${GOLD}33, 0 0 18px ${GOLD}26`,
                    borderRadius: 'inherit',
                }}
            />
            <Corner gradient={gradient} size={s} className="top-0 left-0" flip="none" />
            <Corner gradient={gradient} size={s} className="top-0 right-0" flip="scaleX(-1)" />
            <Corner gradient={gradient} size={s} className="bottom-0 left-0" flip="scaleY(-1)" />
            <Corner gradient={gradient} size={s} className="bottom-0 right-0" flip="scale(-1,-1)" />
            {/* The constellation at the head: five stars and the lines between them. */}
            <svg
                viewBox="0 0 64 18"
                width={s * 2}
                height={(s * 2 * 18) / 64}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: inset + 3, filter: `drop-shadow(0 0 3px ${GOLD}aa)` }}
            >
                <polyline points="6,12 18,5 32,9 46,4 58,11" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.7" />
                <line x1="32" y1="9" x2="32" y2="15" stroke={GOLD} strokeWidth="0.6" opacity="0.6" />
                {[[6, 12, 1.2], [18, 5, 1.5], [32, 9, 2.1], [46, 4, 1.5], [58, 11, 1.2], [32, 15, 1]].map(([x, y, r]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={GOLD_LIGHT} />
                ))}
            </svg>
        </div>
    );
};

export default React.memo(RelicFrame);
