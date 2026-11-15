import type { RGB } from './textures';

/**
 * The five class domains (Feature 30, Realm Signatures). A series whose class is none of these
 * (UNKNOWN) has no domain and keeps the standard backdrop.
 */
export const REALMS = ['NECROMANCER', 'PLAYER', 'MAGE', 'CONSTELLATION', 'IRREGULAR'] as const;
export type Realm = typeof REALMS[number];

export const realmOf = (classType: unknown): Realm | null =>
    (typeof classType === 'string' && (REALMS as readonly string[]).includes(classType) ? (classType as Realm) : null);

/** The domain's name, as the top bar decodes it. */
export const DOMAIN_NAME: Record<Realm, string> = {
    NECROMANCER: 'ABYSSAL_CRYPT',
    PLAYER: 'RETINAL_MATRIX',
    MAGE: 'LEYLINE_SANCTUM',
    CONSTELLATION: 'STAR_STREAM_VOID',
    IRREGULAR: 'DIMENSIONAL_FRACTURE',
};

/**
 * The colours a domain's baked textures are drawn in. Theme discipline: the Void theme has its
 * obsidian blacks, amber and gold; Arcanum has deep amethyst, violet and lilac. Nothing else.
 *
 *   glow    the accent, as light
 *   crown   the brighter second tone (gold / pale lilac), for cores and highlights
 *   shade   matter that reads as shadow on this ground (black smoke / deep amethyst)
 *   ash     pale drifting matter (ember-lit smoke / violet haze)
 */
export interface DomainPalette { glow: RGB; crown: RGB; shade: RGB; ash: RGB }

export const paletteOf = (isDark: boolean): DomainPalette => (isDark
    ? { glow: [245, 158, 11], crown: [251, 191, 36], shade: [4, 3, 1], ash: [176, 140, 92] }
    : { glow: [124, 58, 237], crown: [233, 226, 246], shade: [59, 20, 120], ash: [139, 92, 246] });

/** A small seeded generator, so a series keeps the same domain layout every time it opens. */
export const seeded = (text: string) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    let seed = h >>> 0;
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
export type Rand = () => number;
export const between = (r: Rand, lo: number, hi: number) => lo + r() * (hi - lo);
export const f1 = (n: number) => +n.toFixed(1);

export interface Point { x: number; y: number }

/** A strip of stars as an SVG tile (it repeats along x), as a CSS url(), cached by its inputs. */
const tiles = new Map<string, string>();
export const starTile = (key: string, w: number, h: number, count: number, rgb: string, bright: string): string => {
    const id = `${key}:${w}:${h}:${count}:${rgb}:${bright}`;
    const hit = tiles.get(id);
    if (hit) return hit;
    const r = seeded(id);
    let body = '';
    for (let i = 0; i < count; i++) {
        // Denser along the strip's spine, so a band of them reads as a stream.
        const y = h / 2 + (r() + r() + r() - 1.5) * (h / 1.6);
        const size = r() < 0.12 ? between(r, 1.3, 2) : between(r, 0.5, 1.1);
        body += `<circle cx="${f1(r() * w)}" cy="${f1(y)}" r="${f1(size)}" fill="rgb(${size > 1.2 ? bright : rgb})" opacity="${between(r, 0.35, 1).toFixed(2)}"/>`;
    }
    const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)}")`;
    tiles.set(id, url);
    return url;
};

/** A jagged run from `start`: each step turns a little, is pulled back toward `angle`, and shortens. */
export const jag = (r: Rand, start: Point, angle: number, segs: number, lo: number, hi: number): Point[] => {
    const pts = [start];
    let { x, y } = start, a = angle;
    for (let i = 0; i < segs; i++) {
        a += between(r, -0.75, 0.75);
        a += (angle - a) * 0.4;
        const len = between(r, lo, hi) * (1 - i / (segs * 1.6));
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        pts.push({ x, y });
    }
    return pts;
};
export const lineOf = (pts: Point[]) => 'M' + pts.map(p => `${f1(p.x)} ${f1(p.y)}`).join('L');

/** Fragments of corrupted hex, for the Dimensional Fracture's glitches. Flavour, not figures. */
export const HEX = ['0xDEAD', 'UNBOUND', '0x7F3A', 'NULL//REF', 'ERR:RIFT', '0xC0DE', 'DESYNC', '0x0000'];
