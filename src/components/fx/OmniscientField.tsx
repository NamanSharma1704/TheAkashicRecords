import React, { useRef, useEffect } from 'react';

interface OmniscientFieldProps {
    isDivineMode?: boolean;
    isPaused?: boolean;
    isMobile?: boolean;
}

const OmniscientField: React.FC<OmniscientFieldProps> = ({ isDivineMode, isPaused = false, isMobile = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
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

        // Paused means an overlay covers the field. This used to keep a do-nothing rAF
        // spinning every frame for as long as the overlay stayed open; the effect re-runs
        // when `isPaused` flips back, so there is nothing to keep alive in the meantime.
        if (isPaused) return;

        // Under reduced motion the field is drawn once and left still: the drift toward
        // the pointer is ambient motion with no information in it.
        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

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

            // 1. Update positions
            stars.forEach(star => {
                const dx = mouseX - star.x;
                const dy = mouseY - star.y;
                star.x += dx * 0.0005 * star.speed;
                star.y += dy * 0.0005 * star.speed;
            });

            // 2. Batch Stars Rendering (Exactly 2 fill calls)
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

            // 3. Optimized Link Logic (Exactly 1 stroke call, 0 state changes in loop)
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
            if (!reducedMotion) requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            // Resizing clears the canvas; a still field has no next frame to repaint it.
            if (reducedMotion) animate();
        };
        const handleMouse = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouse);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouse);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isDivineMode, isPaused, isMobile]);

    return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-60" />;
};

export default OmniscientField;
