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
 * Light is a lit stage, not a dimmed void: the page brightens to a near-white violet-white
 * behind the content and falls to a deeper lilac at the edges, so every white panel sits in
 * the brightest zone and the darker perimeter frames it. That graded pool is what carries the
 * definition here — the work emitted light does in dark mode. An earlier pass ruled a grid over
 * a flat sheet to give panels something to separate from; the grid read as graph paper and
 * competed with the content, so the value gradient does that job now and the sheet stays clean.
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
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#ece5f6]">
            {/* The light-pool. Brightest near-white violet-white high and centre — where the hero
                and content column sit — falling to a deeper lilac at the edges. This is a graded
                value field, not a flat sheet: every panel lands in the brightest zone and reads
                forward off it, the way glow makes panels read in dark mode. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(125% 95% at 50% 24%, #fbf9ff 0%, #f3eff9 38%, #e8dff4 70%, #ddd2ec 100%)',
                }}
            />
            {/* Corner shade — a soft asymmetric vignette deepening the two far corners so the
                field has a direction of light (upper-centre) and content is framed rather than
                floating on flatness. Cool aubergine, kept low so it grounds without darkening. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(75% 75% at 106% 110%, rgba(59,29,110,0.11) 0%, transparent 46%),'
                        + 'radial-gradient(65% 65% at -6% -8%, rgba(59,29,110,0.07) 0%, transparent 44%)',
                }}
            />
            {/* Vellum grain — organic tooth in the surface (multiply), the texture the grid used
                to provide, now without any geometry. */}
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.06] mix-blend-multiply" />
        </div>
    );
};

export default GalaxyNebula;
