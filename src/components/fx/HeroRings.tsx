import React, { useLayoutEffect, useRef } from 'react';
import { Theme } from '../../core/types';
import SanctuaryRing from './SanctuaryRing';
import ArcaneSigil from './ArcaneSigil';

/**
 * The dashboard's ring system: one whole circle, as tall as the screen, centred on the hero.
 *
 * The rings used to live inside the hero card and were sized from its width (3.8-4x), so on a
 * desktop they ran past the top and bottom of the screen and the dashboard's scroll area
 * clipped them. They live here now, under the whole dashboard, and the circle is sized to the
 * screen: its outermost ring runs from the top edge to the bottom edge. Where the screen is
 * too narrow for that (a phone held upright), it shrinks so that it stays a whole circle.
 *
 * Horizontally it follows the hero column, whose centre is the card's centre (the rank and
 * sequence columns either side are equal), so it tracks the card as the sidebar opens and
 * closes. Vertically it is the screen's centre: a circle that spans the full height can sit
 * nowhere else.
 *
 * Each theme keeps its own ring language: the Void's concentric SanctuaryRing, the day
 * theme's summoning sigil.
 */
const HeroRings: React.FC<{
    theme: Theme;
    paused: boolean;
    /** The hero column; null until it mounts. */
    anchor: HTMLElement | null;
}> = ({ theme, paused, anchor }) => {
    const layerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const layer = layerRef.current;
        if (!layer || !anchor) return;
        const measure = () => {
            const a = anchor.getBoundingClientRect();
            const l = layer.getBoundingClientRect();
            const cx = a.left + a.width / 2 - l.left;
            // The ring's diameter: the screen's height, unless the circle would then run off a
            // side. 4px keeps the outermost stroke on screen.
            const d = Math.max(0, Math.min(l.height, 2 * cx, 2 * (l.width - cx)) - 4);
            layer.style.setProperty('--ring-cx', `${cx}px`);
            layer.style.setProperty('--ring-d', `${d}px`);
        };
        measure();
        // The hero column resizes as the sidebar's width animates, and the layer with the
        // window, so these two cover every way the centre can move.
        const ro = new ResizeObserver(measure);
        ro.observe(anchor);
        ro.observe(layer);
        return () => ro.disconnect();
    }, [anchor]);

    // Each ring's outermost circle is a fixed share of its box (240/250 and 190/200 of the
    // radius), so the box is sized up by that share for the circle itself to be --ring-d.
    const place = 'left-[var(--ring-cx)] top-1/2 -translate-x-1/2 -translate-y-1/2';
    return (
        <div
            ref={layerRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
            style={{ visibility: anchor ? undefined : 'hidden' }}
        >
            {theme.isDark ? (
                <SanctuaryRing theme={theme} isPaused={paused} className={`${place} w-[calc(var(--ring-d)/0.96)] h-[calc(var(--ring-d)/0.96)]`} />
            ) : (
                <ArcaneSigil theme={theme} paused={paused} className={`${place} w-[calc(var(--ring-d)/0.95)] h-[calc(var(--ring-d)/0.95)]`} />
            )}
        </div>
    );
};

export default React.memo(HeroRings);
