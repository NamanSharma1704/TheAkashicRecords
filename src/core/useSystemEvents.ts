import { useCallback, useEffect, useRef, useState } from 'react';
import { systemFetch } from '../utils/auth';

/**
 * THE LIVING SYSTEM LOG (2026-11-14): the events the server has on record (GET /api/events:
 * chapters read, new chapters found, gates conquered, titles), newest first.
 *
 * `refresh` is debounced: App calls it whenever something the log tells about may have changed
 * (a save settling refreshes the reader's state; titles sync; a gate is conquered), and a burst
 * of those is one request.
 */

export interface SystemEvent {
    id: string;
    kind: 'READ' | 'FOUND' | 'CONQUEST' | 'TITLE';
    /** Epoch ms. */
    at: number;
    text: string;
    questId?: string;
}

const DEBOUNCE_MS = 700;

export const useSystemEvents = (enabled: boolean, limit = 8) => {
    const [events, setEvents] = useState<SystemEvent[] | null>(null);
    const timer = useRef<number | null>(null);
    const seq = useRef(0);

    const load = useCallback(async () => {
        const mine = ++seq.current;
        try {
            const res = await systemFetch(`/api/events?limit=${limit}`);
            if (!res.ok || mine !== seq.current) return;
            const data = await res.json();
            if (mine === seq.current && Array.isArray(data)) setEvents(data);
        } catch { /* the log keeps what it showed */ }
    }, [limit]);

    const refresh = useCallback(() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => { timer.current = null; void load(); }, DEBOUNCE_MS);
    }, [load]);

    useEffect(() => {
        if (!enabled) { seq.current++; setEvents(null); return; }
        void load();
    }, [enabled, load]);

    useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

    return { events, refresh };
};

/** An event's time as the log prints it: HH:MM today, the weekday this past week, else the date. */
export const eventTime = (at: number, now = Date.now()): string => {
    const d = new Date(at);
    const today = new Date(now);
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
