import React, { useEffect, useRef, useState } from 'react';
import TranscendentCrest from './TranscendentCrest';
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
 *
 * A 10 is the Transcendent Appraisal: the readout becomes its crest (TranscendentCrest), and
 * the moment it is GIVEN the crest locks on. Opening a series already at 10 shows it still.
 */
const AppraisalPips: React.FC<AppraisalPipsProps> = ({ value, onChange, theme, label = 'Your appraisal, 1 to 10' }) => {
    const [hover, setHover] = useState<number | null>(null);
    const shown = hover ?? value ?? 0;
    const tabStop = value ?? 1;

    // Counts the 10s GIVEN here; each locks the crest on again (a fresh key remounts it). Only
    // a 10 picked on these pips counts: the editor loads a record's saved score just after it
    // opens, and that arriving 10 is no news. The pick sets `gave10`; the stamp waits for the
    // value to land (on the series page that is after the save).
    const [stamps, setStamps] = useState(0);
    const lastValue = useRef(value);
    const gave10 = useRef(false);
    useEffect(() => {
        if (value === 10 && lastValue.current !== 10 && gave10.current) setStamps((n) => n + 1);
        if (value !== lastValue.current) gave10.current = false;
        lastValue.current = value;
    }, [value]);
    const pick = (n: number | null) => {
        if (n === 10 && value !== 10) gave10.current = true;
        onChange(n);
    };

    const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, n: number) => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); pick(null); return; }
        const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(10, n + 1)
            : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, n - 1)
            : e.key === 'Home' ? 1
            : e.key === 'End' ? 10
            : null;
        if (next === null) return;
        e.preventDefault();
        pick(next);
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
                        onClick={() => pick(n)}
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
            {value === 10 ? (
                <span className="flex items-center gap-2.5" aria-hidden="true">
                    <TranscendentCrest key={stamps} isDark={theme.isDark} size={38} lock={stamps > 0} />
                    <span className="flex flex-col gap-1 leading-none">
                        <span className="font-orbitron font-bold tabular-nums text-lg text-accent-ink">10<span className={`text-xs ${theme.mutedText}`}>/10</span></span>
                        <span className="font-mono text-[9px] font-bold tracking-[0.25em] uppercase text-accent-ink">Transcendent appraisal</span>
                    </span>
                </span>
            ) : (
                <span className="font-orbitron font-bold tabular-nums text-lg leading-none text-accent-ink" aria-hidden="true">
                    {value ? <>{value}<span className={`text-xs ${theme.mutedText}`}>/10</span></> : <span className={`text-[10px] font-mono tracking-[0.25em] ${theme.mutedText}`}>UNRATED</span>}
                </span>
            )}
            {value ? (
                <button
                    type="button"
                    onClick={() => pick(null)}
                    className={`hud hud-btn [--hud-c:4px] text-[9px] font-mono tracking-widest uppercase px-2 py-1 ${theme.mutedText} hover:${theme.headingText}`}
                >
                    Clear
                </button>
            ) : null}
        </div>
    );
};

export default AppraisalPips;
