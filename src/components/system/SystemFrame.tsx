import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';
import { elevation, Level } from '../../core/depth';

interface SystemFrameProps {
    children: React.ReactNode;
    className?: string;
    variant?: "full" | "brackets";
    theme: Theme;
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
    frosted?: boolean;
    /**
     * Overrides the panel surface, e.g. "bg-black/40" for a glass panel that lets the
     * ambient background through. Defaults to the theme's solid panel colour, so every
     * existing usage is unaffected. Ignored when `frosted` is false.
     */
    surfaceClass?: string;
    /**
     * How far off the page this panel sits. Defaults to 1 — a panel resting on the
     * background. Raise it for anything that floats over other panels; `elevation`
     * renders the level in whichever vocabulary the active theme uses.
     */
    level?: Level;
}

const SystemFrame: React.FC<SystemFrameProps> = ({ 
    children, 
    className = "", 
    variant = "full", 
    theme,
    initial,
    animate,
    exit,
    transition,
    frosted = true,
    surfaceClass,
    level = 1
}) => {
    const borderColor = theme.id === 'LIGHT' ? 'border-sky-400' : 'border-amber-400';
    const surface = surfaceClass ?? theme.panelBg;
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
            <div
                className={`relative h-full w-full ${frosted ? `${surface} backdrop-blur-md` : 'bg-transparent'} overflow-hidden ${variant === 'full' ? `border ${theme.borderSubtle}` : ''} transition-[background-color,border-color,box-shadow] duration-700`}
                style={frosted ? { boxShadow: elevation(theme, level) } : undefined}
            >
                <div className={`absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none ${frosted ? 'block' : 'hidden'}`} />
                <motion.div className="relative z-10 h-full w-full">{children}</motion.div>
            </div>
        </motion.div>
    );
};

export default React.memo(SystemFrame);
