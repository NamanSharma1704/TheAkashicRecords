import React from 'react';
import './HunterPortrait.css';

/**
 * The hunter's portrait: the owner's own art (2026-11-14), the Void's in amber and Arcanum's in
 * violet, brought to life where the art already glows. EntityAvatar wears it in place of the
 * drawn Apostle, inside its own HUD rings and rank frame, so every place that shows the avatar
 * (the dashboard card, the profile, the Rank Ascension, the sign-in screen) shows this.
 *
 *   - mana runs around the rune band (two arcs of light, turning);
 *   - the crystals round the frame glint, one after another;
 *   - the eyes kindle and dim, and the 零 sigil on the chest breathes;
 *   - the whole art breathes very slightly in brightness.
 *
 * The art is the owner's green-screen portrait, keyed (`.claude/smoke/tools/pfp-key.mjs`): it
 * carries its own spiked shape. The points are the art's own, found in it: the crystals and the
 * eyes by their colour, the rune band by its radius (80-90% of the art's). Everything is a transform or an opacity, and under
 * reduced motion it all holds still. Decoration: the hunter's name is beside the avatar.
 */

const ART = {
    dark: { small: '/hunter/pfp-void-384.webp', large: '/hunter/pfp-void-768.webp' },
    light: { small: '/hunter/pfp-arcanum-384.webp', large: '/hunter/pfp-arcanum-768.webp' },
};

/** The crystals round the frame, as fractions of the art (found by colour in both versions). */
const CRYSTALS: [number, number][] = [
    [0.5, 0.077], [0.661, 0.109], [0.789, 0.213], [0.895, 0.345], [0.909, 0.5], [0.909, 0.67],
    [0.819, 0.815], [0.5, 0.918], [0.323, 0.907], [0.182, 0.814], [0.101, 0.669], [0.092, 0.501],
    [0.108, 0.347], [0.213, 0.211], [0.335, 0.109],
];
/** Which of them glint, in turn round the frame. */
const GLINTS = [0, 3, 6, 8, 11, 13];
const EYES: [number, number][] = [[0.449, 0.404], [0.551, 0.4]];
const SIGIL: [number, number] = [0.5, 0.68];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const HunterPortrait: React.FC<{ isDark: boolean; size: number }> = ({ isDark, size }) => {
    const art = isDark ? ART.dark : ART.light;
    return (
        <div className="hp-root" data-tone={isDark ? 'dark' : 'light'} aria-hidden="true">
            <img
                className="hp-art"
                src={art.small}
                srcSet={`${art.small} 384w, ${art.large} 768w`}
                sizes={`${size}px`}
                width={size}
                height={size}
                alt=""
                decoding="async"
                draggable={false}
            />
            <span className="hp-band" />
            <span className="hp-core" style={{ left: pct(SIGIL[0]), top: pct(SIGIL[1]) }} />
            {EYES.map(([x, y], i) => <span key={i} className="hp-eye" style={{ left: pct(x), top: pct(y) }} />)}
            {GLINTS.map((c, i) => (
                <span key={c} className="hp-glint" style={{ left: pct(CRYSTALS[c][0]), top: pct(CRYSTALS[c][1]), animationDelay: `${(i * 0.8).toFixed(1)}s` }} />
            ))}
        </div>
    );
};

export default React.memo(HunterPortrait);
