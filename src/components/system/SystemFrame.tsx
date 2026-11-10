import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';
import { elevationParts, Level } from '../../core/depth';

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

/**
 * The System's panel: a plate cut at its top-left and bottom-right corners (the frame kit's
 * `.hud-panel`, styles/index.css). The kit draws the frame over the surface: a hairline, a
 * thick "ear" on each cut, brackets on the two square corners, a tab on the top edge and
 * ticks on the bottom one. `variant="brackets"` keeps the marks and drops the hairline.
 *
 * The surface is a real element inside, cut to the same shape (`.hud-clip`), because it
 * carries a Tailwind surface class and the backdrop blur. The elevation is split: the cast
 * part on the uncut wrapper, the rim on the cut surface (see `elevationParts`).
 */
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
    const surface = surfaceClass ?? theme.panelBg;
    const { rim, cast } = elevationParts(theme, level);
    return (
        <motion.div
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
            className={`hud hud-panel ${variant === 'full' ? '' : 'hud-bare'} group ${className} h-full w-full`}
            style={frosted ? { boxShadow: cast } : undefined}
        >
            <div
                className={`hud-clip relative h-full w-full ${frosted ? `${surface} backdrop-blur-md` : 'bg-transparent'} overflow-hidden transition-[background-color,box-shadow] duration-700`}
                style={frosted ? { boxShadow: rim } : undefined}
            >
                <div className={`absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none ${frosted ? 'block' : 'hidden'}`} />
                <motion.div className="relative z-10 h-full w-full">{children}</motion.div>
            </div>
        </motion.div>
    );
};

export default React.memo(SystemFrame);
