import React from 'react';
import { Theme } from '../../core/types';

/**
 * The page field — the deepest surface in the app, and the only thing painting it.
 *
 * This is `fixed inset-0`, so whatever it paints *is* the background: it covers the
 * `appBg` token underneath it completely. The light branch used to repaint the page
 * near-white regardless of the token, which is why panels had nothing to separate from.
 * Both branches now sit at their theme's `appBg` and gradient only a few levels either
 * side of it.
 *
 * Light is a drafting table, not a dimmed void: a cool grid at very low alpha, over
 * which white panels rise on a real shadow like paper. That grid is what carries the
 * richness that emitted light carries in dark mode — flat near-white reads as
 * unfinished, where flat near-black reads as deliberate.
 */
const GalaxyNebula: React.FC<{ theme: Theme }> = ({ theme }) => {
    if (theme.isDark) {
        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020202]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#050510] via-[#020202] to-[#0a0510]" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>
        );
    }
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#e9eef5]">
            {/* Light direction, but stingy with it at the top. The page is the floor of the
                whole value range — every white panel separates from it and every pale bloom
                needs room above it — so the top only goes four levels over the token while
                the bottom drops ten under. An earlier pass ran the top up to #eef2f8 and
                handed that headroom straight back. */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#edf1f7] via-[#e9eef5] to-[#e2eaf3]" />
            {/* Drafting grid. 32px minor over a 160px major, both slate rather than black
                so they read as ruling on a cool sheet rather than dirt on a white one.
                Kept under 0.05 alpha: at this size anything stronger moires while scrolling. */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(15,23,42,0.075) 0 1px, transparent 1px 160px),'
                        + 'repeating-linear-gradient(90deg, rgba(15,23,42,0.075) 0 1px, transparent 1px 160px),'
                        + 'repeating-linear-gradient(0deg, rgba(15,23,42,0.040) 0 1px, transparent 1px 32px),'
                        + 'repeating-linear-gradient(90deg, rgba(15,23,42,0.040) 0 1px, transparent 1px 32px)',
                }}
            />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-multiply" />
        </div>
    );
};

export default GalaxyNebula;
