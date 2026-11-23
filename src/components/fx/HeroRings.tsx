import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QuestGoals, Theme } from '../../core/types';
import SanctuaryRing from './SanctuaryRing';
import ArcaneSigil from './ArcaneSigil';
import ManaRing from './ManaRing';
import { ringInset } from './manaGeometry';

/**
 * The dashboard's ring system: one whole circle, as tall as the screen, centred on the hero.
 *
 * The rings used to live inside the hero card and were sized from its width (3.8-4x), so on a
 * desktop they ran past the top and bottom of the screen and the dashboard's scroll area
 * clipped them. They live here now, under the whole dashboard, and the circle is sized to the
 * screen: its outermost ring runs from the top edge to the bottom edge. On a tablet held
 * upright it is as wide as the screen instead, whole, and set low around the dais and title.
 *
 * Horizontally it follows the hero column, whose centre is the card's centre (the rank and
 * sequence columns either side are equal), so it tracks the card as the sidebar opens and
 * closes. Vertically it is the screen's centre: a circle that spans the full height can sit
 * nowhere else.
 *
 * Each theme keeps its own ring language: the Void's concentric SanctuaryRing, the day
 * theme's summoning sigil. Over either, the Mana Ring (ManaRing.tsx) fills with today's Divine
 * Mandate.
 *
 * Not on a phone (2026-11-15, the owner: "no point of having the rings like this on the
 * phone"). Screen-tall, its sides ran off; screen-wide, the cover, the dais and the buttons hid
 * all but two faint arcs. The mandate a phone loses here is in the Spire's quest panel and the
 * System log.
 */
const PHONE = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

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
    const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(PHONE);
        const on = () => setPhone(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    useLayoutEffect(() => {
        const layer = layerRef.current;
        if (!layer || !anchor) return;
        const measure = () => {
            const a = anchor.getBoundingClientRect();
            const l = layer.getBoundingClientRect();
            const cx = a.left + a.width / 2 - l.left;
            let d: number, cy: number;
            if (l.width < 1024 && l.width < l.height) {
                // A tablet held upright: as wide as the screen, and set low, wrapping the dais,
                // the title and the buttons, its seal just above the tab bar. Its top half
                // passes behind the cover.
                d = Math.max(0, l.width - 4);
                const bar = document.querySelector('nav[aria-label="Main"]')?.getBoundingClientRect();
                const floor = (bar && bar.height > 0 ? bar.top : l.bottom) - l.top;
                const r = d / 2 - ringInset(d);
                cy = floor - 10 - r;
            } else {
                // The screen's height. 4px keeps the outermost stroke on screen.
                d = Math.max(0, l.height - 4);
                cy = l.height / 2;
            }
            layer.style.setProperty('--ring-cx', `${cx}px`);
            layer.style.setProperty('--ring-cy', `${cy}px`);
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
    }, [anchor, phone]);

    if (phone) return null;

    // Each ring's outermost circle is a fixed share of its box (240/250 and 190/200 of the
    // radius), so the box is sized up by that share for the circle itself to be --ring-d.
    const place = 'left-[var(--ring-cx)] top-[var(--ring-cy,50%)] -translate-x-1/2 -translate-y-1/2';
    return (
        <div
            ref={layerRef}
            data-tour="mana-ring"
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
