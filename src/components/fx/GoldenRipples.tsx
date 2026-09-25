import React, { useRef, useState, useEffect } from 'react';

/**
 * Expanding rings on the background field.
 *
 * `isDark` does not pick a colour — that arrives as `colorRGB` from the theme — it picks
 * how hard to press. Light ink on the void can sit at half alpha and still read as a
 * gentle bloom; dark ink on a pale page at the same alpha reads as a drawn line, so the
 * light branch is pulled back until the rings are contours rather than marks.
 *
 * The ripples are nothing BUT motion, so under prefers-reduced-motion the canvas is not
 * rendered at all rather than frozen mid-expansion; the static wash beneath it stays.
 */
const GoldenRipples: React.FC<{ colorRGB: string; isPaused?: boolean; isDark?: boolean }> = ({ colorRGB, isPaused = false, isDark = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Pause starts and stops the loop through this ref instead of rebuilding the effect,
    // which used to discard every ripple in flight whenever a modal opened or closed.
    const pausedRef = useRef(isPaused);
    const loopRef = useRef<{ start: () => void; stop: () => void } | null>(null);

    // OPTIMIZATION: Don't render complex ripples on small screens.
    const [shouldRender, setShouldRender] = useState(true);
    const [animated, setAnimated] = useState(true);
    useEffect(() => {
        setShouldRender(window.innerWidth > 768);
        setAnimated(!(typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    }, []);

    useEffect(() => {
        pausedRef.current = isPaused;
        const loop = loopRef.current;
        if (!loop) return;
        if (isPaused) loop.stop();
        else loop.start();
    }, [isPaused]);

    useEffect(() => {
        if (!shouldRender || !animated) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        const handleResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
        window.addEventListener('resize', handleResize);
        const ripples: { x: number; y: number; radius: number; maxRadius: number; speed: number; alpha: number; lineWidth: number }[] = [];
        const createRipple = () => ({ x: Math.random() * width, y: Math.random() * height * 0.5 + (height * 0.5), radius: 0, maxRadius: Math.random() * 100 + 50, speed: Math.random() * 0.5 + 0.2, alpha: 1, lineWidth: Math.random() * 2 + 0.5 });
        for (let i = 0; i < 3; i++) ripples.push(createRipple());

        // The frame id is tracked live (an earlier version cancelled only the first one,
        // so the loop outlived unmount), and a paused field requests no frames at all.
        let frameId = 0;
        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            if (Math.random() < 0.02) ripples.push(createRipple());
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;
                r.alpha -= 0.005;
                if (r.alpha <= 0) { ripples.splice(i, 1); } else { ctx.beginPath(); ctx.ellipse(r.x, r.y, r.radius * 2, r.radius * 0.6, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${colorRGB}, ${r.alpha * (isDark ? 0.5 : 0.20)})`; ctx.lineWidth = r.lineWidth; ctx.stroke(); ctx.fillStyle = `rgba(${colorRGB}, ${r.alpha * (isDark ? 0.05 : 0.015)})`; ctx.fill(); }
            }
            frameId = requestAnimationFrame(animate);
        };
        const start = () => {
            if (frameId || pausedRef.current) return;
            frameId = requestAnimationFrame(animate);
        };
        const stop = () => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = 0;
        };
        loopRef.current = { start, stop };
        start();
        return () => { window.removeEventListener('resize', handleResize); stop(); loopRef.current = null; };
    }, [colorRGB, shouldRender, animated, isDark]);

    if (!shouldRender) return null; // OPTIMIZATION: Return null on mobile

    return (<div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">{animated && <canvas ref={canvasRef} className="w-full h-full opacity-60" />}<div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isDark ? 'opacity-20' : 'opacity-[0.07]'} transition-opacity duration-700 ease-in-out`} style={{ '--tw-gradient-from': `rgb(${colorRGB})` } as React.CSSProperties} /></div>);
};

export default GoldenRipples;
