import React from 'react';
import ScrambleText from './ScrambleText';

/**
 * THE STREAK SUPERNOVA: the emblem a streak reward toast wears in place of its icon.
 *
 * A HUD node in the theme accent (as RankSigil and the Transcendent Crest): a glass core with a
 * luminous rim, a dashed reticle turning slowly, and the streak's day count in monospace. On
 * arrival it flares, once, in 600 ms: two shockwave rings bloom out of the core, the core
 * flashes, and the count decodes from glyphs into the number (ScrambleText). Under reduced
 * motion it simply shows. Decoration only: the toast's text says the count in words.
 */

const StreakNova: React.FC<{ days: number; isDark: boolean }> = ({ days, isDark }) => {
    const coreFace = isDark ? 'rgba(11,11,17,0.9)' : 'rgba(255,255,255,0.88)';
    const ink = { stroke: 'var(--accent-color)' };
    return (
        <span aria-hidden="true" className="streak-nova relative inline-flex shrink-0 items-center justify-center w-11 h-11">
            <svg viewBox="0 0 44 44" width={44} height={44} className="absolute inset-0 overflow-visible">
                {/* The shockwaves. */}
                <circle className="nova-wave" cx="22" cy="22" r="14" fill="none" style={ink} strokeWidth={1.8} />
                <circle className="nova-wave nova-wave-late" cx="22" cy="22" r="14" fill="none" style={ink} strokeWidth={1.2} />
                {/* The reticle, and the core. */}
                <circle className="nova-spin" cx="22" cy="22" r="19" fill="none" style={ink} strokeWidth={0.6} strokeDasharray="1.2 3.4" opacity={0.6} />
                <g className="nova-core">
                    <circle cx="22" cy="22" r="14" fill={coreFace} style={ink} strokeWidth={1.4} />
                    <circle cx="22" cy="22" r="14" style={{ fill: 'var(--accent-color)' }} fillOpacity={0.12} />
                </g>
            </svg>
            <ScrambleText
                text={String(days)}
                decodeOnMount
                className="relative font-mono font-black text-[13px] leading-none tabular-nums text-accent-ink"
            />
        </span>
    );
};

export default React.memo(StreakNova);
