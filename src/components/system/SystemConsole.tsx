import React from 'react';
import { Theme } from '../../core/types';
import { Activity } from 'lucide-react';
import { SYSTEM_LOGS } from '../../core/constants';

interface SystemConsoleProps {
    theme: Theme;
}

const SystemConsole: React.FC<SystemConsoleProps> = ({ theme }) => {
    const [sysLog, setSysLog] = React.useState(SYSTEM_LOGS[0]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setSysLog(SYSTEM_LOGS[Math.floor(Math.random() * SYSTEM_LOGS.length)]);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className={`fixed bottom-0 left-0 w-full
  h-[28px]
  backdrop-blur-[2px]
  flex items-center px-4 font-mono text-[9px]
  ${theme.isDark
      ? 'bg-gradient-to-t from-black/60 via-black/20 to-transparent'
      : 'bg-transparent'
  }
  z-[70] transition-colors duration-700
  pb-[env(safe-area-inset-bottom)]`}
        >
            <div className="flex items-center gap-3 w-full max-w-[1920px] mx-auto">
                <Activity size={10} className={`${theme.isDark ? theme.highlightText : 'text-[#0e7490]'} animate-pulse transition-colors duration-700`} />
                <span className={`${theme.isDark ? theme.highlightText : 'text-[#0e7490]'} font-bold opacity-100 transition-colors duration-700`}>OMNI_LOG //</span>
                <span className={`truncate ${theme.isDark ? theme.headingText : 'text-black'} font-bold opacity-100 transition-colors duration-700`}>{sysLog.msg}</span>
                <span className={`hidden sm:block ml-auto ${theme.isDark ? theme.highlightText : 'text-[#0e7490]'} font-bold opacity-100 tracking-widest`}>V.2.1 {theme.id === 'LIGHT' ? 'CELESTIAL.OS' : 'MONARCH.OS'}</span>
            </div>
        </div>
    );
};

export default SystemConsole;
