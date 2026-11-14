/* App-wide settings and defaults (moved out of App.tsx, 2026-11-13). */

/** The guest sandbox's countdown turns to the warning ink for its last 10 minutes. */
export const LINK_LOW_MS = 10 * 60 * 1000;

/**
 * Should this device start in low-power effects mode? Conservative on purpose: only a
 * Save-Data connection, or hardware reporting 2 GB of memory or 2 CPU cores or fewer. Most
 * phones and every iPad report more than that and keep the full effects unless the reader
 * switches them off. (Safari reports no deviceMemory, so it is judged on cores alone.)
 */
export const prefersLowPower = (): boolean => {
    try {
        const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
        return !!nav.connection?.saveData
            || (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2)
            || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2);
    } catch {
        return false;
    }
};

/** The dashboard's keyboard shortcuts, shown by "?" and by the console bar's KEYS button. */
export const SHORTCUT_HELP = [
    'SYSTEM SHORTCUTS',
    '→ / ←   Next / previous chapter. Hold the key to keep going.',
    'Tap the chapter number to type a chapter in.',
    'Enter   Open the reading link (when nothing else has focus).',
    '/   Search the Divine Spire.',
    'N   Open a new gate.',
    'Ctrl+Z   Undo the last change while its notice is showing.',
    '?   Show this list.',
].join('\n');
