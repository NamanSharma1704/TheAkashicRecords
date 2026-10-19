import React, { useState } from 'react';
import { getProxiedImageUrl } from '../../utils/api';

interface CoverArtProps {
    url?: string;
    title: string;
    /** The image's alt text. '' (the default) marks it decorative. */
    alt?: string;
    /** Sizing and shape of the frame. */
    className?: string;
    /** Extra classes for the <img> (hover zoom and the like). */
    imgClassName?: string;
    /** Monogram size and label density. */
    size?: 'thumb' | 'card' | 'hero';
    /** Replaces "Cover unavailable" (e.g. "Archive empty" for the empty-library placeholder). */
    label?: string;
    /** A second, quieter line under the label. */
    hint?: string;
    /** Replaces the title's monogram (the empty-library placeholder shows "+"). */
    glyph?: string;
}

/** The title's first letter or digit, for the monogram. */
const monogramOf = (title: string) => (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();

/**
 * Cover art that never shows the browser's broken-image icon.
 *
 * The plate (a dark card with the title's monogram) is always there underneath, and the image
 * fades in over it only once it has actually loaded. So a missing cover, a slow one, and a
 * dead link (the image relay can take ~13s to give up) all look like a designed card instead
 * of a broken icon with raw alt text, which is what the hero showed before.
 *
 * The plate is dark in both themes on purpose: it stands in for cover art, and covers sit on
 * dark plates throughout the app. Its text is decorative (the title is always shown nearby),
 * so the monogram is accent-tinted rather than held to contrast.
 */
const CoverArt: React.FC<CoverArtProps> = ({ url, title, alt = '', className = '', imgClassName = '', size = 'card', label, hint, glyph }) => {
    const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed');
    // A new cover starts over (React's "adjust state when a prop changes" pattern), so a
    // failure on the previous quest never carries over to the next one.
    const [seenUrl, setSeenUrl] = useState(url);
    if (url !== seenUrl) {
        setSeenUrl(url);
        setState(url ? 'loading' : 'failed');
    }
    const showImage = !!url && state !== 'failed';

    const mono = size === 'hero' ? 'text-7xl' : size === 'card' ? 'text-5xl' : 'text-sm';
    // `relative` only when the caller has not positioned the frame. Tailwind emits .relative
    // after .absolute, so "relative … absolute inset-0" resolved to relative and the plate
    // collapsed to 0px tall — every absolutely-placed plate was invisible.
    const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className);
    return (
        <div className={`${positioned ? '' : 'relative '}overflow-hidden bg-gradient-to-b from-gray-900 to-black ${className}`}>
            <div
                aria-hidden="true"
                className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center transition-opacity duration-500 ${state === 'loaded' ? 'opacity-0' : 'opacity-100'}`}
            >
                {/* Faint scanlines, the HUD's texture for "no signal". */}
                <div className="absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_4px)]" />
                <span className={`relative font-orbitron font-black leading-none text-accent opacity-40 ${mono}`}>{glyph ?? monogramOf(title)}</span>
                {size !== 'thumb' && (
                    <>
                        <span className="relative text-[9px] font-mono text-stone-300 uppercase tracking-widest">{label ?? 'Cover unavailable'}</span>
                        {hint && <span className="relative text-[9px] font-mono text-stone-400 uppercase tracking-widest">{hint}</span>}
                    </>
                )}
            </div>
            {showImage && (
                <img
                    key={url}
                    src={getProxiedImageUrl(url)}
                    alt={alt}
                    referrerPolicy="no-referrer"
                    loading={size === 'hero' ? 'eager' : 'lazy'}
                    onLoad={() => setState('loaded')}
                    onError={() => setState('failed')}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
                />
            )}
        </div>
    );
};

export default CoverArt;
