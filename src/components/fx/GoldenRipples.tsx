import React, { useRef, useState, useEffect } from 'react';

const GoldenRipples: React.FC<{ colorRGB: string; isPaused?: boolean }> = ({ colorRGB, isPaused = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // OPTIMIZATION: Don't render complex ripples on small screens
    const [shouldRender, setShouldRender] = useState(true);
    useEffect(() => {
        setShouldRender(window.innerWidth > 768);
    }, []);

    useEffect(() => {
        if (!shouldRender) return;

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
        const animate = () => {
            if (isPaused) return;
            ctx.clearRect(0, 0, width, height);
            if (Math.random() < 0.02) ripples.push(createRipple());
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;
                r.alpha -= 0.005;
                if (r.alpha <= 0) { ripples.splice(i, 1); } else { ctx.beginPath(); ctx.ellipse(r.x, r.y, r.radius * 2, r.radius * 0.6, 0, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${colorRGB}, ${r.alpha * 0.5})`; ctx.lineWidth = r.lineWidth; ctx.stroke(); ctx.fillStyle = `rgba(${colorRGB}, ${r.alpha * 0.05})`; ctx.fill(); }
            }
            requestAnimationFrame(animate);
        };
        const animId = requestAnimationFrame(animate);
        return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(animId); };
    }, [colorRGB, shouldRender, isPaused]);

    if (!shouldRender) return null; // OPTIMIZATION: Return null on mobile

    return (<div className="absolute inset-0 pointer-events-none z-0"><canvas ref={canvasRef} className="w-full h-full opacity-60" /><div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-20 transition-colors duration-700 ease-in-out`} style={{ '--tw-gradient-from': `rgb(${colorRGB})` } as React.CSSProperties} /></div>);
};

export default GoldenRipples;
