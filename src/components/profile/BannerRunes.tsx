import React from 'react';

/**
 * The banner's inscriptions, made real (2026-11-15). The painted frame carries eight small
 * plaques of mock lettering ("RRZRV" and the like): two on the top rail, two down each side, two
 * on the bottom rail. Each gets an inset of its own recess colour over the mock letters and a
 * line of Elder Futhark in their place, kindling rune by rune, plaque after plaque. The runes are
 * drawn as strokes, not a font: rune fonts are missing on many phones.
 *
 * They spell, in transliteration: AKASHIC RECORDS along the top; READ and RISE down the left,
 * GATE and LORE down the right; HUNTER and ASCEND along the foot.
 *
 * Positions are fractions of the art (2000 x 489), read from it in both themes (the plaques lie
 * in the same places); the recess colours were sampled from it per theme (`plaque-sample.mjs`).
 */

/** Elder Futhark, as strokes in a 10 x 14 box about the origin. */
const FUTHARK: Record<string, string> = {
    A: 'M-3 7V-7M-3 -7L3 -3M-3 -2L3 2',            // ansuz ᚨ
    C: 'M3 -7L-3 0L3 7',                            // kaunan ᚲ
    K: 'M3 -7L-3 0L3 7',
    D: 'M-4 -7V7L4 -7V7L-4 -7',                     // dagaz ᛞ
    E: 'M-4 7V-7L0 -3L4 -7V7',                      // ehwaz ᛖ
    G: 'M-4 -7L4 7M4 -7L-4 7',                      // gebo ᚷ
    H: 'M-3 -7V7M3 -7V7M-3 -2L3 2',                 // hagalaz ᚺ
    I: 'M0 -7V7',                                   // isa ᛁ
    L: 'M-2 7V-7L3 -3',                             // laguz ᛚ
    N: 'M0 -7V7M-3 -2L3 2',                         // naudiz ᚾ
    O: 'M0 -7L4 -2L-3 7M0 -7L-4 -2L3 7',            // othala ᛟ
    R: 'M-3 7V-7L3 -4L-3 -1L3 7',                   // raido ᚱ
    S: 'M3 -7L-3 -2L3 2L-3 7',                      // sowilo ᛊ
    T: 'M0 -7V7M-4 -3L0 -7L4 -3',                   // tiwaz ᛏ
    U: 'M-3 7V-7L3 -3V7',                           // uruz ᚢ
};

interface Plaque { x0: number; y0: number; x1: number; y1: number; vertical?: boolean; word: string; recess: [string, string] }

/** [x0, y0, x1, y1] in % of the art; recess as [Void, Arcanum]. */
const PLAQUES: Plaque[] = [
    { x0: 10.5, y0: 3.0, x1: 14.7, y1: 6.7, word: 'AKASHIC', recess: ['rgb(118,80,50)', 'rgb(92,76,106)'] },
    { x0: 87.2, y0: 3.0, x1: 91.1, y1: 6.7, word: 'RECORDS', recess: ['rgb(112,78,50)', 'rgb(96,79,112)'] },
    { x0: 1.45, y0: 33.6, x1: 2.3, y1: 44.4, vertical: true, word: 'READ', recess: ['rgb(70,66,63)', 'rgb(78,73,96)'] },
    { x0: 1.45, y0: 56.6, x1: 2.3, y1: 69.4, vertical: true, word: 'RISE', recess: ['rgb(52,50,54)', 'rgb(66,61,86)'] },
    { x0: 97.7, y0: 34.2, x1: 98.55, y1: 44.0, vertical: true, word: 'GATE', recess: ['rgb(76,70,69)', 'rgb(88,84,104)'] },
    { x0: 97.7, y0: 57.2, x1: 98.55, y1: 67.8, vertical: true, word: 'LORE', recess: ['rgb(66,61,64)', 'rgb(80,70,98)'] },
    { x0: 7.8, y0: 89.4, x1: 13.7, y1: 93.8, word: 'HUNTER', recess: ['rgb(48,45,53)', 'rgb(58,46,69)'] },
    { x0: 87.9, y0: 90.1, x1: 93.7, y1: 94.2, word: 'ASCEND', recess: ['rgb(48,45,53)', 'rgb(62,48,70)'] },
];

/** The art is 2000 x 489: its height is 24.45% of its width, so 1% of its height is 0.2445cqw. */
const H_CQW = 0.2445;

const BannerRunes: React.FC<{ isDark: boolean }> = ({ isDark }) => (
    <div className="hb-runes" aria-hidden="true">
        {PLAQUES.map((p, pi) => {
            const w = p.x1 - p.x0, h = (p.y1 - p.y0) * H_CQW;
            const letters = p.word.split('');
            const vbW = letters.length * 12 + 2, vbH = 18;
            // A vertical plaque: the line of runes is laid along it, read top to bottom.
            const run = p.vertical
                ? { width: `${h}cqw`, height: `${w}cqw`, transform: 'translate(-50%, -50%) rotate(90deg)' }
                : { width: '100%', height: '100%', transform: 'translate(-50%, -50%)' };
            return (
                <div
                    key={pi}
                    className={`hb-plaque ${p.vertical ? 'hb-plaque-v' : ''}`}
                    style={{ left: `${p.x0}%`, top: `${p.y0}%`, width: `${w}%`, height: `${h}cqw`, '--hb-recess': p.recess[isDark ? 0 : 1] } as React.CSSProperties}
                >
                    <svg className="hb-plaque-line" style={run} viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
                        {letters.map((ch, i) => (
                            <g key={i} transform={`translate(${7 + i * 12} 9) scale(0.85)`}>
                                <path d={FUTHARK[ch]} className="hb-rune-cut" transform="translate(0.55 0.75)" />
                                <path d={FUTHARK[ch]} className="hb-rune" />
                                <path d={FUTHARK[ch]} className="hb-rune-hot" style={{ animationDelay: `${(pi * 0.9 + i * 0.22).toFixed(2)}s` }} />
                            </g>
                        ))}
                    </svg>
                </div>
            );
        })}
    </div>
);

export default React.memo(BannerRunes);
