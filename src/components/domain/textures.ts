/**
 * Procedural matter for the class domains (Feature 30): fog, smoke, a vortex, nebula cloud.
 *
 * Each texture is drawn once into a small canvas from tileable value noise, colour and falloff
 * baked in, and cached as a data URL. The domains show them as stretched <img> layers and move
 * them only with transform and opacity, so the atmosphere costs the compositor a few small
 * textures and the main thread nothing per frame. Soft matter is low-frequency: a 256 px tile
 * stretched across a screen is exactly as sharp as fog should be.
 *
 * Baking is CPU work (a few hundred thousand noise samples a texture), so a page never bakes on
 * its own render: useBaked() queues each texture for its own idle slot, one per task, and the
 * layer appears when its texture is ready, while the domain is still blooming in. Measured on a
 * CPU slowed 4x: baked inline, opening a Necromancer page cost 570 ms of long tasks (the longest
 * 149 ms, under the rift opening); queued and at these sizes, no task over 50 ms.
 */

import { useEffect, useState } from 'react';

export type RGB = readonly [number, number, number];

const cache = new Map<string, string>();

const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const LAT = 64;
type Noise = (x: number, y: number, px: number, py: number) => number;

/** Value noise on a lattice that repeats every `px` by `py` cells (so the texture can tile). */
const noiseOf = (seed: number): Noise => {
    const r = rng(seed);
    const t = new Float32Array(LAT * LAT);
    for (let i = 0; i < t.length; i++) t[i] = r();
    const at = (ix: number, iy: number, px: number, py: number) => t[(((iy % py) + py) % py % LAT) * LAT + (((ix % px) + px) % px % LAT)];
    return (x, y, px, py) => {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = x - x0, fy = y - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = at(x0, y0, px, py), b = at(x0 + 1, y0, px, py), c = at(x0, y0 + 1, px, py), d = at(x0 + 1, y0 + 1, px, py);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
};

/** Fractal noise, 0..1: `oct` octaves over a base lattice of `px` by `py` cells. */
const fbm = (n: Noise, x: number, y: number, px: number, py: number, oct: number): number => {
    let v = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
        v += amp * n(x * f, y * f, px * f, py * f);
        norm += amp; amp *= 0.5; f *= 2;
    }
    return v / norm;
};

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A pixel: alpha 0..1, and where between the two colours it sits (0 = `a`, 1 = `b`). */
type Shade = (u: number, v: number) => readonly [alpha: number, mix: number];

const paint = (key: string, w: number, h: number, a: RGB, b: RGB, shade: Shade): string => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const [alpha, mix] = shade(i / w, j / h);
            const o = (j * w + i) * 4;
            d[o] = a[0] + (b[0] - a[0]) * mix;
            d[o + 1] = a[1] + (b[1] - a[1]) * mix;
            d[o + 2] = a[2] + (b[2] - a[2]) * mix;
            d[o + 3] = clamp01(alpha) * 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    cache.set(key, url);
    return url;
};

const keyOf = (name: string, seed: number, a: RGB, b: RGB, max: number) => `${name}:${seed}:${a.join()}:${b.join()}:${max}`;

/**
 * Ground fog: a wide band that tiles left to right, thin at its top edge and dense at the
 * bottom, with billows cut into it. Two of these drifting at different speeds read as fog that
 * moves through itself.
 */
export const fogBand = (seed: number, a: RGB, b: RGB, max: number): string => {
    const n = noiseOf(seed);
    return paint(keyOf('fog', seed, a, b, max), 224, 96, a, b, (u, v) => {
        const x = u * 6, y = v * 2.5;
        const warp = fbm(n, x + 11, y + 3, 6, 64, 3);
        const billow = fbm(n, x + warp * 1.6, y + warp * 0.8, 6, 64, 5);
        const body = smooth(0.02, 1, v) ** 1.25;
        const cut = smooth(0.28, 0.78, billow + v * 0.42);
        return [max * body * (0.18 + 0.82 * cut), smooth(0.35, 0.8, billow)];
    });
};

/**
 * Smoke: stringy, curling wisps (ridged, domain-warped noise) inside a soft disc. Turning two of
 * them against each other churns.
 */
