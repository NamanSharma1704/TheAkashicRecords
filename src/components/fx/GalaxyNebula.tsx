import React from 'react';
import { Theme } from '../../core/types';

/**
 * The page field — the deepest surface in the app, and the only thing painting it.
 *
 * This is `fixed inset-0`, so whatever it paints *is* the background. Both themes are now dark
 * cosmoses that content GLOWS against — the amber Void on black, the amethyst Void on aubergine —
 * because a bright field reads as a surface and can never read as space. Each is a near-night
 * ground with a faint nebula wash a few levels either side of it; the glowing starfield and
 * blooms are added over the top by their atmosphere layer (OmniscientField / IlluminatedCodex).
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
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#e9e2f6]">
            {/* A RADIANT AMETHYST SKY, not a flat page. The immersion on a bright ground comes from
                saturation and depth, not darkness: a luminous core, rich colour clouds and a framed
                edge give it the body a pale wall never had. */}

            {/* The radiant core — a luminous source high-centre the sky opens from, keeping the
                content band bright. */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(72% 56% at 50% 12%, #ffffff 0%, #f4eeff 30%, rgba(244,238,255,0) 66%)',
                }}
            />
            {/* Rich nebula clouds — SATURATED violet / magenta / indigo colour volumes at depth,
                deeper in chroma than the ground so they read as luminous cloud rather than a wash.
                This saturation is what my earlier pale attempts were missing. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(52% 48% at 20% 30%, rgba(139,92,246,0.42) 0%, transparent 64%),'
                        + 'radial-gradient(50% 46% at 84% 66%, rgba(214,120,224,0.34) 0%, transparent 66%),'
                        + 'radial-gradient(48% 44% at 68% 22%, rgba(124,58,237,0.30) 0%, transparent 66%),'
                        + 'radial-gradient(64% 54% at 42% 100%, rgba(99,102,241,0.34) 0%, transparent 64%),'
                        + 'radial-gradient(50% 46% at 8% 82%, rgba(168,85,247,0.30) 0%, transparent 66%)',
                    filter: 'blur(24px)',
                }}
            />
            {/* Aerial-perspective frame — the far edges deepen to a richer amethyst so the sky has a
                surround and the content sits in a luminous well rather than on a flat sheet. */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(115% 100% at 50% 42%, transparent 46%, rgba(76,29,149,0.30) 100%)',
                }}
            />
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-multiply" />
        </div>
    );
};

export default GalaxyNebula;
