import React, { useEffect, useRef } from 'react';

interface Card3DProps {
    children: React.ReactNode;
    /** Classes for the tilting element itself. */
    className?: string;
    /** Peak rotation at the corners, in degrees. */
    maxTilt?: number;
    /** Strength of the tracked specular sheen, 0 disables it. */
    glare?: number;
}

/**
 * Pointer-tracked 3D tilt for the hero card.
 *
 * Two constraints shape this.
 *
 * The card is rendered inside a `useMemo`, so tilt state cannot live in React —
 * a `setState` per pointermove would recompute that whole subtree forty times a
 * second. Everything here is refs and direct style writes, and the component never
 * re-renders after mount.
 *
 * And nothing inside a tilted element may carry a CSS filter. `filter` and
 * `backdrop-filter` rasterise their subtree into an offscreen buffer at 1x, which an
 * ancestor 3D transform then perspective-samples — that is what softened the rank
 * sigil. The sheen below is a plain gradient and the transform stays modest for the
 * same reason.
 */
const Card3D: React.FC<Card3DProps> = ({ children, className = '', maxTilt = 7, glare = 0.22 }) => {
    const elRef = useRef<HTMLDivElement | null>(null);
    const glareRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = elRef.current;
        if (!el) return;

        // Skip entirely where a tilt is wrong or unwanted: no hover-capable pointer
        // (a phone would latch the tilt on tap and hold it), or reduced motion.
        // Called through a wrapper, not aliased — a bare `window.matchMedia` reference
        // loses its receiver and throws "Illegal invocation".
        if (typeof window.matchMedia !== 'function') return;
        const mq = (q: string) => window.matchMedia(q);
        if (mq('(prefers-reduced-motion: reduce)').matches) return;
        if (!mq('(hover: hover) and (pointer: fine)').matches) return;

        // Targets the pointer sets; current values the frame loop eases toward them.
        let tx = 0, ty = 0, ta = 0, tgx = 50, tgy = 50;
        let cx = 0, cy = 0, ca = 0, cgx = 50, cgy = 50;
        let frame = 0;
        let settled = true;

        const EASE = 0.16;

        const step = () => {
            cx += (tx - cx) * EASE;
            cy += (ty - cy) * EASE;
            ca += (ta - ca) * EASE;
            cgx += (tgx - cgx) * EASE;
            cgy += (tgy - cgy) * EASE;

            el.style.transform = `rotateX(${cy.toFixed(3)}deg) rotateY(${cx.toFixed(3)}deg)`;
            const g = glareRef.current;
            if (g) {
                g.style.opacity = ca.toFixed(3);
                g.style.background =
                    `radial-gradient(circle at ${cgx.toFixed(1)}% ${cgy.toFixed(1)}%, ` +
                    'rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.22) 28%, rgba(255,255,255,0) 62%)';
            }

            const done = Math.abs(tx - cx) < 0.01 && Math.abs(ty - cy) < 0.01 && Math.abs(ta - ca) < 0.004;
            if (done && tx === 0 && ty === 0 && ta === 0) {
                // Drop back to no transform at rest so the card composites normally
                // and its text is not left resampled on a fractional angle.
                el.style.transform = '';
                el.style.willChange = '';
                if (g) g.style.opacity = '0';
                frame = 0;
                settled = true;
                return;
            }
            frame = requestAnimationFrame(step);
        };

        const run = () => {
            if (frame) return;
            settled = false;
            el.style.willChange = 'transform';
            frame = requestAnimationFrame(step);
        };

        const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return;
            const nx = (e.clientX - r.left) / r.width;
            const ny = (e.clientY - r.top) / r.height;
            // Horizontal pointer travel rotates about Y, vertical about X — and X is
            // negated so the edge nearest the pointer is the one that comes forward.
            tx = (nx - 0.5) * 2 * maxTilt;
            ty = -(ny - 0.5) * 2 * maxTilt;
            ta = glare;
            tgx = nx * 100;
            tgy = ny * 100;
            run();
        };

        const onLeave = () => {
            tx = 0; ty = 0; ta = 0; tgx = 50; tgy = 50;
            run();
        };

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        el.addEventListener('pointercancel', onLeave);

        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
            el.removeEventListener('pointercancel', onLeave);
            if (frame) cancelAnimationFrame(frame);
            if (!settled) {
                el.style.transform = '';
                el.style.willChange = '';
            }
        };
    }, [maxTilt, glare]);

    return (
        // No `transform-style: preserve-3d`: nothing inside the card has depth of its
        // own, so the card should rotate as one flat plane. Leaving it on would also
        // weaken descendant clipping and blend modes for no gain.
        <div ref={elRef} className={className}>
            {children}
            {/* Tracked sheen. Sits above the card art but takes no pointer events, and
                uses a gradient rather than a filter so the tilt cannot blur it.
                `screen` rather than `overlay`: a specular highlight should only ever
                lighten, and overlay darkens wherever the cover art is already dark —
                which on these covers is most of it. */}
            <div
                ref={glareRef}
                aria-hidden="true"
                className="absolute inset-0 z-40 pointer-events-none mix-blend-screen"
                style={{ opacity: 0 }}
            />
        </div>
    );
};

export default Card3D;
