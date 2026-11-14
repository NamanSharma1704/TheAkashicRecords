import React, { useLayoutEffect, useRef, useState } from 'react';
import { QuestGoals, Theme } from '../../core/types';
import SanctuaryRing from './SanctuaryRing';
import ArcaneSigil from './ArcaneSigil';
import ManaRing from './ManaRing';

/**
 * The dashboard's ring system: one whole circle, as tall as the screen, centred on the hero.
 *
 * The rings used to live inside the hero card and were sized from its width (3.8-4x), so on a
 * desktop they ran past the top and bottom of the screen and the dashboard's scroll area
 * clipped them. They live here now, under the whole dashboard, and the circle is sized to the
 * screen: its outermost ring runs from the top edge to the bottom edge on every screen. Where
 * the screen is narrower than it is tall (a phone held upright), the sides run off instead:
 * the owner chose top-to-bottom over a smaller whole circle hidden behind the card.
 *
 * Horizontally it follows the hero column, whose centre is the card's centre (the rank and
 * sequence columns either side are equal), so it tracks the card as the sidebar opens and
 * closes. Vertically it is the screen's centre: a circle that spans the full height can sit
 * nowhere else.
 *
 * Each theme keeps its own ring language: the Void's concentric SanctuaryRing, the day
 * theme's summoning sigil. Over either, the Mana Ring (ManaRing.tsx) fills with today's Divine
 * Mandate.
 */
const HeroRings: React.FC<{
    theme: Theme;
    paused: boolean;
    /** The hero column; null until it mounts. */
    anchor: HTMLElement | null;
    /** Today's quests, for the Mana Ring; null until the state loads. */
    goals?: QuestGoals | null;
    /** Low-power mode: the Mana Ring is set, not drawn. */
    still?: boolean;
}> = ({ theme, paused, anchor, goals = null, still = false }) => {
    const layerRef = useRef<HTMLDivElement>(null);
    // The diameter again as state, for the Mana Ring's own geometry (its strokes are in px).
    const [diameter, setDiameter] = useState(0);

    useLayoutEffect(() => {
        const layer = layerRef.current;
        if (!layer || !anchor) return;
        const measure = () => {
            const a = anchor.getBoundingClientRect();
            const l = layer.getBoundingClientRect();
            const cx = a.left + a.width / 2 - l.left;
            // The ring's diameter: the screen's height. 4px keeps the outermost stroke on screen.
            const d = Math.max(0, l.height - 4);
            layer.style.setProperty('--ring-cx', `${cx}px`);
            layer.style.setProperty('--ring-d', `${d}px`);
            setDiameter(Math.round(d));
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
            {goals && goals.daily.target > 0 && (
                <ManaRing
                    theme={theme}
                    d={diameter}
                    mandate={goals.daily}
                    day={goals.today}
                    still={still}
                    hold={paused && !still}
                    className={`${place} w-[var(--ring-d)] h-[var(--ring-d)]`}
                />
            )}
        </div>
    );
};

export default React.memo(HeroRings);
