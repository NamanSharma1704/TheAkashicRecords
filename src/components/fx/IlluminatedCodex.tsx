import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Theme } from '../../core/types';

/**
 * The light theme's living atmosphere — the flowing motion over the radiant amethyst sky that
 * {@link GalaxyNebula} paints. The sky supplies the rich static depth; this layer keeps it ALIVE:
 *
 *   - AURORA — large, saturated violet / magenta blooms that breathe, drift and swell into one
 *     another like light through moving cloud. This is the "feel": a bright atmosphere that moves,
 *     not a flat page. Saturated on purpose — the earlier pale version read as nothing.
 *   - MOTES — fine drifting flecks of violet light for depth and life in the air.
 *
 * The arcane summoning-sigil ({@link ArcaneSigil}) is separate; it centres on the hero.
 * Rendered only in light (see BackgroundController). Motion is pure transform/opacity and holds a
 * still frame under reduced-motion / pause.
 */

const frac = (n: number) => n - Math.floor(n);
const hash = (n: number, seed: number) => frac(Math.sin(n * seed) * 43758.5453123);

interface Props {
    theme: Theme;
    isPaused?: boolean;
}

const IlluminatedCodex: React.FC<Props> = ({ isPaused = false }) => {
    const reducedMotion = useReducedMotion();
    const still = reducedMotion || isPaused;

    // Flowing aurora — saturated colour bodies that move. Kept off the very centre so the content
    // band stays legible; blurred heavily so overlapping bodies merge into one moving light.
    const fields = useMemo(() => ([
        { x: '12%', y: '18%', size: '50vw', c: '139, 92, 246', a: 0.32, mx: [0, 60, -30, 0], my: [0, 34, 60, 0], sc: [1, 1.14, 0.94, 1], dur: 24 },
        { x: '88%', y: '24%', size: '44vw', c: '214, 120, 224', a: 0.26, mx: [0, -50, 26, 0], my: [0, 40, 18, 0], sc: [1, 0.92, 1.12, 1], dur: 29 },
        { x: '84%', y: '82%', size: '52vw', c: '124, 58, 237', a: 0.30, mx: [0, -44, 30, 0], my: [0, -36, -18, 0], sc: [1, 1.12, 0.96, 1], dur: 27 },
        { x: '14%', y: '86%', size: '46vw', c: '99, 102, 241', a: 0.28, mx: [0, 48, -22, 0], my: [0, -30, -46, 0], sc: [1, 0.94, 1.1, 1], dur: 32 },
        { x: '52%', y: '52%', size: '58vw', c: '168, 85, 247', a: 0.14, mx: [0, 30, -30, 0], my: [0, -24, 24, 0], sc: [1, 1.08, 0.96, 1], dur: 36 },
    ]), []);

    // Fine drifting motes — flecks of violet light giving the air depth and life.
    const motes = useMemo(() => Array.from({ length: 30 }, (_, k) => {
        const i = k + 1;
        const depth = hash(i, 5.31);
        return {
            left: hash(i, 12.9898) * 100,
            top: hash(i, 78.233) * 100,
            size: 1.6 + depth * 3.4,
            op: 0.18 + depth * 0.34,
            dx: (hash(i, 33.71) * 2 - 1) * (10 + depth * 26),
            dy: (hash(i, 51.37) * 2 - 1) * (8 + depth * 20),
            dur: 20 + hash(i, 24.09) * 28,
            delay: hash(i, 55.13) * 14,
        };
    }), []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Flowing aurora. */}
            {fields.map((f, i) => (
                <div
                    key={`f${i}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: f.x, top: f.y, width: f.size, height: f.size }}
                >
                    <motion.div
                        className="w-full h-full rounded-full"
                        style={{
                            background: `radial-gradient(circle, rgba(${f.c}, ${f.a}) 0%, rgba(${f.c}, ${(f.a * 0.45).toFixed(3)}) 34%, transparent 70%)`,
                            filter: 'blur(46px)',
                            mixBlendMode: 'multiply',
                            willChange: 'transform, opacity',
                        }}
                        animate={still
                            ? { opacity: f.a * 0.9 }
                            : { x: f.mx, y: f.my, scale: f.sc, opacity: [f.a * 0.72, f.a, f.a * 0.86, f.a * 0.72] }}
                        transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
            ))}

            {/* Drifting violet motes. */}
            {motes.map((m, i) => (
                <motion.span
                    key={`m${i}`}
                    className="absolute rounded-full"
                    style={{
                        left: `${m.left}%`,
                        top: `${m.top}%`,
                        width: m.size,
                        height: m.size,
                        background: 'rgb(124, 58, 237)',
                        boxShadow: `0 0 ${(m.size * 2).toFixed(1)}px rgba(124, 58, 237, ${(m.op * 0.5).toFixed(3)})`,
                        opacity: m.op,
                        willChange: 'transform, opacity',
                    }}
                    animate={still
                        ? { opacity: m.op * 0.8 }
                        : { x: [0, m.dx, 0], y: [0, m.dy, 0], opacity: [m.op * 0.4, m.op, m.op * 0.4] }}
                    transition={{ duration: m.dur, repeat: Infinity, ease: 'easeInOut', delay: m.delay }}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
};

export default React.memo(IlluminatedCodex);
