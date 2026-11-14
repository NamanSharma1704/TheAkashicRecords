import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../../core/types';
import type { DaisHandle } from './scene';

interface HoloDaisProps {
    theme: Theme;
    /** Set while a modal owns the screen, so the loop stops instead of burning frames. */
    paused?: boolean;
    className?: string;
    /** Filled with a function that plays the chapter pulse (DaisHandle.pulse) while the dais
     *  is animating, and emptied when it is not: paused, off screen, hidden tab, reduced
     *  motion or not built yet. A pulse then is simply not played, rather than saved up to
     *  go off later. A ref, so firing it never re-renders anything. */
    pulseRef?: React.MutableRefObject<(() => void) | null>;
    /** Low-power mode: the still only. `three` is never fetched, and a live dais is let go. */
    still?: boolean;
}

/** Renders of the real dais, one per theme (system/public; made by .claude/smoke/tools/
 *  dais-still.mjs from the canvas itself, so the framing is the live dais's exactly). */
const STILL = { dark: '/dais-still-dark.webp', light: '/dais-still-light.webp' };

/**
 * The holographic dais beneath the hero card.
 *
 * `three` is a ~500 kB chunk that this app otherwise only loads when the Divine Spire
 * opens. Pulling it onto the dashboard would put it on the app's first screen, so the
 * import is deferred to idle and a STILL of the real dais holds the space until it lands —
 * first paint is never waiting on WebGL, and a device without it keeps the still.
 *
 * THE LIGHTER PHONE (2026-11-13): the 3D is not fetched at all where it would buy nothing or
 * cost too much, and the still stays:
 *   - low-power mode (`still`), reduced motion (the live dais would only ever draw its first
 *     frame), and Save-Data;
 *   - on a phone, it waits for the page's own load to finish and then for a quiet moment
 *     (iOS has no requestIdleCallback, where it used to start 400 ms after mounting).
 * Before the still image decodes, a CSS glow approximates it for the first paint.
 *
 * The loop is stopped whenever the dais cannot be seen: tab hidden, scrolled out of
 * view, or a modal open.
 */
const HoloDais: React.FC<HoloDaisProps> = ({ theme, paused = false, className = '', pulseRef, still = false }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<DaisHandle | null>(null);
    const [live, setLive] = useState(false);
    const [onScreen, setOnScreen] = useState(true);
    const stillSrc = theme.isDark ? STILL.dark : STILL.light;
    // Which still has decoded (by its src), so the CSS glow under it can step aside.
    const [stillShown, setStillShown] = useState<string | null>(null);

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
        let idleId: number | null = null;
        let timerId: number | null = null;
        let observer: ResizeObserver | null = null;
        let onLoad: (() => void) | null = null;
        // Effect-scoped so teardown can cancel a resize that is still queued; otherwise
        // it could land after dispose and repaint through a released renderer.
        let sizeQueued = 0;

        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
        // Where the 3D buys nothing or costs too much, the still is the dais.
        if (still || reducedMotion || saveData) return;
        const phone = (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
            || window.innerWidth < 768;

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

            // One still frame, then hand over. The animation loop belongs to the effect
            // below and ONLY to it: this used to start a second, unconditional loop here,
            // so every frame rendered twice, the sweep and spin ran at double speed, and
            // `paused` / off-screen / hidden-tab stopped only one of the two.
            handle.frame(0);
            if (!cancelled) setLive(true);
        };

        // Defer past first paint so the chunk never competes with the dashboard render. A
        // phone waits longer: for the page's own load, then a quiet moment.
        const idle = (window as unknown as {
            requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        }).requestIdleCallback;
        const schedule = () => {
            if (cancelled) return;
            if (typeof idle === 'function') {
                idleId = idle(() => { void start(); }, { timeout: phone ? 6000 : 1800 });
            } else {
                timerId = window.setTimeout(() => { void start(); }, phone ? 2000 : 400);
            }
        };
        if (phone && document.readyState !== 'complete') {
            onLoad = schedule;
            window.addEventListener('load', onLoad, { once: true });
        } else {
            schedule();
        }

        return () => {
            cancelled = true;
            if (onLoad) window.removeEventListener('load', onLoad);
            if (timerId !== null) window.clearTimeout(timerId);
            const cancelIdle = (window as unknown as {
                cancelIdleCallback?: (id: number) => void;
            }).cancelIdleCallback;
            if (idleId !== null && typeof cancelIdle === 'function') cancelIdle(idleId);
            if (sizeQueued) cancelAnimationFrame(sizeQueued);
            observer?.disconnect();
            handleRef.current?.dispose();
            handleRef.current = null;
            setLive(false);
        };
    }, [theme.isDark, still]);

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
                if (pulseRef) pulseRef.current = () => handle.pulse();
            } else if (!shouldRun() && running) {
                running = false;
                cancelAnimationFrame(frameId);
                if (pulseRef) pulseRef.current = null;
            }
        };

        document.addEventListener('visibilitychange', sync);
        sync();
        return () => {
            document.removeEventListener('visibilitychange', sync);
            if (running) cancelAnimationFrame(frameId);
            if (pulseRef) pulseRef.current = null;
        };
    }, [live, paused, onScreen, pulseRef]);

    // The stand-in borrows the PLATFORM's light, not the theme accent: the real dais is
    // white on the void and the same neutral slate as the card chrome on the page, so an
    // accent-tinted placeholder changed hue at the moment of the swap.
    const glow = theme.isDark ? '#ffffff' : '#7c3aed';

    return (
        <div
            ref={hostRef}
            className={`pointer-events-none select-none ${className}`}
            aria-hidden="true"
        >
            {/* The still: a render of the real dais (same canvas, same framing), holding the
                space before the 3D lands and staying put where it never will. Under it, for
                the moment before the image decodes, concentric glows approximate it. */}
            <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 0 : 1 }}>
                <div
                    className="absolute inset-0 transition-opacity duration-500"
                    style={{
                        opacity: stillShown === stillSrc ? 0 : 1,
                        background: [
                            `radial-gradient(ellipse 34% 40% at 50% 62%, ${glow}55, transparent 70%)`,
                            `radial-gradient(ellipse 52% 58% at 50% 62%, ${glow}28, transparent 72%)`,
                            `radial-gradient(ellipse 76% 82% at 50% 62%, ${glow}14, transparent 74%)`,
                        ].join(','),
                    }}
                />
                <img
                    key={stillSrc}
                    src={stillSrc}
                    alt=""
                    decoding="async"
                    draggable={false}
                    onLoad={() => setStillShown(stillSrc)}
                    className="absolute inset-0 w-full h-full transition-opacity duration-500"
                    style={{ opacity: stillShown === stillSrc ? 1 : 0 }}
                />
            </div>
            {/* The renderer appends its own canvas here — see DaisOptions.host. */}
        </div>
    );
};

export default HoloDais;
