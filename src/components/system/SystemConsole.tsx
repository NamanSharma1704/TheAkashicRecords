import React from 'react';
import { Theme } from '../../core/types';
import { PulseGlyph } from './SystemGlyphs';
import ScrambleText from './ScrambleText';

interface SystemConsoleProps {
    theme: Theme;
    /** Opens the keyboard shortcut list. The button only shows from lg, where keyboards are. */
    onShowShortcuts?: () => void;
    /** OMNI_LOG's status lines, built by App from the reader's own state (THE LIVING SYSTEM
     *  LOG): today's mandate, the weekly decree, the streak, the next rank, new chapters, the
     *  last event. */
    lines?: string[];
}

const BOOT_LINE = 'System initializing...';
const BOOT_MS = 3000;
const CYCLE_MS = 6000;

const SystemConsole: React.FC<SystemConsoleProps> = ({ theme, onShowShortcuts, lines = [] }) => {
    // "System initializing..." for the first moments only; then the real lines, in turn, each
    // decoding in as it arrives.
    const [booted, setBooted] = React.useState(false);
    const [index, setIndex] = React.useState(0);
    React.useEffect(() => {
        const t = window.setTimeout(() => setBooted(true), BOOT_MS);
        return () => window.clearTimeout(t);
    }, []);
    React.useEffect(() => {
        if (!booted || lines.length < 2) return;
        const interval = window.setInterval(() => setIndex((i) => i + 1), CYCLE_MS);
        return () => window.clearInterval(interval);
    }, [booted, lines.length]);
    const sysLog = !booted ? BOOT_LINE : lines.length ? lines[index % lines.length] : 'Awaiting directive.';

    return (
        <div
            // Desktop only (lg+): below lg the phone tab bar owns the bottom edge.
            className={`fixed bottom-0 left-0 w-full
  h-[calc(28px+env(safe-area-inset-bottom,0px))]
  backdrop-blur-[2px]
  hidden lg:flex items-center px-4 font-mono text-[9px]
  ${theme.isDark
      ? 'bg-gradient-to-t from-black/60 via-black/20 to-transparent'
      : 'bg-transparent'
  }
  z-[70] transition-colors duration-700
  pb-[env(safe-area-inset-bottom)]`}
        >
            <div className="flex items-center gap-3 w-full max-w-[1920px] mx-auto">
                <PulseGlyph size={10} className={`${theme.highlightText} animate-pulse transition-colors duration-700`} />
                <span className={`${theme.highlightText} font-bold opacity-100 transition-colors duration-700`}>OMNI_LOG //</span>
                <span className={`truncate ${theme.headingText} font-bold opacity-100 transition-colors duration-700`}>
                    <ScrambleText text={sysLog} maxMs={600} glyphClassName="text-accent-ink" />
                </span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                    {onShowShortcuts && (
                        <button
                            type="button"
                            onClick={onShowShortcuts}
                            title="Keyboard shortcuts (?)"
                            className={`hud hud-btn [--hud-c:5px] hidden lg:inline-flex h-6 items-center gap-1.5 px-2 ${theme.highlightText} font-bold tracking-widest`}
                        >
                            <span aria-hidden="true">[?]</span> KEYS
                        </button>
                    )}
                </div>
                <span className={`hidden sm:block ${theme.highlightText} font-bold opacity-100 tracking-widest`}>V.2.1 {theme.id === 'LIGHT' ? 'CELESTIAL.OS' : 'MONARCH.OS'}</span>
            </div>
        </div>
    );
};

export default SystemConsole;
