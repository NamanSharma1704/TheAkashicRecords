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
        className={`w-full aspect-square md:aspect-[2/1] lg:aspect-[16/7] xl:aspect-[16/9] ${theme.isDark ? 'bg-black/40' : 'bg-white/40'} ${className} transition-colors duration-700`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
        <div className="flex flex-col items-center justify-center w-full h-full gap-1 p-2 overflow-hidden">
            <motion.div 
                className="relative w-8 h-8 sm:w-10 sm:h-10 lg:w-7 lg:h-7 xl:w-10 xl:h-10 flex items-center justify-center shrink-0"
            >
                <div className={`absolute inset-0 border border-dashed ${theme.borderSubtle} rounded-full animate-spin-slow transition-colors duration-700`} />
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 ${color} transition-colors duration-700`} />
            </motion.div>
            <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                key={value}
                className={`text-sm sm:text-base lg:text-base xl:text-3xl font-black font-mono ${theme.headingText} tracking-wide transition-colors duration-700 leading-none truncate w-full text-center`}
            >
                {value}
            </motion.div>
            <div className={`text-[8px] sm:text-[9px] lg:text-[10px] xl:text-[11px] font-mono ${theme.highlightText} font-black uppercase tracking-widest sm:tracking-[0.2em] opacity-100 transition-colors duration-700 leading-none text-center truncate w-full`}>
                {label}
            </div>
        </div>
    </SystemFrame>
);

export default React.memo(StatBox);
