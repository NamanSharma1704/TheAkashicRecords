import React, { useRef, useEffect } from 'react';

interface OmniscientFieldProps {
    isDivineMode?: boolean;
    forceAmber?: boolean;
    isPaused?: boolean;
    isMobile?: boolean;
}

const OmniscientField: React.FC<OmniscientFieldProps> = ({ isDivineMode, forceAmber = false, isPaused = false, isMobile = false }) => {
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
            baseX: Math.random() * width,
            baseY: Math.random() * height,
            speed: Math.random() * 0.05 + 0.01,
            glow: Math.random() > 0.9
        }));

        const animate = () => {
            if (isPaused) {
                requestRef.current = requestAnimationFrame(animate);
                return;
            }
            ctx.clearRect(0, 0, width, height);

            // COLOR LOGIC: Boot is Amber/Cyan, Dashboard is theme-aware
            const glowColor = forceAmber || isDivineMode ? '245, 158, 11' : '139, 92, 246'; // Gold vs Violet
            const regColor = forceAmber ? '34, 211, 238' : (isDivineMode ? '245, 158, 11' : '139, 92, 246'); // More vibrant Cyan (#22d3ee)

            stars.forEach(star => {
                const dx = mouseX - star.x;
                const dy = mouseY - star.y;

                star.x += dx * 0.0005 * star.speed;
                star.y += dy * 0.0005 * star.speed;

                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = star.glow
                    ? `rgba(${glowColor}, 0.8)`
                    : `rgba(${regColor}, ${Math.random() * 0.5 + 0.2})`;
                ctx.fill();

                for (let j = 0; j < stars.length; j++) {
                    const s2 = stars[j];
                    const dist2 = Math.sqrt((star.x - s2.x) ** 2 + (star.y - s2.y) ** 2);
                    if (dist2 < 80) {
                        ctx.beginPath();
                        ctx.moveTo(star.x, star.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.strokeStyle = star.glow
                            ? `rgba(${glowColor}, ${0.1 - dist2 / 800})`
                            : `rgba(${regColor}, ${0.05 - dist2 / 1600})`;
                        ctx.stroke();
                    }
                }
            });
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
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
    }, [isDivineMode, forceAmber, isPaused, isMobile]);

    return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-60" />;
};

export default OmniscientField;