export const smokeDisc = (seed: number, a: RGB, b: RGB, max: number, density = 1): string => {
    const n = noiseOf(seed);
    return paint(keyOf(`smoke${density}`, seed, a, b, max), 176, 176, a, b, (u, v) => {
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        if (r >= 1) return [0, 0];
        const x = u * 5, y = v * 5;
        const q = fbm(n, x + 7, y + 2, 64, 64, 3);
        const w = fbm(n, x + q * 2.6, y + q * 2.6 + 5, 64, 64, 5);
        const ridge = 1 - Math.abs(2 * w - 1);
        const fall = smooth(1, 0.18, r);
        return [max * fall * clamp01(ridge ** (2.4 / density) * 1.25), smooth(0.4, 0.75, q)];
    });
};

/** A vortex: spiral arms wound around a wide eye. The eye is where the title sits, so the
 *  smoke frames the words rather than passing under them. */
export const vortexDisc = (seed: number, a: RGB, b: RGB, max: number): string => {
    const n = noiseOf(seed);
    return paint(keyOf('vortex', seed, a, b, max), 208, 208, a, b, (u, v) => {
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        if (r >= 1 || r < 0.02) return [0, 0];
        const th = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
        // Angle is the periodic axis (8 cells around); winding it by log(r) makes the arms.
        const x = th * 8 + Math.log(r * 3 + 0.25) * 2.4, y = r * 4.5;
        const w = fbm(n, x, y, 8, 64, 5);
        const ridge = 1 - Math.abs(2 * w - 1);
        const ring = smooth(0.56, 0.86, r) * smooth(1, 0.87, r);
        return [max * ring * clamp01(ridge ** 1.7 * 1.3), smooth(0.3, 0.9, r)];
    });
};

/** Nebula: billowing cloud in a soft disc, its core in the second colour. */
export const nebulaDisc = (seed: number, a: RGB, b: RGB, max: number): string => {
    const n = noiseOf(seed);
    return paint(keyOf('nebula', seed, a, b, max), 192, 192, a, b, (u, v) => {
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy) * 2;
        if (r >= 1) return [0, 0];
        const x = u * 4, y = v * 4;
        const q = fbm(n, x + 3, y + 9, 64, 64, 3);
        const cloud = fbm(n, x + q * 2.2 + 1, y + q * 2.2, 64, 64, 5);
        const fila = 1 - Math.abs(2 * fbm(n, x * 1.7 + q, y * 1.7 + 4, 64, 64, 4) - 1);
        const fall = smooth(1, 0.1, r);
        const body = smooth(0.34, 0.82, cloud) * 0.75 + fila ** 3 * 0.5;
        return [max * fall * clamp01(body), clamp01(smooth(0.5, 0.86, cloud) * 0.8 + smooth(0.6, 0, r) * 0.35)];
    });
};

/** Cloud that tiles both ways: nebular dust across a whole screen. */
export const dustField = (seed: number, a: RGB, b: RGB, max: number): string => {
    const n = noiseOf(seed);
    return paint(keyOf('dust', seed, a, b, max), 160, 160, a, b, (u, v) => {
        const x = u * 4, y = v * 4;
        const q = fbm(n, x + 5, y + 1, 4, 4, 3);
        const cloud = fbm(n, x + q * 1.8, y + q * 1.8 + 2, 4, 4, 5);
        return [max * smooth(0.38, 0.86, cloud), smooth(0.55, 0.9, cloud)];
    });
};

/* ── Baking off the critical path ── */

const baked = new Map<string, string>();
const queue: (() => void)[] = [];
let pumping = false;
const pump = () => {
    const job = queue.shift();
    if (!job) { pumping = false; return; }
    job();
    const ric = typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
    if (ric) ric(pump, { timeout: 120 }); else setTimeout(pump, 16);
};

/**
 * A baked texture's data URL, or null until it is ready. `key` names the texture (its maker and
 * its inputs); a texture already baked this session is there on the first render.
 */
export const useBaked = (key: string, make: () => string): string | null => {
    const [url, setUrl] = useState<string | null>(() => baked.get(key) ?? null);
    useEffect(() => {
        const hit = baked.get(key);
        if (hit) { setUrl(hit); return; }
        let alive = true;
        queue.push(() => {
            const out = baked.get(key) ?? make();
            baked.set(key, out);
            if (alive) setUrl(out);
        });
        if (!pumping) { pumping = true; setTimeout(pump, 0); }
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names everything make() reads
    }, [key]);
    return url;
};
