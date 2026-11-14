import React, { useEffect, useState } from 'react';
import { Theme } from '../../core/types';
import { systemFetch } from '../../utils/auth';
import { RadarGlyph } from '../system/SystemGlyphs';

/**
 * RELEASE RADAR on the series page (2026-11-14): when this series usually releases, from
 * GET /api/quests/:id/radar (backend/lib/radar.js). Honest about what it knows: the cadence it
 * read and from where, a series on a break, one running late, one with too little history.
 * Dates are the days the source recorded each release; the site you read on may differ by a
 * day, and says so.
 */

interface Radar {
    status: 'LEARNING' | 'BREAK' | 'WEEKLY' | 'EVERY' | 'IRREGULAR';
    seen: number;
    lastDay: string | null;
    weekday?: number;
    everyDays?: number;
    nextDay?: string;
    sinceLast?: number;
    overdue?: boolean;
    source: 'MangaUpdates' | 'MangaDex' | 'TRACKER' | null;
    tracked: boolean;
}

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const localDay = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const fmt = (day: string) => localDay(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fromToday = (day: string) => {
    const t = new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    return Math.round((localDay(day).getTime() - today) / 86_400_000);
};
const relative = (day: string) => {
    const n = fromToday(day);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
};
const span = (days: number) => (days >= 14 ? `${Math.floor(days / 7)} weeks` : `${days} days`);

const ReleaseRadar: React.FC<{ questId: string; theme: Theme; labelClass: string; cellClass: string; strongText: string }> = ({ questId, theme, labelClass, cellClass, strongText }) => {
    const [radar, setRadar] = useState<Radar | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let alive = true;
        setRadar(null);
        setFailed(false);
        systemFetch(`/api/quests/${questId}/radar`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((data) => { if (alive) setRadar(data); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [questId]);

    const muted = theme.isDark ? 'text-white/60' : 'text-stone-600';

    let headline = '';
    let next: [string, string] | null = null;
    let note = '';
    if (radar) {
        switch (radar.status) {
            case 'WEEKLY':
                headline = `Usually ${WEEKDAYS[radar.weekday ?? 0]}`;
                next = radar.overdue
                    ? ['Running late', `None in ${span(radar.sinceLast ?? 0)}`]
                    : [fmt(radar.nextDay!), relative(radar.nextDay!)];
                break;
            case 'EVERY':
                headline = radar.everyDays === 1 ? 'Daily releases' : `About every ${radar.everyDays} days`;
                next = radar.overdue
                    ? ['Running late', `None in ${span(radar.sinceLast ?? 0)}`]
                    : [fmt(radar.nextDay!), relative(radar.nextDay!)];
                break;
            case 'IRREGULAR':
                headline = 'Irregular releases';
                note = 'No steady day or interval to predict from.';
                break;
            case 'BREAK':
                headline = 'On a break';
                note = `No release in ${span(radar.sinceLast ?? 0)}: likely between seasons, or on hiatus.`;
                break;
            case 'LEARNING':
                headline = 'Learning';
                note = radar.tracked || radar.seen
                    ? `${radar.seen} of 3 releases seen. The cadence shows once there are 3.`
                    : 'No source knows this series by id yet. The chapter tracker learns it on its next check.';
                break;
        }
    }
    const provenance = radar?.source === 'MangaUpdates' ? 'From MangaUpdates release records (official and group releases).'
        : radar?.source === 'MangaDex' ? 'From MangaDex English chapter dates.'
            : radar?.source === 'TRACKER' ? 'From the chapter tracker\'s own finds.'
                : '';

    return (
        <div data-tour="series-radar" className="hud hud-sheet p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <RadarGlyph size={16} className={muted} />
                <span className={`text-[10px] font-mono tracking-[0.3em] font-bold uppercase ${muted}`}>RELEASE RADAR</span>
            </div>
            {failed ? (
                <p className={`text-[11px] font-mono leading-relaxed ${muted}`}>The release radar is unavailable right now.</p>
            ) : !radar ? (
                <div className="grid grid-cols-2 gap-3 animate-pulse" aria-hidden="true">
                    {Array.from({ length: 2 }).map((_, i) => <div key={i} className={`h-14 rounded-lg ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`} />)}
                </div>
            ) : (
                <>
                    <p className={`font-orbitron font-bold text-sm uppercase tracking-[0.08em] ${strongText}`}>{headline}</p>
                    <dl className="grid grid-cols-2 gap-3">
                        {next && (
                            <div className={cellClass}>
                                <dt className={labelClass}>NEXT EXPECTED</dt>
                                <dd className={`text-sm font-bold font-mono tabular-nums ${radar.overdue ? '' : 'text-accent-ink'}`} style={radar.overdue ? { color: theme.warningInk } : undefined}>{next[0]}</dd>
                                <dd className={`text-[11px] font-mono ${muted}`}>{next[1]}</dd>
                            </div>
                        )}
                        <div className={`${cellClass} ${next ? '' : 'col-span-2'}`}>
                            <dt className={labelClass}>LAST RELEASE</dt>
                            <dd className={`text-sm font-bold font-mono tabular-nums ${strongText}`}>{radar.lastDay ? fmt(radar.lastDay) : '—'}</dd>
                            {radar.lastDay && <dd className={`text-[11px] font-mono ${muted}`}>{relative(radar.lastDay)}</dd>}
                        </div>
                    </dl>
                    {(note || provenance) && (
                        <p className={`text-[11px] font-mono leading-relaxed ${muted}`}>
                            {note}{note && provenance ? ' ' : ''}{provenance}{provenance ? ' Your site may differ by a day.' : ''}
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default ReleaseRadar;
