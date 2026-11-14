import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Theme } from '../../core/types';
import { ThemeId } from '../../core/constants';
import { LINK_LOW_MS } from '../../core/appSettings';
import SystemLogo from './SystemLogo';
import ScrambleText from './ScrambleText';
import { DisconnectGlyph, SigilGlyph, VoidGlyph } from './SystemGlyphs';
import { NewGateIcon } from './CustomIcons';

/**
 * The dashboard's header: the emblem and the AKASHIC wordmark, a guest's countdown, the theme
 * and log-out tools, and CREATE_GATE from lg up (moved out of App.tsx, 2026-11-13; it was a
 * useMemo there, and is a memoised component now, on the same inputs).
 *
 * `homeEpoch` keys the wordmark, so it decodes again on the way back to Home (the Phase Shift).
 */

/** Milliseconds as M:SS. */
const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface DashboardHeaderProps {
    theme: Theme;
    currentTheme: ThemeId;
    visible: boolean;
    /** A guest sandbox's time left, in ms; null for a signed-in reader. */
    guestTimeLeft: number | null;
    onToggleTheme: () => void;
    onLogout: () => void;
    onCreateGate: () => void;
    homeEpoch: number;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ theme, currentTheme, visible, guestTimeLeft, onToggleTheme, onLogout, onCreateGate, homeEpoch }) => (
    <AnimatePresence>
        {visible && (
            <motion.header
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="fixed top-[var(--safe-top)] w-full z-40 bg-transparent h-16 px-4 flex items-center justify-between gap-2"
            >
                {/* A guest's header carries the countdown plus three glyphs, which measured
                    408px of content on a 375px phone and pushed Create off the screen. Phones
                    get a smaller emblem, a smaller wordmark (dropped entirely under 360px)
                    and tighter gaps; Log out moves to the profile panel below sm. */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col leading-none max-[359px]:hidden">
                        <div className="flex gap-2 items-baseline">
                            <span className={`font-mono text-[10px] tracking-[0.2em] ${theme.headingText} font-bold transition-colors duration-700`}>SYSTEM.ROOT</span>
                        </div>
                        <ScrambleText
                            key={homeEpoch}
                            text="AKASHIC"
                            className="font-orbitron font-mono text-base sm:text-lg tracking-[0.3em] font-bold drop-shadow-sm transition-colors duration-700"
                            decodeOnMount
                            glyphClassName="text-accent-ink"
                            animatedGradient={true}
                            /* Light used sky-500 -> cyan-500, which measured 2.08:1 on the
                               page for 18px text. The wordmark is read, so it takes the ink
                               ramp; the shimmer still travels across it. */
                            gradientColors={theme.isDark ? "from-amber-600 via-yellow-400 to-white" : theme.inkGradient}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {guestTimeLeft !== null && (
                        <div className="flex flex-col items-end leading-none sm:mr-2">
                            {/* The sandbox's time left, in the theme's ink while there is plenty
                                of it, and in the warning ink for the last 10 minutes, when it is a
                                warning. It was always the warning ink, from the cyan era, when a
                                countdown was to stay amber whatever the theme; on the violet light
                                theme that read as a stray gold (owner, 2026-11-10). On dark the two
                                inks are the same amber, so dark is unchanged. The glow is dark's
                                only: there is nothing on a pale page for an amber spill to brighten. */}
                            <span className="text-[7px] font-mono tracking-[0.2em] font-black uppercase" style={{ color: guestTimeLeft <= LINK_LOW_MS ? theme.warningInk : theme.accentInk }}>LINK_STABILITY</span>
                            <span
                                className="text-[14px] font-mono font-black"
                                style={{ color: guestTimeLeft <= LINK_LOW_MS ? theme.warningInk : theme.accentInk, filter: theme.isDark ? 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' : undefined }}
                            >
                                {formatTime(guestTimeLeft)}
                            </span>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onToggleTheme}
                        aria-label={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        className="hud hud-tool w-8 h-8 flex items-center justify-center"
                    >
                        {currentTheme === 'LIGHT' ? <SigilGlyph size={14} className="text-[#7c3aed] transition-colors duration-700" /> : <VoidGlyph size={14} className="text-amber-400 transition-colors duration-700" />}
                    </button>
                    <button
                        type="button"
                        onClick={onLogout}
                        aria-label="Log out"
                        title="Log out"
                        className="hud hud-tool hud-warn hud-muted hidden sm:flex w-8 h-8 items-center justify-center"
                    >
                        <DisconnectGlyph size={14} />
                    </button>
                    {/* Below lg, creating a gate is the tab bar's New (MobileTabBar). */}
                    <button type="button" onClick={onCreateGate} title="New gate (N)" className={`hud hud-btn hud-accent hidden lg:flex px-4 py-1.5 ${theme.highlightText} font-mono text-[10px] tracking-widest items-center gap-2 cursor-pointer`}>
                        <NewGateIcon size={12} /> CREATE_GATE
                    </button>
                </div>
            </motion.header>
        )}
    </AnimatePresence>
);

export default React.memo(DashboardHeader);
