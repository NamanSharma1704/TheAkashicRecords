import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../../core/types';
import type { DaisHandle } from './scene';

interface HoloDaisProps {
    theme: Theme;
    /** Set while a modal owns the screen, so the loop stops instead of burning frames. */
    paused?: boolean;
    className?: string;
}

/**
 * The holographic dais beneath the hero card.
 *
 * `three` is a ~500 kB chunk that this app otherwise only loads when the Divine Spire
 * opens. Pulling it onto the dashboard would put it on the app's first screen, so the
 * import is deferred to idle and a CSS approximation holds the space until it lands —
 * first paint is never waiting on WebGL, and a device without it keeps the fallback.
 *
 * The loop is stopped whenever the dais cannot be seen: tab hidden, scrolled out of
 * view, or a modal open.
 */
const HoloDais: React.FC<HoloDaisProps> = ({ theme, paused = false, className = '' }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<DaisHandle | null>(null);
    const [live, setLive] = useState(false);
    const [onScreen, setOnScreen] = useState(true);

    // Pause when scrolled out of view. Kept separate from the build effect so a
    // visibility change never tears down the WebGL context.
    useEffect(() => {
        const host = hostRef.current;
        if (!host || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(
            ([entry]) => setOnScreen(entry.isIntersecting),
            { rootMargin: '64px' },
        );
        io.observe(host);
        return () => io.disconnect();
    }, []);

    // Build once per theme. Colours are baked into the materials, so a theme flip
    // rebuilds rather than mutating uniforms across the whole graph.
    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        let cancelled = false;
        let frameId = 0;
        let idleId: number | null = null;
        let timerId: number | null = null;
        let observer: ResizeObserver | null = null;

        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const start = async () => {
            // Cheap probe first: building a renderer on a device without WebGL throws,
            // and the fallback is a better outcome than a caught exception per mount.
            try {
                const probe = document.createElement('canvas');
                if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
            } catch { return; }

            let createDais: typeof import('./scene')['createDais'];
            try {
                ({ createDais } = await import('./scene'));
            } catch { return; }
            if (cancelled) return;

            const handle = createDais({ host, isDark: theme.isDark, reducedMotion });
            handleRef.current = handle;

            // Coalesced into a frame: resizing reallocates the drawing buffer, and a
            // ResizeObserver fires in bursts (a window drag, or the sidebar's width
            // transition next door), so this caps it at one reallocation per frame.
            let sizeQueued = 0;
            const applySize = () => {
                const r = host.getBoundingClientRect();
                handle.resize(Math.round(r.width), Math.round(r.height));
            };
            const queueSize = () => {
                if (sizeQueued) return;
                sizeQueued = requestAnimationFrame(() => { sizeQueued = 0; applySize(); });
            };
            applySize();
            if (typeof ResizeObserver !== 'undefined') {
                observer = new ResizeObserver(queueSize);
                observer.observe(host);
            }

            if (!cancelled) setLive(true);

            if (reducedMotion) {
                handle.frame(0);
                return;
            }
            let last = performance.now();
            const loop = (now: number) => {
                const dt = Math.min((now - last) / 1000, 0.05);
                last = now;
                handle.frame(dt);
                frameId = requestAnimationFrame(loop);
            };
            frameId = requestAnimationFrame(loop);
        };

        // Defer past first paint so the chunk never competes with the dashboard render.
        const idle = (window as unknown as {
            requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        }).requestIdleCallback;
        if (typeof idle === 'function') {
            idleId = idle(() => { void start(); }, { timeout: 1800 });
        } else {
            timerId = window.setTimeout(() => { void start(); }, 400);
        }

        return () => {
            cancelled = true;
            if (frameId) cancelAnimationFrame(frameId);
            if (timerId !== null) window.clearTimeout(timerId);
            const cancelIdle = (window as unknown as {
                cancelIdleCallback?: (id: number) => void;
            }).cancelIdleCallback;
            if (idleId !== null && typeof cancelIdle === 'function') cancelIdle(idleId);
            observer?.disconnect();
            handleRef.current?.dispose();
            handleRef.current = null;
            setLive(false);
        };
    }, [theme.isDark]);

    // Stop the loop whenever the dais cannot be seen, and resume where it left off.
    useEffect(() => {
        const handle = handleRef.current;
        if (!handle || !live) return;
        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        let frameId = 0;
        let last = performance.now();
        let running = false;

        const loop = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            handle.frame(dt);
            frameId = requestAnimationFrame(loop);
        };
        const shouldRun = () => !paused && onScreen && !document.hidden;
        const sync = () => {
            if (shouldRun() && !running) {
                running = true;
                last = performance.now();
                frameId = requestAnimationFrame(loop);
            } else if (!shouldRun() && running) {
                running = false;
                cancelAnimationFrame(frameId);
            }
        };

        document.addEventListener('visibilitychange', sync);
        sync();
        return () => {
            document.removeEventListener('visibilitychange', sync);
            if (running) cancelAnimationFrame(frameId);
        };
    }, [live, paused, onScreen]);

    const accent = theme.accentColor;

    return (
        <div
            ref={hostRef}
            className={`pointer-events-none select-none ${className}`}
            aria-hidden="true"
        >
            {/* Static stand-in: holds the space before the chunk lands and stays put on
                a device with no WebGL. Concentric ellipses read close enough at this
                size that the swap is not a visible pop. */}
            <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{
                    opacity: live ? 0 : 1,
                    background: [
                        `radial-gradient(ellipse 34% 40% at 50% 62%, ${accent}66, transparent 70%)`,
                        `radial-gradient(ellipse 52% 58% at 50% 62%, ${accent}30, transparent 72%)`,
                        `radial-gradient(ellipse 76% 82% at 50% 62%, ${accent}1a, transparent 74%)`,
                    ].join(','),
                }}
            />
            {/* The renderer appends its own canvas here — see DaisOptions.host. */}
        </div>
    );
};

export default HoloDais;
