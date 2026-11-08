import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * THE RIFT: how the series page and the editor open. 440 ms, then gone.
 *
 *   0-240 ms    the summoning seal (ArcaneSigil's figure, drawn bright) expands from the
 *               centre, its outer rings turning one way and its runes the other; from ~185 ms
 *               a slash of light runs across the middle
 *   240-440 ms  the slash splits into two edges, one running to the top of the screen and one
 *               to the bottom, and the page opens BETWEEN them: the page wears `.rift-reveal`,
 *               a clip that opens on the same stops and the same curve, so its edge is the
 *               light's edge. The seal dissolves outward as it opens.
 *
 * The rift itself renders BESIDE the page (fixed, one layer above it, via `className`), never
 * inside: inside, the page's clip would cut it off. Transforms, opacity and two thin lines'
 * `top` only; safe glyphs only. Under reduced motion it renders nothing, and the page keeps its
 * plain entrance (each caller checks).
 *
 * The page's reveal and the rift's edges are separate CSS animations on separate elements, and
 * the browser can start them a few milliseconds apart (measured: 0-5 ms). At the fastest part
 * of the curve that put the page's edge ~24px off the light's. So once they have started, the
 * rift sets them all to one start time (`revealRef` is the page that opens). Any nudge falls in
 * the first 240 ms, while everything is still hidden behind the forming seal.
 *
 * Keep RIFT_MS in step with the rift-* keyframes in index.css.
 */

export const RIFT_MS = 440;
const RUNES = ['✦', '◈', '✧', '⬡', '❖', '⬢', '✶', '◇'];

const RiftOpening: React.FC<{ accent: string; className?: string; revealRef?: React.RefObject<HTMLElement | null> }> = ({ accent, className = 'z-[401]', revealRef }) => {
    const reduce = useReducedMotion();
    const [done, setDone] = useState(false);
    const hostRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const t = window.setTimeout(() => setDone(true), RIFT_MS + 20);
        return () => window.clearTimeout(t);
    }, []);

    // One clock for the light and the page it opens (see above).
    useEffect(() => {
        const host = hostRef.current;
        if (!host || typeof host.getAnimations !== 'function') return;
        const page = revealRef?.current;
        const anims = [
            ...host.getAnimations({ subtree: true }),
            ...(page ? page.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'rift-reveal') : []),
        ];
        let cancelled = false;
        Promise.all(anims.map((a) => a.ready)).then(() => {
            if (cancelled) return;
            const starts = anims.map((a) => a.startTime).filter((t): t is number => typeof t === 'number');
            if (starts.length < 2) return;
            const first = Math.min(...starts);
            anims.forEach((a) => { a.startTime = first; });
        }).catch(() => { /* an animation was cancelled (the page closed): nothing to align */ });
        return () => { cancelled = true; };
    }, [revealRef]);

    const ticks = useMemo(() => Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const long = i % 4 === 0;
        const r2 = long ? 182 : 175;
        return { x1: 200 + 168 * Math.cos(a), y1: 200 + 168 * Math.sin(a), x2: 200 + r2 * Math.cos(a), y2: 200 + r2 * Math.sin(a), w: long ? 1.6 : 0.9 };
    }), []);
    const runes = useMemo(() => RUNES.map((g, i) => {
        const a = (i / RUNES.length) * Math.PI * 2 - Math.PI / 2;
        return { g, x: 200 + 143 * Math.cos(a), y: 200 + 143 * Math.sin(a) };
    }), []);
    const hex = (offset: number) => Array.from({ length: 3 }, (_, k) => {
        const a = (offset + k * 120) * Math.PI / 180 - Math.PI / 2;
        return `${(200 + 104 * Math.cos(a)).toFixed(1)},${(200 + 104 * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    if (reduce || done) return null;

    const edge: React.CSSProperties = {
        background: `linear-gradient(90deg, transparent 0%, ${accent} 16%, #ffffff 50%, ${accent} 84%, transparent 100%)`,
        boxShadow: `0 0 16px ${accent}, 0 0 38px ${accent}88`,
    };

    return (
        <div ref={hostRef} aria-hidden="true" className={`fixed inset-0 ${className} pointer-events-none flex items-center justify-center overflow-hidden`}>
            {/* A brief glow where the seal forms. */}
            <div className="absolute inset-0 rift-veil" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}40 0%, ${accent}14 30%, transparent 58%)` }} />

            <svg viewBox="0 0 400 400" className="relative rift-seal" style={{ width: 'min(72vmin, 560px)', height: 'min(72vmin, 560px)', overflow: 'visible' }}>
                <g className="rift-turn" fill="none" stroke={accent}>
                    <circle cx="200" cy="200" r="190" strokeWidth="2" opacity="0.9" />
                    <circle cx="200" cy="200" r="162" strokeWidth="1.2" strokeDasharray="2 8" opacity="0.8" />
                    <circle cx="200" cy="200" r="120" strokeWidth="1.4" opacity="0.75" />
                    {ticks.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={t.w} opacity="0.75" />)}
                    <polygon points={hex(0)} strokeWidth="1.3" opacity="0.6" />
                    <polygon points={hex(60)} strokeWidth="1.3" opacity="0.6" />
                </g>
                <g className="rift-turn-back">
                    <circle cx="200" cy="200" r="143" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="4 10" opacity="0.6" />
                    <circle cx="200" cy="200" r="64" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.7" />
                    {runes.map((r) => (
                        <text key={r.g} x={r.x} y={r.y} fill={accent} fontSize="18" textAnchor="middle" dominantBaseline="central">{r.g}</text>
                    ))}
                </g>
            </svg>

            {/* The tear: one slash across the middle, which splits into the two edges the page
                opens between. */}
            <div className="absolute left-0 right-0 h-[2px] -mt-px rift-edge rift-edge-up" style={edge} />
            <div className="absolute left-0 right-0 h-[2px] -mt-px rift-edge rift-edge-down" style={edge} />
        </div>
    );
};

export default RiftOpening;
