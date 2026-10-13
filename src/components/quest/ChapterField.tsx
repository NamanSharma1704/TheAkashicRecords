import React, { useEffect, useRef, useState } from 'react';

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
}

/**
 * A chapter number you can tap to type into.
 *
 * At rest it is a button that looks exactly like the number it replaces, with a dashed rule
 * on hover/focus as the only hint that it is live. Activating it swaps in an input of the
 * same type size, pre-filled and selected, with the numeric keypad on phones. Enter or
 * leaving the field commits; Escape restores the number untouched.
 */
const ChapterField: React.FC<ChapterFieldProps> = ({
    value, pad = 0, disabled = false, label, onCommit, className, displayClassName = '', inkColor, minChars = 3,
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Escape and Enter both end editing, and the blur that follows must not commit again.
    const settled = useRef(false);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const begin = () => {
        if (disabled) return;
        settled.current = false;
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

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={begin}
            disabled={disabled}
            aria-label={label}
            title={disabled ? undefined : 'Set chapter'}
            className={`${className} ${displayClassName} cursor-text disabled:cursor-default underline-offset-[0.18em] decoration-dashed decoration-2 enabled:hover:underline enabled:focus-visible:underline`}
            style={{ textDecorationColor: inkColor }}
        >
            {pad > 0 ? String(value).padStart(pad, '0') : value}
        </button>
    );
};

export default ChapterField;
