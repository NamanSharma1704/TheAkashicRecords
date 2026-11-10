import React from 'react';
import { Theme } from '../../core/types';
import { Activity } from 'lucide-react';
import { SYSTEM_LOGS } from '../../core/constants';

interface SystemConsoleProps {
    theme: Theme;
    /** Opens the keyboard shortcut list. The button only shows from lg, where keyboards are. */
    onShowShortcuts?: () => void;
}

const SystemConsole: React.FC<SystemConsoleProps> = ({ theme, onShowShortcuts }) => {
    const [sysLog, setSysLog] = React.useState(SYSTEM_LOGS[0]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setSysLog(SYSTEM_LOGS[Math.floor(Math.random() * SYSTEM_LOGS.length)]);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            // Desktop only (lg+): below lg the phone tab bar owns the bottom edge.
            className={`fixed bottom-0 left-0 w-full
  h-[28px]
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
                <Activity size={10} className={`${theme.highlightText} animate-pulse transition-colors duration-700`} />
                <span className={`${theme.highlightText} font-bold opacity-100 transition-colors duration-700`}>OMNI_LOG //</span>
                <span className={`truncate ${theme.headingText} font-bold opacity-100 transition-colors duration-700`}>{sysLog}</span>
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
