import React, { useEffect, useRef, useState } from 'react';
import { QuestGoals } from '../../core/types';
import { dailyObjective, GOAL_MAX } from '../../core/constants';

interface QuestPanelProps {
    theme: any;
    goals: QuestGoals;
    /** Save new targets. Resolves to an error message, or null once saved. */
    onSave: (daily: { kind: 'SERIES' | 'CHAPTERS'; target: number }, weeklyTarget: number) => Promise<string | null>;
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
/** 'YYYY-MM-DD' as a weekday name ("Sun"), read as a calendar day with no zone shift. */
const weekdayOf = (day: string) => weekdayFmt.format(new Date(`${day}T00:00:00Z`));

/** One quest: its name, state, objective, count and bar. The bar markup matches the HUD's. */
const QuestRow: React.FC<{ theme: any; name: string; when: string; objective: string; progress: number; target: number }> = ({ theme, name, when, objective, progress, target }) => {
    const done = progress >= target;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-2">
                <div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[clamp(8px,0.9vw,10px)] tracking-widest font-bold`}>
                    <span aria-hidden="true">⚡</span> {name}
                </div>
                <span className={`text-[clamp(7px,0.8vw,9px)] font-mono ${theme.mutedText} whitespace-nowrap`}>{done ? '✓ CLEARED' : when}</span>
            </div>
            <div className="flex justify-between items-end gap-2">
                <span className={`text-[clamp(10px,1vw,12px)] font-black italic ${theme.headingText} tracking-wide uppercase`}>{objective}</span>
                <span className={`${theme.highlightText} font-mono font-bold text-[clamp(12px,1.2vw,16px)] tabular-nums`}>
                    {Math.min(progress, target).toLocaleString()}
                    <span className={`${theme.mutedText} text-[clamp(9px,0.9vw,11px)]`}>/{target.toLocaleString()}</span>
                </span>
            </div>
            <div className={`h-1 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/10'} relative overflow-hidden`} aria-hidden="true">
                <div className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700`} style={{ width: `${Math.min(100, (progress / target) * 100)}%`, color: theme.id === 'LIGHT' ? '#7c3aed' : '#fbbf24' }} />
            </div>
        </div>
    );
};

/**
 * QUESTS: the daily DIVINE_MANDATE and the WEEKLY_DECREE, with their targets adjustable here.
 * The daily one used to be fixed at "Absorb 5 stories" (five different series today); it can
 * now count chapters instead, at any target, and a weekly chapter quest runs Monday to Sunday.
 */
const QuestPanel: React.FC<QuestPanelProps> = ({ theme, goals, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [kind, setKind] = useState(goals.daily.kind);
    const [dailyTarget, setDailyTarget] = useState(String(goals.daily.target));
    const [weeklyTarget, setWeeklyTarget] = useState(String(goals.weekly.target));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Opening moves focus into the form; closing hands it back to "Adjust quests", which the
    // form replaced, so keyboard focus never drops to the page.
    const adjustRef = useRef<HTMLButtonElement>(null);
    const firstFieldRef = useRef<HTMLSelectElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const wasEditing = useRef(false);
    useEffect(() => {
        if (editing) {
            // The whole form into view, Save included: the HUD column scrolls on short screens.
            formRef.current?.scrollIntoView({ block: 'nearest' });
            firstFieldRef.current?.focus({ preventScroll: true });
        } else if (wasEditing.current) adjustRef.current?.focus();
        wasEditing.current = editing;
    }, [editing]);

    const open = () => {
        setKind(goals.daily.kind);
        setDailyTarget(String(goals.daily.target));
        setWeeklyTarget(String(goals.weekly.target));
        setError(null);
        setEditing(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const daily = Number(dailyTarget);
        const weekly = Number(weeklyTarget);
        const dailyMax = GOAL_MAX[kind];
        if (!Number.isInteger(daily) || daily < 1 || daily > dailyMax) { setError(`Daily target: a whole number from 1 to ${dailyMax}.`); return; }
        if (!Number.isInteger(weekly) || weekly < 1 || weekly > GOAL_MAX.WEEKLY) { setError(`Weekly target: a whole number from 1 to ${GOAL_MAX.WEEKLY}.`); return; }
        setSaving(true);
        const failure = await onSave({ kind, target: daily }, weekly);
        setSaving(false);
        if (failure) setError(failure);
        else setEditing(false);
    };

    const label = `block text-[clamp(7px,0.8vw,9px)] ${theme.mutedText} font-mono tracking-widest uppercase mb-1`;
    const field = `w-full h-8 px-2 bg-transparent border ${theme.borderSubtle} font-mono text-[11px] ${theme.headingText} focus:outline-none focus-visible:border-current`;
    const buttonText = `h-7 px-2 font-mono text-[clamp(8px,0.85vw,10px)] font-bold tracking-widest uppercase ${theme.highlightText}`;
    const textButton = `hud hud-ghost ${buttonText}`;

    return (
        <div className={`pt-3 border-t ${theme.isDark ? 'border-white/10' : 'border-black/10'} space-y-3`}>
            <QuestRow
                theme={theme}
                name="DIVINE_MANDATE"
                when="TODAY"
                objective={dailyObjective(goals.daily.kind, goals.daily.target)}
                progress={goals.daily.progress}
                target={goals.daily.target}
            />
            <QuestRow
                theme={theme}
                name="WEEKLY_DECREE"
                when={`ENDS ${weekdayOf(goals.weekly.endsOn).toUpperCase()}`}
                objective={`Absorb ${goals.weekly.target.toLocaleString()} chapters`}
                progress={goals.weekly.progress}
                target={goals.weekly.target}
            />

            {editing ? (
                // color-scheme: the native select list and number spinners follow the theme.
                // Escape closes the form only: stopped here, it never reaches the Spire's own
                // Escape (a document listener), which would close the whole Spire.
                <form
                    ref={formRef}
                    onSubmit={submit}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }}
                    className="space-y-2 pt-1"
                    style={{ colorScheme: theme.isDark ? 'dark' : 'light' }}
                    noValidate
                >
                    <label className="block">
                        <span className={label}>Daily quest counts</span>
                        <select ref={firstFieldRef} value={kind} onChange={(e) => setKind(e.target.value as 'SERIES' | 'CHAPTERS')} className={field}>
                            <option value="SERIES">Series read today</option>
                            <option value="CHAPTERS">Chapters read today</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className={label}>Daily target (1 to {GOAL_MAX[kind]})</span>
                        <input type="number" inputMode="numeric" min={1} max={GOAL_MAX[kind]} value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} className={field} />
                    </label>
                    <label className="block">
                        <span className={label}>Weekly chapters (1 to {GOAL_MAX.WEEKLY.toLocaleString()})</span>
                        <input type="number" inputMode="numeric" min={1} max={GOAL_MAX.WEEKLY} value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} className={field} />
                    </label>
                    {error && (
                        <p role="alert" className={`font-mono text-[10px] leading-snug ${theme.isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
                    )}
                    <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(false)} className={textButton}>Cancel</button>
                        <button type="submit" disabled={saving} aria-busy={saving} className={`hud hud-btn hud-accent [--hud-c:5px] ${buttonText} disabled:opacity-60 disabled:cursor-wait`}>
                            {saving ? 'Saving' : 'Save'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="flex justify-end">
                    <button ref={adjustRef} type="button" onClick={open} className={textButton}>Adjust quests</button>
                </div>
            )}
        </div>
    );
};

export default QuestPanel;
