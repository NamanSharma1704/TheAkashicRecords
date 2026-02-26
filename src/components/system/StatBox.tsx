import React from 'react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';

interface StatBoxProps {
    value: string | number;
    label: string;
    icon: React.ElementType;
    color: string;
    theme: Theme;
    className?: string;
}

const StatBox: React.FC<StatBoxProps> = ({ value, label, icon: Icon, color, theme, className = "" }) => (
    <SystemFrame variant="brackets" theme={theme} className={`${theme.isDark ? 'bg-black/40' : 'bg-white/40'} ${className} transition-colors duration-700`}>
        <div className="flex flex-col items-center justify-center h-full gap-1 py-2">
            <div className="relative w-12 h-12 flex items-center justify-center mb-0">
                <div className={`absolute inset-1 border border-dashed ${theme.borderSubtle} rounded-full animate-spin-slow transition-colors duration-700`} />
                <Icon className={`w-6 h-6 ${color} transition-colors duration-700`} />
            </div>
            <div className={`text-xl font-black font-mono ${theme.headingText} tracking-wide transition-colors duration-700 leading-none`}>{value}</div>
            <div className={`text-[10px] font-mono ${theme.highlightText} font-black uppercase tracking-[0.2em] opacity-100 transition-colors duration-700 leading-none`}>{label}</div>
        </div>
    </SystemFrame>
);

export default React.memo(StatBox);
