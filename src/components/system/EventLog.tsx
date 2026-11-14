import React, { useMemo, useRef } from 'react';
import { Theme } from '../../core/types';
import { SystemEvent, eventTime } from '../../core/useSystemEvents';
import ScrambleText from './ScrambleText';

/**
 * EVENT_LOG beside the hero: the last few things that actually happened (useSystemEvents), each
 * with its real time. Until the log has loaded it says only that the link is up, with the time
 * it came up; an archive with no events yet says it is waiting. A line that arrives while the
 * page is open decodes in (ScrambleText; plain under reduced motion), one at a time: if several
 * arrive together, only the newest decodes.
 */
const EventLog: React.FC<{ theme: Theme; events: SystemEvent[] | null; rows?: number }> = ({ theme, events, rows = 4 }) => {
    const shown = useMemo(() => (events ?? []).slice(0, rows), [events, rows]);
    const seen = useRef<Set<string> | null>(null);
    const connectedAt = useRef(Date.now());

    // The first list is the past: nothing in it decodes. After that, the newest unseen line does.
    let decodeId: string | null = null;
    if (events) {
        if (seen.current === null) seen.current = new Set(shown.map((e) => e.id));
        else {
            const fresh = shown.filter((e) => !seen.current!.has(e.id));
            if (fresh.length) decodeId = fresh[0].id;
            fresh.forEach((e) => seen.current!.add(e.id));
        }
    }
    // Remember which line decodes, so a re-render mid-decode does not start it over or stop it.
    const decoding = useRef<string | null>(null);
    if (decodeId) decoding.current = decodeId;

    const line = (key: string, time: string, text: string, strong = false, decode = false) => (
        <div key={key} className="flex gap-2 min-w-0">
            <span className={`shrink-0 tabular-nums ${theme.mutedText}`}>[{time}]</span>
            <span
                className={`min-w-0 line-clamp-2 break-words ${strong ? 'font-bold' : ''}`}
                title={text}
                style={strong ? { textShadow: theme.isDark ? `0 0 10px ${theme.accentColor}` : undefined } : undefined}
            >
                {decode ? <ScrambleText key={key} text={text} decodeOnMount maxMs={700} glyphClassName="text-accent-ink" /> : text}
            </span>
        </div>
    );

    return (
        <div aria-live="polite" aria-relevant="additions" className="flex flex-col gap-1.5 text-[9px] font-mono leading-relaxed tracking-wider mt-2" style={{ color: theme.accentInk }}>
            {events === null && line('connected', eventTime(connectedAt.current), 'Signal acquired.')}
            {events !== null && shown.length === 0 && line('waiting', eventTime(connectedAt.current), 'Awaiting directive.', true)}
            {shown.map((e, i) => line(e.id, eventTime(e.at), e.text, i === 0, e.id === decoding.current))}
        </div>
    );
};

export default React.memo(EventLog);
