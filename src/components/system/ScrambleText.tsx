import React, { useEffect, useRef, useState } from 'react';

/**
 * A heading the System DECODES: its letters show as glyphs and resolve, left to right, into
 * the words. Plays when the text changes, and on first showing with `decodeOnMount`.
 *
 * Three rules keep it from being a nuisance:
 *   - Glyphs only from symbol blocks every phone font covers, none with an emoji form. Runes
 *     (Elder Futhark, Gothic) render as empty boxes on many phones.
 *   - Nothing moves. An unresolved letter keeps its own box (the letter itself, invisible) and
 *     the glyph floats over it, so the decoding text has exactly the final text's width and
 *     line breaks. At rest it is the plain text, the DOM it always was.
 *   - Screen readers get the words: while decoding, the glyphs are hidden from them and the
 *     final text sits beside them in an sr-only span.
 *
 * Under a second however long the text (max ~0.9 s), and not at all under reduced motion. For
 * short headings, not body text.
 */

// Every one is in the BMP, so indexing by position is safe.
const GLYPHS = ['✦', '✧', '✶', '❖', '◈', '◇', '◆', '⬡', '⬢', '△', '▽', '◎', '※'];
const TICK_MS = 50;
const HOLD = 0.15;   // share of the run spent all glyphs, before letters start resolving

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ScrambleTextProps {
    text: string;
    className?: string;
    /** Decode when first shown too, not only when the text changes. */
    decodeOnMount?: boolean;
    /** Classes for the glyphs. Gradient text paints its letters transparent (bg-clip-text),
     *  and the glyphs would inherit that and vanish, so it passes an ink here. */
    glyphClassName?: string;
    animatedGradient?: boolean;
    gradientColors?: string;
}

const ScrambleText: React.FC<ScrambleTextProps> = ({
    text,
    className = '',
    decodeOnMount = false,
    glyphClassName = '',
    animatedGradient = false,
    gradientColors,
}) => {
    // Characters resolved so far; null at rest (the plain text). Starting at 0 when decoding on
    // mount, so the first paint is already glyphs rather than a flash of the words.
    const [revealed, setRevealed] = useState<number | null>(() => (decodeOnMount && !prefersReducedMotion() ? 0 : null));
    const [, setNoise] = useState(0);
    // The text it mounted with, so a re-run of the effect (React's dev double-invoke) is not
    // mistaken for a change.
    const initialText = useRef(text);
    const changed = useRef(false);

    useEffect(() => {
        if (text !== initialText.current) changed.current = true;
        if (!decodeOnMount && !changed.current) return;
        if (prefersReducedMotion()) { setRevealed(null); return; }

        const total = Array.from(text).length;
        const duration = Math.min(900, 300 + total * 30);
        const start = performance.now();
        let last = 0;
        let raf = 0;
        setRevealed(0);
        const step = (now: number) => {
            const p = (now - start) / duration;
            if (p >= 1) { setRevealed(null); return; }
            if (now - last >= TICK_MS) {
                last = now;
                setRevealed(Math.floor(Math.max(0, (p - HOLD) / (1 - HOLD)) * total));
                setNoise((n) => n + 1);
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
        // Restarts only for a new text: the props that shape it are fixed per call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const gradientClass = animatedGradient ? `bg-gradient-to-r ${gradientColors} bg-[200%_auto] animate-text-shimmer bg-clip-text text-transparent` : '';
    const base = `${className} ${gradientClass} cursor-default break-words`;
    if (revealed === null) return <span className={base}>{text}</span>;

    // Word by word, so a line can only break where the final text breaks; within a word the
    // resolved letters are plain text (they keep the gradient) and the rest are glyph cells.
    let at = 0;
    return (
        <span className={base}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {text.split(/(\s+)/).map((part, wi) => {
                    const chars = Array.from(part);
                    const from = at;
                    at += chars.length;
                    if (!part || /^\s+$/.test(part)) return part;
                    const done = Math.max(0, Math.min(chars.length, revealed - from));
                    return (
                        <span key={wi} className="whitespace-nowrap">
                            {chars.slice(0, done).join('')}
                            {chars.slice(done).map((c, k) => (
                                <span key={k} className="relative inline-block">
                                    <span className="invisible">{c}</span>
                                    <span className={`absolute inset-0 flex items-center justify-center text-[0.8em] ${glyphClassName}`}>
                                        {GLYPHS[Math.floor(Math.random() * GLYPHS.length)]}
                                    </span>
                                </span>
                            ))}
                        </span>
                    );
                })}
            </span>
        </span>
    );
};

export default React.memo(ScrambleText);
