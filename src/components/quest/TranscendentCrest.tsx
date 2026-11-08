import React, { useId } from 'react';

/**
 * THE TRANSCENDENT CREST: the mark of a series the reader scored 10/10.
 *
 * Built from the same System-HUD kit as RankSigil, so the two read as one family: a glass core
 * plate with a luminous outline, a monospace numeral, a scanline, a slow dashed reticle and a
 * signal readout. The core is a DIAMOND (the ◈ motif) where the rank sigil is a hexagon, so they
 * stay distinct side by side; a ✦ crowns the reticle; and the readout is the appraisal meter
 * itself at full: ten rising bars, all lit.
 *
 * Line and glass in the theme accent, never a solid fill. `lock` plays the lock-on (it settles
 * in from slightly large while a diamond outline pulses out) for the moment a 10 is given.
 * Decoration only: the score is in words wherever the crest appears.
 *
 * It lives beside the appraisal pips only. It was also on the covers (Spire cards, the hero,
 * the series page) and the owner found it clutter there: covers carry the art and the status.
 */

const CX = 24;
const CY = 21;
const diamond = (r: number) => `${CX},${CY - r} ${CX + r},${CY} ${CX},${CY + r} ${CX - r},${CY}`;
const BARS = Array.from({ length: 10 }, (_, i) => ({ x: CX - 11.25 + i * 2.3, h: 1.4 + i * 0.36 }));

interface TranscendentCrestProps {
    isDark: boolean;
    size?: number;
    className?: string;
    /** Play the lock-on on mount. */
    lock?: boolean;
}

const TranscendentCrest: React.FC<TranscendentCrestProps> = ({ isDark, size = 48, className = '', lock = false }) => {
    const clip = `crest-${useId().replace(/:/g, '')}`;
    // The core's glass, as RankSigil's: near-black on the void, near-white on the light theme.
    const coreFace = isDark ? 'rgba(11,11,17,0.9)' : 'rgba(255,255,255,0.85)';
    const ink = { stroke: 'var(--accent-color)' };
    const fill = { fill: 'var(--accent-color)' };
    const positioned = className.split(/\s+/).includes('absolute') ? '' : 'relative';
    return (
        <span
            aria-hidden="true"
            className={`transcendent-crest inline-block shrink-0 ${positioned} ${lock ? 'crest-lock' : ''} ${className}`}
            style={{ width: size, height: size }}
        >
            {lock && <span className="crest-pulse" />}
            <svg viewBox="0 0 48 48" width={size} height={size} shapeRendering="geometricPrecision" className="relative block overflow-visible">
                <defs>
                    <clipPath id={clip}>
                        <polygon points={diamond(13)} />
                    </clipPath>
                </defs>

                {/* The reticle, turning slowly, crowned by a star. */}
                <circle className="crest-spin" cx={CX} cy={CY} r={17.5} fill="none" style={ink} strokeWidth={0.6} strokeDasharray="1.2 3.6" opacity={0.55} />
                <path d={`M${CX} 0.6 L${CX + 0.9} 2.6 L${CX + 2.9} 3.5 L${CX + 0.9} 4.4 L${CX} 6.4 L${CX - 0.9} 4.4 L${CX - 2.9} 3.5 L${CX - 0.9} 2.6 Z`} style={fill} />

                {/* Reticle ticks off the diamond's side points. */}
                <path d={`M${CX - 13} ${CY} H${CX - 16.5} M${CX + 13} ${CY} H${CX + 16.5}`} style={ink} strokeWidth={1.1} strokeLinecap="round" />

                {/* The glass core, the inner diamond (◈), a scanline across the core. */}
                <polygon points={diamond(13)} fill={coreFace} style={ink} strokeWidth={1.3} strokeLinejoin="round" />
                <polygon points={diamond(13)} style={fill} fillOpacity={0.1} />
                <polygon points={diamond(8.5)} fill="none" style={ink} strokeWidth={0.6} opacity={0.5} />
                <g clipPath={`url(#${clip})`}>
                    <rect className="crest-scan" x={CX - 13} y={CY - 0.7} width={26} height={1.4} style={fill} fillOpacity={0.75} />
                </g>

                <text
                    x={CX}
                    y={CY + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10.5}
                    fontWeight={900}
                    fontFamily="ui-monospace, monospace"
                    style={fill}
                    stroke={isDark ? '#000' : '#fff'}
                    strokeWidth={0.4}
                    paintOrder="stroke"
                >
                    10
                </text>

                {/* The readout: the appraisal meter, all ten bars lit. */}
                {BARS.map((b) => (
                    <rect key={b.x} x={b.x} y={46 - b.h} width={1.3} height={b.h} style={fill} opacity={0.9} />
                ))}
            </svg>
        </span>
    );
};

export default React.memo(TranscendentCrest);
