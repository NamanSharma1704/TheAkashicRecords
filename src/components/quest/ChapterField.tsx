import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface ChapterFieldProps {
    /** The chapter on record. */
    value: number;
    /** Zero-pad the resting display to this many digits ("001"). The input never pads. */
    pad?: number;
    disabled?: boolean;
    /** Accessible name for the resting button. */
    label: string;
    /** Receives a whole, non-negative chapter. Clamping and auto-raise are the caller's. */
    onCommit: (chapter: number) => void;
    /** Typography shared by the resting number and the input, so the swap does not jump. */
    className: string;
    /** Extra classes for the resting number only (e.g. gradient text). */
    displayClassName?: string;
    /** Ink for the typed digits and caret; gradient text cannot colour an input's caret. */
    inkColor: string;
    /** Minimum input width in characters. */
    minChars?: number;
    /**
     * Whose chapter this is (the quest id). The number rolls only when the SAME series moves:
     * switching to another series, or the library loading, changes the number without a roll.
     */
    subject?: string;
    /** Where the recoil scales from: the number's anchored edge. */
    origin?: 'left' | 'center';
}

/** The full roll, and the recoil that goes with it (styles/index.css, `.chapter-roll-*`). */
const ROLL_MS = 160;
/** Changes closer together than this are a run (a held stepper, a held arrow key). */
const RUN_MS = 170;
/** ...and closer than this are too fast to roll at all: the digits just count. */
const COUNT_MS = 95;
/** Each changed digit to the left starts a little later, like an odometer carrying. */
const CARRY_MS = 26;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Roll {
    id: number;
    from: string;
    to: string;
    /** 1 reading on (the new digit rises from below), -1 stepping back (it drops from above). */
    dir: 1 | -1;
    ms: number;
    recoil: boolean;
}

/**
 * A chapter number you can tap to type into.
 *
 * At rest it is a button that looks exactly like the number it replaces, with a dashed rule
 * on hover/focus as the only hint that it is live. Activating it swaps in an input of the
 * same type size, pre-filled and selected, with the numeric keypad on phones. Enter or
 * leaving the field commits; Escape restores the number untouched.
 *
 * THE SLOT ROLL. When the chapter moves, the digits that changed roll to their new value, the
 * way a mechanical counter's wheels do: up for a chapter read, down for a step back, each digit
 * to the left a beat after the one beside it (139 to 140 turns the 9 and then the 3). The
 * number gives a small recoil (1.06) as it lands. Nothing moves in the layout: each digit keeps
 * its own fixed-width cell (the number is tabular), clipped top and bottom so the wheel's other
 * digits stay hidden, and at rest the button is the plain text again. A held stepper speeds up
 * to 45 ms a step, faster than a roll; there the rolls shorten with the gap, and below 95 ms
 * the digits simply count. Not under reduced motion.
 */
