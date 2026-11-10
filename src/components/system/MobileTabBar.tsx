import React, { useEffect } from 'react';
import { Theme } from '../../core/types';
import { HunterIcon, NewGateIcon, SanctumIcon, SpireIcon } from './CustomIcons';

export type TabId = 'HOME' | 'SPIRE' | 'PROFILE';

interface MobileTabBarProps {
    theme: Theme;
    /** The view on screen: the dashboard, the Divine Spire or the Hunter Profile. */
    active: TabId;
    /** Slid away while a series page or the editor is open (they are modal moments). */
    hidden: boolean;
    onHome: () => void;
    onSpire: () => void;
    onProfile: () => void;
    onNew: () => void;
}

/**
 * PHONE TAB BAR (below lg): Home, Spire, Profile and a new gate, one thumb away.
 *
 * Below lg the sidebar stacks under the hero, so the profile was a scroll away and the
 * Spire two taps behind the compass button this replaces. The bar is a HUD plate, dark in
 * both themes like the plates it replaces, with plate inks (white/65 and the accent plate
 * ink measure well above 4.5:1 on it).
 *
 * THE HUD RAIL (2026-11-10). Drawn in the System's own hand rather than stock outline icons:
 *  - glyphs from what each tab opens (CustomIcons: the hero card on its dais, the Spire's
 *    isles, the hunter on the rank sigil's hex, the portal diamond for a new gate);
 *  - the rail along the top edge: a hairline that fades at the ends, tick strips at both ends,
 *    and a lit segment that slides to the tab on screen;
 *  - the tab on screen locks on: a reticle of corner brackets closes in around its glyph, the
 *    glyph lights and glows, and a soft accent wash rises behind it;
 *  - New is the bar's one command, so it is the one filled plate (the frame kit's hud-cmd).
 * All of it holds still under reduced motion (the global reset).
 *
 * It stays mounted for the whole signed-in session and only slides away, so `--tabbar-h`
 * (index.css; set while `data-tabbar` is on <html>) never changes under the page: the
 * dashboard's height, the hero card's width, the Spire and the profile all clear it by it.
 */
const MobileTabBar: React.FC<MobileTabBarProps> = ({ theme, active, hidden, onHome, onSpire, onProfile, onNew }) => {
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-tabbar', '');
        return () => root.removeAttribute('data-tabbar');
    }, []);

    const tabs: { id: TabId; label: string; Glyph: typeof SanctumIcon; onClick: () => void; tour?: string }[] = [
        { id: 'HOME', label: 'Home', Glyph: SanctumIcon, onClick: onHome },
        { id: 'SPIRE', label: 'Spire', Glyph: SpireIcon, onClick: onSpire, tour: 'spire' },
        { id: 'PROFILE', label: 'Profile', Glyph: HunterIcon, onClick: onProfile, tour: 'profile' },
    ];
    const at = Math.max(0, tabs.findIndex((t) => t.id === active));
    const item = 'relative flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors duration-300 active:scale-95';
    const label = 'font-mono text-[9px] font-bold tracking-[0.2em] uppercase leading-none';

    return (
        <nav
            aria-label="Main"
            aria-hidden={hidden || undefined}
            className={`lg:hidden fixed inset-x-0 bottom-0 z-[350] backdrop-blur-md pb-[env(safe-area-inset-bottom)] transition-[transform,opacity,visibility] duration-300 ease-out ${hidden ? 'translate-y-full opacity-0 invisible' : 'translate-y-0 opacity-100 visible'}`}
            // theme-color-ok: the HUD plate, dark in both themes (amber-black / violet-black)
            style={{ background: theme.isDark ? 'rgba(10,8,2,0.94)' : 'rgba(16,8,26,0.94)' }}
        >
            {/* The rail: a hairline fading at the ends, with a strip of ticks at each end. */}
            <span aria-hidden="true" className="tab-rail-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
            <span aria-hidden="true" className="tab-rail-ticks pointer-events-none absolute left-2 top-[3px] w-[31px] h-[2px]" />
            <span aria-hidden="true" className="tab-rail-ticks pointer-events-none absolute right-2 top-[3px] w-[31px] h-[2px]" />
            {/* Faint scanlines, the HUD's texture. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_4px)]" />

            <ul className="relative flex items-stretch max-w-xl mx-auto px-1">
                {/* The lit segment: one quarter of the row (four slots), slid to the tab on screen. */}
                <li aria-hidden="true" className="tab-rail-indicator pointer-events-none absolute top-0 left-1 h-[2px] w-[calc((100%-0.5rem)/4)]" style={{ transform: `translateX(${at * 100}%)` }}>
                    <span className="tab-rail-segment absolute inset-y-0 left-1/2 -translate-x-1/2 w-[46%]" />
                </li>
                {tabs.map(({ id, label: text, Glyph, onClick, tour }) => {
                    const on = active === id;
                    return (
                        <li key={id} className="flex flex-1">
                            <button
                                type="button"
                                onClick={onClick}
                                data-tour={tour}
                                // The tour points here rather than at the sidebar's copy (SystemTour).
                                data-tour-prefer={tour ? '' : undefined}
                                aria-current={on ? 'page' : undefined}
                                className={`tab-slot ${item} ${on ? 'text-accent-plate' : 'text-white/65 hover:text-white'}`}
                            >
                                <span aria-hidden="true" className="tab-wash pointer-events-none absolute inset-0" />
                                <span aria-hidden="true" className="relative w-10 h-[30px] flex items-center justify-center">
                                    <span className="tab-reticle absolute inset-0" />
                                    <Glyph size={22} active={on} className="tab-glyph relative" />
                                </span>
                                <span className={`relative ${label}`}>{text}</span>
                            </button>
                        </li>
                    );
                })}
                <li className="flex flex-1">
                    <button type="button" onClick={onNew} aria-label="Create gate" className={`${item} text-accent-plate`}>
                        <span aria-hidden="true" className="hud hud-cmd [--hud-c:7px] w-10 h-[30px] flex items-center justify-center">
                            <NewGateIcon size={19} />
                        </span>
                        <span aria-hidden="true" className={label}>New</span>
                    </button>
                </li>
            </ul>
        </nav>
    );
};

export default MobileTabBar;
