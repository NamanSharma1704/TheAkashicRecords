import React, { useEffect } from 'react';
import { Home, LayoutTemplate, UserRound, Plus } from 'lucide-react';
import { Theme } from '../../core/types';

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

    const tabs: { id: TabId; label: string; icon: typeof Home; onClick: () => void; tour?: string }[] = [
        { id: 'HOME', label: 'Home', icon: Home, onClick: onHome },
        { id: 'SPIRE', label: 'Spire', icon: LayoutTemplate, onClick: onSpire, tour: 'spire' },
        { id: 'PROFILE', label: 'Profile', icon: UserRound, onClick: onProfile, tour: 'profile' },
    ];
    const item = 'relative flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors duration-300 active:scale-95';
    const label = 'font-mono text-[9px] font-bold tracking-[0.2em] uppercase leading-none';

    return (
        <nav
            aria-label="Main"
            aria-hidden={hidden || undefined}
            className={`lg:hidden fixed inset-x-0 bottom-0 z-[350] border-t border-accent-line backdrop-blur-md pb-[env(safe-area-inset-bottom)] transition-[transform,opacity,visibility] duration-300 ease-out ${hidden ? 'translate-y-full opacity-0 invisible' : 'translate-y-0 opacity-100 visible'}`}
            // theme-color-ok: the HUD plate, dark in both themes (amber-black / violet-black)
            style={{ background: theme.isDark ? 'rgba(10,8,2,0.94)' : 'rgba(16,8,26,0.94)' }}
        >
            <ul className="flex items-stretch max-w-xl mx-auto px-1">
                {tabs.map(({ id, label: text, icon: Icon, onClick, tour }) => {
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
                                className={`${item} ${on ? 'text-accent-plate' : 'text-white/65 hover:text-white'}`}
                            >
                                {on && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute top-0 inset-x-5 h-[2px] bg-accent-solid"
                                        style={{ boxShadow: '0 0 10px var(--accent-glow)' }}
                                    />
                                )}
                                <Icon size={20} aria-hidden="true" className={on ? 'drop-shadow-[0_0_6px_currentColor]' : ''} />
                                <span className={label}>{text}</span>
                            </button>
                        </li>
                    );
                })}
                <li className="flex flex-1">
                    <button type="button" onClick={onNew} aria-label="Create gate" className={`${item} text-accent-plate`}>
                        <span aria-hidden="true" className="hud hud-tool hud-accent [--hud-plate:var(--accent-soft)] w-7 h-7 -my-1 flex items-center justify-center">
                            <Plus size={16} />
                        </span>
                        <span aria-hidden="true" className={label}>New</span>
                    </button>
                </li>
            </ul>
        </nav>
    );
};

export default MobileTabBar;
