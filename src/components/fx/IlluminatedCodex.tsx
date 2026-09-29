import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';

/**
 * The light theme's own animated background — the counterpart to the Void's starfield, and
 * deliberately NOT points of light on a field. Dark speaks in emitted light (stars, lattice,
 * ripples); none of that reads on a pale page, and a scatter of specks just reads as "dots and
 * stars" recoloured. Light speaks its own language instead — flowing colour:
 *
 *   - AURORA FLOW — a handful of very large, heavily-blurred amethyst light-fields that
 *     continuously breathe, drift and swell into one another, like ink dispersing in water or
 *     stained-glass light moving across a wall. A living colour body, not points. Kept to the
 *     margins so the centre stays a clean pool for content.
 *
 * The arcane summoning-sigil that completes the composition is a separate piece ({@link
 * ArcaneSigil}): it is centred on the hero's card and platform rather than the viewport, so it
 * lives with the hero, not in this full-page field.
 *
 * Rendered only in light (see BackgroundController); the Void keeps its own effects. Motion is
 * pure transform/opacity, and honours reduced-motion / pause by holding a composed still frame.
 */

interface Props {
    theme: Theme;
    isPaused?: boolean;
}

const IlluminatedCodex: React.FC<Props> = ({ theme, isPaused = false }) => {
    const reducedMotion = useReducedMotion();
    const still = reducedMotion || isPaused;

    // Bare "r,g,b" of the accent so the atmosphere follows the theme token.
    const rgb = useMemo(() => {
        const h = theme.accentColor.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    }, [theme.accentColor]);

    // Flowing aurora fields. Large and softly blurred so overlapping bodies merge into one
    // continuous, moving amethyst light rather than discrete blobs. Each breathes on its own
    // phase (position + scale + opacity), which is what sells "flow" over "drift".
    const fields = useMemo(() => ([
        { x: '10%', y: '14%', size: '52vw', a: 0.34, mx: [0, 60, -30, 0], my: [0, 34, 60, 0], sc: [1, 1.14, 0.94, 1], dur: 22 },
        { x: '90%', y: '18%', size: '46vw', a: 0.26, mx: [0, -50, 26, 0], my: [0, 40, 18, 0], sc: [1, 0.92, 1.12, 1], dur: 27 },
        { x: '84%', y: '86%', size: '54vw', a: 0.32, mx: [0, -44, 30, 0], my: [0, -36, -18, 0], sc: [1, 1.12, 0.96, 1], dur: 25 },
        { x: '12%', y: '88%', size: '48vw', a: 0.27, mx: [0, 48, -22, 0], my: [0, -30, -46, 0], sc: [1, 0.94, 1.1, 1], dur: 30 },
        { x: '50%', y: '46%', size: '64vw', a: 0.14, mx: [0, 30, -30, 0], my: [0, -24, 24, 0], sc: [1, 1.08, 0.96, 1], dur: 34 },
    ]), []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Flowing aurora light-fields. */}
            {fields.map((f, i) => (
                <div
                    key={`f${i}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: f.x, top: f.y, width: f.size, height: f.size }}
                >
                    <motion.div
                        className="w-full h-full rounded-full"
                        style={{
                            background: `radial-gradient(circle, rgba(${rgb}, ${f.a}) 0%, rgba(${rgb}, ${(f.a * 0.45).toFixed(3)}) 34%, transparent 70%)`,
                            filter: 'blur(44px)',
                            willChange: 'transform, opacity',
                        }}
                        animate={still
                            ? { opacity: f.a * 0.9 }
                            : { x: f.mx, y: f.my, scale: f.sc, opacity: [f.a * 0.72, f.a, f.a * 0.86, f.a * 0.72] }}
                        transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
            ))}
        </div>
    );
};

export default React.memo(IlluminatedCodex);
