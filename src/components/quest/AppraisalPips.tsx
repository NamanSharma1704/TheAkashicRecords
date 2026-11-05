import React, { useState } from 'react';
import { Theme } from '../../core/types';

interface AppraisalPipsProps {
    /** The current score, 1-10, or null/undefined when unrated. */
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    theme: Theme;
    /** Names the group for screen readers. */
    label?: string;
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * The Hunter's Appraisal: the reader's own 1-10 score, as a signal meter of ten rising bars.
 * The series rank (S-E) only measures length; this says whether it was any good.
 *
 * A radio group: one tab stop, arrow keys / Home / End move the score, Delete or Backspace
 * clears it, and so does the CLEAR control. Hovering previews a score before it is set.
 */
const AppraisalPips: React.FC<AppraisalPipsProps> = ({ value, onChange, theme, label = 'Your appraisal, 1 to 10' }) => {
    const [hover, setHover] = useState<number | null>(null);
    const shown = hover ?? value ?? 0;
    const tabStop = value ?? 1;

    const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, n: number) => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onChange(null); return; }
        const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(10, n + 1)
            : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, n - 1)
            : e.key === 'Home' ? 1
            : e.key === 'End' ? 10
            : null;
        if (next === null) return;
        e.preventDefault();
        onChange(next);
        (e.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
    };

    return (
        <div className="flex items-center gap-4 flex-wrap">
            <div role="radiogroup" aria-label={label} className="flex items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
                {SCORES.map(n => (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        aria-label={`${n} of 10`}
                        tabIndex={n === tabStop ? 0 : -1}
                        onClick={() => onChange(n)}
                        onMouseEnter={() => setHover(n)}
                        onFocus={() => setHover(null)}
                        onKeyDown={(e) => onKey(e, n)}
                        className="group/pip flex items-end px-[2px] py-1 cursor-pointer"
                    >
                        <span
                            aria-hidden="true"
                            className={`block w-2.5 rounded-[1px] transition-colors duration-150 ${n <= shown ? 'bg-accent-solid' : `border border-accent-line ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`}`}
                            style={{ height: 10 + n * 1.8 }}
                        />
                    </button>
                ))}
            </div>
            <span className="font-orbitron font-bold tabular-nums text-lg leading-none text-accent-ink" aria-hidden="true">
                {value ? <>{value}<span className={`text-xs ${theme.mutedText}`}>/10</span></> : <span className={`text-[10px] font-mono tracking-[0.25em] ${theme.mutedText}`}>UNRATED</span>}
            </span>
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className={`text-[9px] font-mono tracking-widest uppercase px-2 py-1 border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} transition-colors`}
                >
                    Clear
                </button>
            ) : null}
        </div>
    );
};

export default AppraisalPips;
