import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';

interface SystemFrameProps {
    children: React.ReactNode;
    className?: string;
    variant?: "full" | "brackets";
    theme: Theme;
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
}

const SystemFrame: React.FC<SystemFrameProps> = ({ 
    children, 
    className = "", 
    variant = "full", 
    theme,
    initial,
    animate,
    exit,
    transition
}) => {
    const borderColor = theme.id === 'LIGHT' ? 'border-sky-400' : 'border-amber-400';
    return (
        <motion.div 
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
            className={`relative p-[1px] group ${className} h-full w-full transition-all duration-700 ease-in-out`}
        >
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${borderColor} z-20 transition-colors duration-300`} />
            <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${borderColor} z-20 transition-colors duration-300`} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${borderColor} z-20 transition-colors duration-300`} />
            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${borderColor} z-20 transition-colors duration-300`} />
            <div className={`relative h-full w-full ${theme.panelBg} overflow-hidden ${variant === 'full' ? `border ${theme.borderSubtle}` : ''} transition-colors duration-700`}>
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none" />
                <motion.div className="relative z-10 h-full w-full">{children}</motion.div>
            </div>
        </motion.div>
    );
};

export default React.memo(SystemFrame);
