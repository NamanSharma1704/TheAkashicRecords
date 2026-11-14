import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';

/**
 * THE PHASE SHIFT: how Home, the Spire and the Profile hand over to each other (2026-11-13).
 *
 * App mounts it, keyed, whenever the view changes between those three, however it was asked
 * for (the phone's tab bar, the desktop buttons, a close button, Escape). The new view is
 * already mounted beneath it; for 280 ms the System changes channel over it:
 *
 *   0 ms     the screen drops to a dim veil in the theme's own floor colour, faint scan lines
 *            across it, the new view showing through
 *   0-280    a scanline sweeps from the top of the screen to the bottom; above it the veil is
 *            gone and the new view is resolved, a soft band of light trailing the line
 *
 * The new view's heading decodes as it lands (the AKASHIC wordmark, HUNTER PROFILE, THE DIVINE
 * SPIRE: ScrambleText). The series page and the editor keep their rift (RiftOpening): App does
 * not shift for them.
 *
 * Above the views and below the tab bar (z-[340] < 350), so the tap that asked for it stays in
 * sight; it never takes a pointer. Clip-path, opacity and one line's `top` only. Under reduced
 * motion it is a plain fade of the veil, no line.
 *
 * Keep PHASE_MS in step with the phase-* keyframes in index.css.
 */

export const PHASE_MS = 280;

const PhaseShift: React.FC<{ theme: Theme; onDone: () => void }> = ({ theme, onDone }) => {
    const reduce = useReducedMotion();
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const t = window.setTimeout(onDone, PHASE_MS + 30);
        return () => window.clearTimeout(t);
    }, [onDone]);

    // One clock for the veil and the line, so the line stays on the veil's edge (the browser
    // can start two CSS animations a few ms apart; see RiftOpening).
    useEffect(() => {
        const host = hostRef.current;
        if (!host || typeof host.getAnimations !== 'function') return;
        const anims = host.getAnimations({ subtree: true });
        let cancelled = false;
        Promise.all(anims.map((a) => a.ready)).then(() => {
            if (cancelled) return;
            const starts = anims.map((a) => a.startTime).filter((s): s is number => typeof s === 'number');
            if (starts.length < 2) return;
            const first = Math.min(...starts);
            anims.forEach((a) => { a.startTime = first; });
        }).catch(() => { /* cancelled: nothing to align */ });
        return () => { cancelled = true; };
    }, []);

    const rgb = theme.accentFillRGB;
    const floor = theme.isDark ? 'rgba(2,2,2,0.9)' : 'rgba(233,226,246,0.9)';
    const scan = `repeating-linear-gradient(0deg, rgba(${rgb},${theme.isDark ? 0.07 : 0.09}) 0px, rgba(${rgb},${theme.isDark ? 0.07 : 0.09}) 1px, transparent 1px, transparent 4px)`;

    return (
        <div ref={hostRef} aria-hidden="true" className="fixed inset-0 z-[340] pointer-events-none overflow-hidden">
            <div className={`absolute inset-0 ${reduce ? 'phase-fade' : 'phase-wipe'}`} style={{ background: `${scan}, ${floor}` }} />
            {!reduce && (
                <div className="absolute inset-x-0 h-[2px] -mt-px phase-line">
                    {/* The band of light the new view resolves under, trailing the line. */}
                    <div className="absolute inset-x-0 bottom-full h-14" style={{ background: `linear-gradient(180deg, transparent, rgba(${rgb},${theme.isDark ? 0.14 : 0.18}))` }} />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(90deg, transparent 0%, rgb(${rgb}) 14%, #ffffff 50%, rgb(${rgb}) 86%, transparent 100%)`,
                            boxShadow: `0 0 14px rgba(${rgb},0.9), 0 0 32px rgba(${rgb},0.45)`,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default PhaseShift;
