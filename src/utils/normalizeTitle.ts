/**
 * Canonical form of a quest title, for duplicate detection.
 *
 * Mirrors backend/utils/normalizeTitle.js exactly: lowercase, letters and digits only, so
 * "Solo Leveling", "solo-leveling" and "Solo Leveling!" are one title. The client must use
 * the server's rule, not a looser one: CSV import used to match on lowercase + trim, so a row
 * the server considered a duplicate looked new here, was POSTed, and came back 409.
 */
export const normalizeTitle = (title: string): string =>
    String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