const ChapterField: React.FC<ChapterFieldProps> = ({
    value, pad = 0, disabled = false, label, onCommit, className, displayClassName = '', inkColor, minChars = 3,
    subject, origin = 'left',
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Escape and Enter both end editing, and the blur that follows must not commit again.
    const settled = useRef(false);

    const format = (n: number) => (pad > 0 ? String(n).padStart(pad, '0') : String(n));

    // The roll in progress, if any. Set in a layout effect, so the first frame of a new
    // chapter is already the roll's first frame, never a flash of the plain new number.
    const [roll, setRoll] = useState<Roll | null>(null);
    const last = useRef({ value, subject, at: 0 });
    const rollId = useRef(0);
    useLayoutEffect(() => {
        const prev = last.current;
        const now = performance.now();
        last.current = { value, subject, at: now };
        if (prev.value === value) return;
        const gap = now - prev.at;
        if (prev.subject !== subject || prefersReducedMotion() || gap < COUNT_MS) {
            setRoll(null);
            return;
        }
        const run = gap < RUN_MS;
        setRoll({
            id: ++rollId.current,
            from: format(prev.value),
            to: format(value),
            dir: value > prev.value ? 1 : -1,
            // In a run each roll must end before the next step lands.
            ms: run ? Math.round(gap * 0.85) : ROLL_MS,
            recoil: !run,
        });
        // `format` reads only `pad`, fixed per call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, subject]);

    // Back to the plain text once the last digit has landed.
    useEffect(() => {
        if (!roll) return;
        const carried = Math.max(0, roll.to.length - 1) * CARRY_MS;
        const t = window.setTimeout(() => setRoll(null), Math.max(roll.ms + carried, roll.recoil ? 180 : 0) + 40);
        return () => window.clearTimeout(t);
    }, [roll]);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const begin = () => {
        if (disabled) return;
        settled.current = false;
        setRoll(null);
        setDraft(String(value));
        setEditing(true);
    };

    const finish = (commit: boolean, refocus: boolean) => {
        if (settled.current) return;
        settled.current = true;
        setEditing(false);
        if (commit) {
            const n = parseInt(draft, 10);
            if (Number.isFinite(n) && n >= 0) onCommit(n);
        }
        // Enter/Escape: hand focus back to the number so a keyboard user stays where they
        // were. Not after a blur: focus has already gone wherever you clicked, and pulling it
        // back would steal it.
        if (refocus) requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="off"
                aria-label="Set current chapter"
                value={draft}
                maxLength={5}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); finish(true, true); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false, true); }
                }}
                onBlur={() => finish(true, false)}
                className={`${className} bg-transparent outline-none border-b-2 border-dashed p-0 m-0`}
                style={{
                    width: `${Math.max(minChars, draft.length) + 0.6}ch`,
                    color: inkColor,
                    caretColor: inkColor,
                    borderColor: inkColor,
                }}
            />
        );
    }

    // While rolling, every digit is its own cell and carries the ink itself (gradient text
    // included: a vertical gradient over a one-line cell is the same gradient the whole number
    // shows at rest). The button keeps only the typography.
    const shown = roll && roll.to === format(value) ? roll : null;
    let digits: React.ReactNode = format(value);
    if (shown) {
        const { to, from, dir, ms } = shown;
        const offset = to.length - from.length;
        let rank = 0;
        const cells = Array.from(to).map((ch, i) => ({ ch, was: from[i - offset] ?? '' }));
        // Delays run right to left over the digits that changed.
        const delays = new Array<number>(cells.length).fill(0);
        for (let i = cells.length - 1; i >= 0; i--) {
            if (cells[i].ch !== cells[i].was) delays[i] = (rank++) * CARRY_MS;
        }
        digits = (
            <span
                key={shown.id}
                aria-hidden="true"
                className={`inline-block ${shown.recoil ? 'chapter-recoil' : ''}`}
                style={{ transformOrigin: origin === 'left' ? 'left center' : 'center' }}
            >
                {cells.map(({ ch, was }, i) => {
                    const turned = ch !== was;
                    const timing = { '--roll-dir': dir, '--roll-ms': `${ms}ms`, '--roll-delay': `${delays[i]}ms` } as React.CSSProperties;
                    return (
                        <span key={i} className="chapter-roll-cell">
                            {turned && was && <span className={`chapter-roll-out ${displayClassName}`} style={timing}>{was}</span>}
                            <span className={`inline-block ${turned ? 'chapter-roll-in' : ''} ${displayClassName}`} style={turned ? timing : undefined}>{ch}</span>
                        </span>
                    );
                })}
            </span>
        );
    }

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={begin}
            disabled={disabled}
            aria-label={label}
            title={disabled ? undefined : 'Set chapter'}
            className={`${className} ${shown ? '' : displayClassName} cursor-text disabled:cursor-default underline-offset-[0.18em] decoration-dashed decoration-2 enabled:hover:underline enabled:focus-visible:underline`}
            style={{ textDecorationColor: inkColor }}
        >
            {digits}
        </button>
    );
};

export default ChapterField;
