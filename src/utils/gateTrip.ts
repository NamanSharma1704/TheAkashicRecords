/**
 * RETURN FROM THE GATE (2026-11-14): the portal trip this device is on.
 *
 * ENTER PORTAL records which series was entered, at which chapter, and when (this device only,
 * per signed-in user). When the reader comes back at least RETURN_AFTER_MS later, App offers to
 * log what was read (ReturnSheet). A trip is taken once: coming back too soon leaves it for the
 * real return; coming back after it has gone stale drops it.
 */

export interface GateTrip {
    questId: string;
    /** The chapter on screen when the portal opened. */
    chapter: number;
    /** When it opened (epoch ms). */
    at: number;
}

/** Away for less than this was not a reading session (a misclick, a quick look). */
export const RETURN_AFTER_MS = 3 * 60 * 1000;
/** A trip older than this is forgotten rather than asked about. */
export const TRIP_STALE_MS = 12 * 60 * 60 * 1000;

const keyFor = (userId: string) => `akashic_gate_trip_${userId}`;

export const recordGateTrip = (userId: string, trip: GateTrip) => {
    try { localStorage.setItem(keyFor(userId), JSON.stringify(trip)); } catch { /* private mode: no trip */ }
};

/** The trip to ask about now, if any. Taking it clears it, so it is asked about once. */
export const takeReturnedTrip = (userId: string, now = Date.now()): GateTrip | null => {
    let trip: GateTrip | null = null;
    try { trip = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null'); } catch { return null; }
    if (!trip || typeof trip.questId !== 'string' || typeof trip.at !== 'number' || typeof trip.chapter !== 'number') return null;
    const away = now - trip.at;
    if (away < RETURN_AFTER_MS) return null;
    try { localStorage.removeItem(keyFor(userId)); } catch { /* nothing to clear */ }
    return away > TRIP_STALE_MS ? null : trip;
};
