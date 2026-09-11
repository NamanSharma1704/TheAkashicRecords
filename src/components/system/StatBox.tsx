import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';

interface StatBoxProps {
    value: string | number;
    label: string;
    icon: React.ElementType;
    color: string;
    theme: Theme;
    className?: string;
    index?: number;
}

const StatBox: React.FC<StatBoxProps> = ({ value, label, icon: Icon, color, theme, className = "", index = 0 }) => (
    <SystemFrame
        variant="brackets"
        theme={theme}
        // The translucent fill goes through surfaceClass: set on className it landed on the
        // frame's outer wrapper, hidden behind the solid inner panel, and never showed.
        surfaceClass={theme.isDark ? 'bg-black/40' : 'bg-white/40'}
        // Height follows the content, not the width. The tile used aspect ratios up to
        // 16:9, so a quarter-width column grew with the screen — about 210px tall at 1920px.
        className={`w-full ${className} transition-colors duration-700`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
        {/* Compact horizontal tile: icon ring on the left, value over label on the right. */}
        <div className="flex items-center gap-3 px-4 py-3 w-full overflow-hidden">
            <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                <div className={`absolute inset-0 border border-dashed ${theme.borderSubtle} rounded-full animate-spin-slow transition-colors duration-700`} />
                <Icon className={`w-4 h-4 ${color} transition-colors duration-700`} />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    key={value}
                    className={`text-xl lg:text-2xl font-black font-mono ${theme.headingText} tracking-wide transition-colors duration-700 leading-none truncate origin-left`}
                >
                    {value}
                </motion.div>
                <div className={`text-[9px] lg:text-[10px] font-mono ${theme.highlightText} font-black uppercase tracking-[0.2em] transition-colors duration-700 leading-none truncate`}>
                    {label}
                </div>
            </div>
        </div>
    </SystemFrame>
);

export default React.memo(StatBox);
