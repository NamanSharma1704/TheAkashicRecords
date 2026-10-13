import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '../../core/types';
import { systemFetch } from '../../utils/auth';

interface Stats {
    today: string;
    days: { day: string; chapters: number }[];
    thisWeek: number;
    lastWeek: number;
    currentStreak: number;
    longestStreak: number;
    daysRead: number;
    chaptersThisYear: number;
}

/** The calendar day `delta` days from `day` ('YYYY-MM-DD'): date arithmetic, no timezone. */
const shiftDay = (day: string, delta: number) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
const weekdayOf = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
};
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Chapters → intensity step, 0 (none) to 4. */
const level = (n: number) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4);
const LEVEL_ALPHA = ['', '40', '73', 'b3', 'ff'];

/**
 * A year of reading, from the reading log the server keeps (one signed entry per chapter
 * move, summed per day in your own timezone). History starts when the log did: chapters read
 * before it existed were never recorded, so the first weeks fill in from here on.
 */
const ReadingActivity: React.FC<{ theme: Theme }> = ({ theme }) => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [failed, setFailed] = useState(false);
    const scroller = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        systemFetch('/api/stats')
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((s: Stats) => { if (alive) setStats(s); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, []);

    // 53 week-columns, Sunday to Saturday, ending with the week that holds today.
    const grid = useMemo(() => {
        if (!stats) return null;
        const byDay = new Map(stats.days.map(d => [d.day, d.chapters]));
        const start = shiftDay(stats.today, -(52 * 7 + weekdayOf(stats.today)));
        const weeks: { day: string; chapters: number; future: boolean }[][] = [];
        for (let w = 0; w < 53; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const day = shiftDay(start, w * 7 + d);
                week.push({ day, chapters: byDay.get(day) || 0, future: day > stats.today });
            }
            weeks.push(week);
        }
        return weeks;
    }, [stats]);

    // On a narrow screen the grid scrolls sideways; start at the recent end.
    useEffect(() => {
        if (grid && scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
    }, [grid]);

    const empty = theme.isDark ? 'bg-white/[0.06]' : 'bg-black/[0.07]';
    const panel = `border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} elev-1 rounded-md backdrop-blur-md px-5 py-5`;

    if (failed) {
        return <div className={panel}><p className={`font-mono text-[11px] ${theme.mutedText}`}>Reading activity is unavailable right now.</p></div>;
    }
    if (!stats || !grid) {
        return <div className={panel}><p className={`font-mono text-[11px] ${theme.mutedText}`}>Reading the log…</p></div>;
    }

    const trend = stats.thisWeek - stats.lastWeek;
    const figures = [
        { label: 'This week', value: stats.thisWeek, note: stats.lastWeek || stats.thisWeek ? `${trend >= 0 ? '+' : ''}${trend} vs last week` : 'chapters' },
        { label: 'Current streak', value: stats.currentStreak, note: stats.currentStreak === 1 ? 'day' : 'days' },
        { label: 'Longest streak', value: stats.longestStreak, note: stats.longestStreak === 1 ? 'day' : 'days' },
        { label: 'Days read', value: stats.daysRead, note: 'this year' },
    ];

    return (
        <div className={panel}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {figures.map(f => (
                    <div key={f.label}>
                        <p className={`font-mono text-[9px] font-bold tracking-[0.2em] uppercase ${theme.mutedText}`}>{f.label}</p>
                        <p className={`font-mono text-xl font-black tabular-nums leading-tight ${theme.headingText}`}>{f.value}</p>
                        <p className={`font-mono text-[10px] ${theme.mutedText}`}>{f.note}</p>
                    </div>
                ))}
            </div>

            {stats.daysRead === 0 ? (
                <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                    No reading logged yet. Every chapter you move forward from now on is recorded here, day by day.
                </p>
            ) : (
                <>
                    <div ref={scroller} className="overflow-x-auto hide-scrollbar">
                        <div
                            role="img"
                            aria-label={`Reading activity over the past year: ${stats.chaptersThisYear} chapters across ${stats.daysRead} days. Longest streak ${stats.longestStreak} days.`}
                            className="inline-flex flex-col gap-1"
                        >
                            {/* Month labels over the first week that starts a new month. */}
                            <div className="flex gap-[3px] h-3" aria-hidden="true">
                                {grid.map((week, w) => {
                                    const first = week[0].day;
                                    const show = w === 0 || first.slice(5, 7) !== grid[w - 1][0].day.slice(5, 7);
                                    return (
                                        <span key={w} className={`w-[11px] shrink-0 font-mono text-[9px] leading-none overflow-visible whitespace-nowrap ${theme.mutedText}`}>
                                            {show && w < 52 ? monthFmt.format(asDate(first)) : ''}
                                        </span>
                                    );
                                })}
                            </div>
                            <div className="flex gap-[3px]" aria-hidden="true">
                                {grid.map((week, w) => (
                                    <div key={w} className="flex flex-col gap-[3px]">
                                        {week.map(cell => {
                                            const l = level(cell.chapters);
                                            return (
                                                <span
                                                    key={cell.day}
                                                    title={cell.future ? undefined : `${dayFmt.format(asDate(cell.day))}: ${cell.chapters} chapter${cell.chapters === 1 ? '' : 's'}`}
                                                    className={`block w-[11px] h-[11px] rounded-[2px] ${cell.future ? 'opacity-0' : l === 0 ? empty : ''}`}
                                                    style={l > 0 ? { backgroundColor: `${theme.accentColor}${LEVEL_ALPHA[l]}` } : undefined}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className={`flex items-center justify-end gap-1.5 mt-3 font-mono text-[9px] ${theme.mutedText}`} aria-hidden="true">
                        Less
                        {[0, 1, 2, 3, 4].map(l => (
                            <span key={l} className={`block w-[11px] h-[11px] rounded-[2px] ${l === 0 ? empty : ''}`} style={l > 0 ? { backgroundColor: `${theme.accentColor}${LEVEL_ALPHA[l]}` } : undefined} />
                        ))}
                        More
                    </div>
                </>
            )}
        </div>
    );
};

export default ReadingActivity;
