/** The Mana Ring's geometry, shared with HeroRings (which places a phone's ring by its seal). */

/** The scale of the ring's marks at a diameter of `d` px. */
export const scaleOf = (d: number) => Math.min(1, Math.max(0.62, d / 1050));

/** How far the ring's circle lies inside its box: room for the gate's rays above and the seal
 *  below. */
export const ringInset = (d: number) => { const s = scaleOf(d); return Math.max(30 * s + 4, 36 + 13 * s); };
