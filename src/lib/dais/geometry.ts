/**
 * Holographic dais — reconstructed geometry.
 *
 * Every number here was traced off the reference image rather than eyeballed.
 * The reference is axisymmetric about a single vertical axis, so the whole solid
 * is a radius/height profile plus a few station-repeated props. Measurement method
 * and the raw evidence live in the session trace (see `MEASUREMENT` below for the
 * projection that every radius was recovered through).
 *
 * Units: the outermost ring on the floor is radius 1. Heights are in the same unit,
 * which is why the whole dais is so flat — it stands 0.124 tall against a radius of 1.
 */

/** The projection the reference was traced through, kept so the numbers stay auditable. */
export const MEASUREMENT = {
    /** Screen-space ellipse of the floor plane in the 1200x900 reference. */
    axisScreenX: 600,
    floorCenterY: 557.5,
    semiMajorPx: 571,
    semiMinorPx: 98.5,
    /** semiMinor / semiMajor -> the camera sits this far above the floor plane. */
    elevationDeg: 9.935,
    /**
     * The side extreme traced to within 0.5px of the midpoint of the axis crossings,
     * and a second ring at R=0.96 landed within 1px of its predicted crossings. A
     * pinhole camera would need to be >160 radii away to be that flat, so the
     * reference is a long lens and the dais neighbourhood is effectively orthographic.
     */
    projection: 'long-lens (locally orthographic)',
} as const;

export interface Tier {
    /** Outer radius of this step's top face. */
    rOuter: number;
    /** Inner radius; the next tier up starts here. */
    rInner: number;
    /** Height of the top face above the floor. */
    top: number;
}

/**
 * The stepped body, outermost first.
 *
 * The trace returned nine bright concentric edges. Four of them sat within 0.009 of a
 * neighbour — below the +/-0.0036 height resolution of the trace doubled — so they are
 * bright rings drawn on one face rather than separate steps. Collapsing those leaves
 * the five steps that are actually visible in the reference.
 */
export const TIERS: readonly Tier[] = [
    { rOuter: 0.725, rInner: 0.600, top: 0.055 },
    { rOuter: 0.600, rInner: 0.440, top: 0.070 },
    { rOuter: 0.440, rInner: 0.310, top: 0.095 },
    { rOuter: 0.310, rInner: 0.160, top: 0.108 },
    { rOuter: 0.160, rInner: 0.000, top: 0.124 },
];

/** Total height of the body — a twentieth of its own diameter. */
export const BODY_HEIGHT = TIERS[TIERS.length - 1].top;
/** Radius of the body where it meets the floor. */
export const BODY_RADIUS = TIERS[0].rOuter;

/**
 * The two hairline rings lying on the floor outside the body. Both traced to Z=0 and
 * are ~2px wide in a 1200px reference, so they are drawn as lines, never as ribbons.
 */
export const FLOOR_RINGS: readonly number[] = [0.96, 1.0];

/** Marker plates sitting on the floor just outside the body rim. */
export const TABS = {
    radius: 0.75,
    /** Traced at 28-35px against a 571px radius. */
    width: 0.055,
    depth: 0.03,
    height: 0.012,
} as const;

/**
 * Props repeat at twelve stations. Tabs traced to 5.2, 31.7, 148.4, 176.4, -15.9 and
 * -162.8 degrees, which lands on a 30-degree spacing within the angular resolution the
 * foreshortened front half allows.
 *
 * The reference's antenna pins are NOT reproduced — dropped at the user's request. Their
 * traced heights (0.229-0.442, genuinely varying) are recorded in this session's notes
 * rather than here, since nothing draws them.
 */
export const STATIONS = 12;

/** Radial dash band on a tier face. Count is a design choice — see UNCERTAIN. */
export const TICKS = {
    tierIndex: 1,
    count: 72,
    /** Fraction of the tier's radial span each dash covers. */
    lengthFraction: 0.45,
} as const;

/**
 * What the single reference view could not establish. These are stylisation choices,
 * not measurements, and are the first things to revisit if the dais reads wrong.
 *
 * The reference's floor grid is not listed: it was dropped from the build entirely,
 * so its (unmeasurable) cell size no longer matters.
 */
export const UNCERTAIN = [
    'Tick count: dashes resolve at ~4.5px near the foreshortened back of the ring, indistinguishable from compression noise. TICKS.count is a design choice.',
    'Station phase: recovering an angle near the front of the ellipse is ill-conditioned, so the 30-degree spacing is a reading of the traced angles rather than a measurement of them.',
    'The back half of every feature is inferred from rotational symmetry; one view cannot show it.',
] as const;

/** Angle of station `i`, radians. Station 0 faces the camera. */
export const stationAngle = (i: number, count: number = STATIONS): number =>
    (Math.PI * 2 * i) / count + Math.PI / 2;
