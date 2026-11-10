import { createContext, useCallback, useContext, useEffect } from 'react';

/**
 * SYSTEM TUTORIALS: one short guided pass per page. The steps live in
 * components/system/tourSteps.ts and load with SystemTour itself, so only this plumbing (the
 * page ids, the context and the hook every page uses) ships in the first bundle.
 *
 * A guest gets each page's tour once, the first time the page opens (App remembers it per
 * sandbox); anyone can replay a page's tour from its "?" button. The dashboard has none, so
 * its tour plays once per guest only.
 */
export type TourId = 'dashboard' | 'spire' | 'floor' | 'matrix' | 'profile' | 'series' | 'gate';

/** App's tour opener: `auto` opens only a tour this guest has not seen; otherwise it opens now. */
export const TourContext = createContext<((id: TourId, auto: boolean) => void) | null>(null);

/**
 * A page's tour. It is offered once the page is `ready` (open and settled), and the function
 * returned replays it, for the page's "?" button.
 */
export const usePageTour = (id: TourId, ready: boolean) => {
    const request = useContext(TourContext);
    useEffect(() => {
        if (!ready || !request) return;
        const t = setTimeout(() => request(id, true), 900);
        return () => clearTimeout(t);
    }, [id, ready, request]);
    return useCallback(() => request?.(id, false), [id, request]);
};
