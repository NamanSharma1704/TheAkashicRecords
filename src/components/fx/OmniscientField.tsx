import React, { useRef, useEffect } from 'react';

interface OmniscientFieldProps {
    isDivineMode?: boolean;
    isPaused?: boolean;
    isMobile?: boolean;
}

/** Device pixels per CSS pixel for the field. Capped like the WebGL scenes: past 1.5 the
 *  linework is already crisp and the extra fill is pure cost on a full-screen canvas. */
const MAX_DPR = 1.5;

const OmniscientField: React.FC<OmniscientFieldProps> = ({ isDivineMode, isPaused = false, isMobile = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Pause is read through a ref and applied by starting/stopping the loop, never by
    // rebuilding. Rebuilding on every pause toggle re-scattered the whole field each time
    // a modal opened or closed; and the old paused branch still requested a frame every
    // vsync just to do nothing.
    const pausedRef = useRef(isPaused);
    const loopRef = useRef<{ start: () => void; stop: () => void } | null>(null);

    useEffect(() => {
        pausedRef.current = isPaused;
        const loop = loopRef.current;
        if (!loop) return;
        if (isPaused) loop.stop();
        else loop.start();
    }, [isPaused]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Under reduced motion the field is drawn once and holds still. The drift is
        // ambient movement across the whole screen, which is exactly what the preference
        // asks to be spared.
        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let width = window.innerWidth;
        let height = window.innerHeight;
        const size = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        size();
        let mouseX = width / 2;
        let mouseY = height / 2;

        const particleCount = isMobile ? 30 : 100;
        const stars = Array.from({ length: particleCount }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2,
            speed: Math.random() * 0.05 + 0.01,
            glow: Math.random() > 0.9
        }));

        // Violet points on the void; dark linework on the drafting table.
        // Light mode used to draw the same emitted-light constellation in amber, which
        // on a pale page is both the wrong theme's accent and invisible — there is no
        // headroom above near-white for a glowing point to occupy. Inverted, the same
        // geometry reads as a technical field: slate nodes joined by fine contour lines.
        const glowColor = isDivineMode ? '30, 41, 59' : '139, 92, 246';
        const regColor = isDivineMode ? '51, 65, 85' : '139, 92, 246';
        // Dark ink on light needs far less alpha to register than light on dark — but
        // the links need more, because 0.04 of slate over #e9eef5 is nothing at all.
        const glowAlpha = isDivineMode ? 0.34 : 0.8;
        const regAlpha = isDivineMode ? 0.20 : 0.4;
        const linkAlpha = isDivineMode ? 0.10 : 0.04;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // Batch Stars Rendering (Exactly 2 fill calls)
            const glowPath = new Path2D();
            const basicPath = new Path2D();

            stars.forEach(star => {
                if (star.glow) {
                    glowPath.moveTo(star.x + star.size, star.y);
                    glowPath.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                } else {
                    basicPath.moveTo(star.x + star.size, star.y);
                    basicPath.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                }
            });

            ctx.fillStyle = `rgba(${glowColor}, ${glowAlpha})`;
            ctx.fill(glowPath);

            // Basic stars with randomized alpha but drawn in bulk for speed
            ctx.fillStyle = `rgba(${regColor}, ${regAlpha})`;
            ctx.fill(basicPath);

            // Optimized Link Logic (Exactly 1 stroke call, 0 state changes in loop)
            ctx.beginPath();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = `rgba(${regColor}, ${linkAlpha})`; // Fixed alpha for maximum batching efficiency
            const maxDistSq = 6400; // 80 * 80

            for (let i = 0; i < stars.length; i++) {
                const s1 = stars[i];
                for (let j = i + 1; j < stars.length; j++) {
                    const s2 = stars[j];
                    const dx = s1.x - s2.x;
                    const dy = s1.y - s2.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < maxDistSq) {
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                    }
                }
            }
            ctx.stroke();
        };

        let frameId = 0;
        const step = () => {
            // Drift toward the pointer.
            stars.forEach(star => {
                const dx = mouseX - star.x;
                const dy = mouseY - star.y;
                star.x += dx * 0.0005 * star.speed;
                star.y += dy * 0.0005 * star.speed;
            });
            draw();
            frameId = requestAnimationFrame(step);
        };
        const start = () => {
            if (frameId || reducedMotion || pausedRef.current) return;
            frameId = requestAnimationFrame(step);
        };
        const stop = () => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = 0;
        };
        loopRef.current = { start, stop };

        // First frame is painted synchronously so the field is never blank — this is also
        // the only frame a reduced-motion or paused mount will ever draw.
        draw();
        start();

        const handleResize = () => {
            size();
            // Resizing clears the canvas; repaint so a stopped field does not vanish.
            draw();
        };
        const handleMouse = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        window.addEventListener('resize', handleResize);
        if (!reducedMotion) window.addEventListener('mousemove', handleMouse, { passive: true });
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouse);
            stop();
            loopRef.current = null;
        };
    }, [isDivineMode, isMobile]);

    return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none opacity-60" aria-hidden="true" />;
};

export default OmniscientField;
