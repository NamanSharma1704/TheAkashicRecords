import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { HEX, Point, Realm, Rand, between, f1, jag, lineOf, paletteOf, seeded, starTile } from './realms';
import { dustField, fogBand, useBaked } from './textures';
import './domain.css';

/**
 * The Domain Backplane: tier 2 of a class domain (Feature 30). The ambient field, fixed to the
 * viewport, in place of the series page's starfield, blurred cover and HUD grid.
 *
 * Three kinds of layer:
 *   lighting  (.dp-light)   the whole screen. It only moves the ground away from the ink.
 *   matter    the domain's substance, drawn twice: a SETTLED copy under the content column at
 *             --d-col strength (.dp-still), and a LIVING copy at full strength in each side
 *             gutter (.dp-gutter). Nothing under the column moves continuously: the plates
 *             there blur their backdrop, and would have to re-blur it every frame.
 *   passes    (.dp-passes)  what crosses the whole screen now and then: the radar, the glitch.
 *
 * On arrival a shockwave runs out from the cover (.dp-ring): the expansion.
 */

/** The plane's size, the content column's edges, and the cover's centre (the epicenter), in px. */
interface Box { W: number; H: number; l: number; r: number; ex: number; ey: number }
type Side = 'l' | 'r';
interface MatterProps {
    box: Box;
    isDark: boolean;
    seed: string;
    /** The gutter this living copy fills. Absent: the settled copy under the column. */
    side?: Side;
}
const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;
/** The x range of a gutter, in plane px. */
const reach = (box: Box, side: Side): [number, number] => (side === 'l' ? [0, box.l] : [box.r, box.W]);

/* ══════════════════════════════════════════════════════ NECROMANCER: the Abyssal Crypt */

const NecroMatter: React.FC<MatterProps> = ({ box, isDark, seed, side }) => {
    const p = paletteOf(isDark), tone = isDark ? 'd' : 'l';
    const fogA = useBaked(`fog-a:${tone}`, () => fogBand(3, isDark ? p.ash : p.shade, p.glow, isDark ? 0.62 : 0.54));
    const fogB = useBaked(`fog-b:${tone}`, () => fogBand(8, isDark ? p.ash : p.shade, isDark ? p.crown : p.glow, isDark ? 0.5 : 0.44));
    const ash = useMemo(() => {
        if (!side) return null;
        const r = seeded(`ash:${side}:${seed}`);
        const [x0, x1] = reach(box, side);
        return {
            motes: Array.from({ length: 10 }, () => {
                const dur = between(r, 9, 17);
                return {
                    x: f1(between(r, x0 + 6, x1 - 6)), y: f1(between(r, box.H * 0.6, box.H * 0.96)), size: f1(between(r, 2, 3.8)),
                    dur: f1(dur), delay: -f1(r() * dur), dx: Math.round(between(r, -26, 26)), rise: Math.round(between(r, box.H * 0.35, box.H * 0.7)), a: +between(r, 0.5, 1).toFixed(2),
                };
            }),
            souls: Array.from({ length: 2 }, () => {
                const dur = between(r, 14, 22);
                return {
                    x: f1(between(r, x0 + 20, x1 - 20)), y: f1(between(r, box.H * 0.7, box.H * 0.92)), dur: f1(dur), delay: -f1(r() * dur),
                    rise: Math.round(between(r, box.H * 0.45, box.H * 0.75)), sway: f1(between(r, 2.4, 3.6)), drift: Math.round(between(r, 8, 18)),
                };
            }),
        };
    }, [box, seed, side]);
    if (!ash) {
        return (
            <>
                {fogA && <img className="dp-fog" src={fogA} alt="" draggable={false} />}
                {fogB && <img className="dp-fog dp-fog-b" src={fogB} alt="" draggable={false} />}
            </>
        );
    }
    return (
        <>
            {fogA && <div className="dp-fog-drift d-loop" style={{ backgroundImage: `url(${fogA})` }} />}
            {fogB && <div className="dp-fog-drift dp-fog-drift-b d-loop" style={{ backgroundImage: `url(${fogB})` }} />}
            {ash.motes.map((m, i) => (
                <span key={i} className="dm-mote d-loop" style={css({ left: m.x, top: m.y, width: m.size, height: m.size, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, '--dx': `${m.dx}px`, '--rise': `${m.rise}px`, '--a': m.a })} />
            ))}
            {ash.souls.map((s, i) => (
                <span key={i} className="dm-soul d-loop" style={css({ left: s.x, top: s.y, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, '--rise': `${s.rise}px` })}>
                    <i className="d-loop" style={css({ animationDuration: `${s.sway}s`, '--reach': `${s.drift}px` })} />
                </span>
            ))}
        </>
    );
};

/* ═══════════════════════════════════════════════════ PLAYER: the Retinal System Matrix */

/**
 * The floor, orthographic: a square grid seen from low and to one side, so its depth runs to the
 * top-right. One cell (72 units) maps to these two screen vectors; parallel lines stay parallel.
 */
const CELL = 72;
const E1 = { x: 70.9, y: -6.3 }, E2 = { x: -12.5, y: -35.4 };

const PlayerMatter: React.FC<MatterProps> = ({ box, seed, side }) => {
    const id = `dp-grid-${useId().replace(/:/g, '')}`;
    const m = useMemo(() => {
        const a = E1.x / CELL, b = E1.y / CELL, c = E2.x / CELL, d = E2.y / CELL, e = box.W * 0.08, f = box.H * 0.96;
        const det = a * d - b * c;
        /** The grid cell under a point of the screen. */
        const cellAt = (x: number, y: number) => ({
            gx: Math.floor((d * (x - e) - c * (y - f)) / det / CELL) * CELL,
            gy: Math.floor((-b * (x - e) + a * (y - f)) / det / CELL) * CELL,
        });
        const r = seeded(`matrix:${side ?? 'c'}:${seed}`);
        const [x0, x1] = side ? reach(box, side) : [0, box.W];
        const tiles = Array.from({ length: side ? 6 : 14 }, () => ({
            ...cellAt(between(r, x0, x1), between(r, box.H * 0.14, box.H)),
            dur: f1(between(r, 4, 9)), delay: -f1(between(r, 0, 9)), a: +between(r, 0.35, 0.9).toFixed(2),
        }));
        const packets = side ? Array.from({ length: 3 }, () => {
            const at = cellAt(between(r, x0, x1), between(r, box.H * 0.2, box.H));
            return { gx: at.gx - CELL * 5, gy: at.gy, run: CELL * Math.round(between(r, 8, 14)), dur: f1(between(r, 6, 11)), delay: -f1(between(r, 0, 11)) };
        }) : [];
        return { matrix: [a, b, c, d, e, f].map(v => +v.toFixed(4)), tiles, packets };
    }, [box, seed, side]);
    return (
        <>
            <svg className="dp-grid" width={box.W} height={box.H}>
                <defs>
                    <pattern id={id} width={CELL} height={CELL} patternUnits="userSpaceOnUse" patternTransform={`matrix(${m.matrix.join(' ')})`}>
                        {/* Each family's width is set so both come out about 1.5 px on screen. */}
                        <path d={`M0 1.5H${CELL}`} strokeWidth="3" />
                        <path d={`M0.8 0V${CELL}`} strokeWidth="1.6" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#${id})`} />
            </svg>
            <div className="dp-grid-space" style={{ transform: `matrix(${m.matrix.join(', ')})` }}>
                {m.tiles.map((t, i) => (
                    <span key={i} className={side ? 'dp-tile d-loop' : 'dp-tile'} style={side ? { left: t.gx, top: t.gy, animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` } : { left: t.gx, top: t.gy, opacity: t.a, animation: 'none' }} />
                ))}
                {m.packets.map((p, i) => (
                    <span key={i} className="dp-packet d-loop" style={css({ left: p.gx, top: p.gy, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, '--run': `${p.run}px` })} />
                ))}
            </div>
            <div className="dp-crt" />
            {side && <span className="dp-radar d-loop" />}
        </>
    );
};

/* ══════════════════════════════════════════════════ MAGE: the Arcane Leyline Sanctum */

/** Conduits down one gutter: lit lines with nodes, taps toward the column, charges of mana. */
const Leylines: React.FC<{ box: Box; seed: string; side: Side }> = ({ box, seed, side }) => {
    const lines = useMemo(() => {
        const r = seeded(`ley:${side}:${seed}`);
        const [x0, x1] = reach(box, side);
        const width = x1 - x0, inward = side === 'l' ? 1 : -1;
        const at = width >= 120 ? [0.3, 0.7] : [0.5];
        return at.map(t => ({
            x: f1(side === 'l' ? x0 + width * t : x1 - width * t),
            nodes: Array.from({ length: 3 }, (_, i) => ({ y: f1(box.H * (0.24 + i * 0.26 + between(r, -0.06, 0.06))), tap: width >= 60 ? Math.round(between(r, 34, Math.min(96, width * 0.7))) : 0 })),
            charges: Array.from({ length: 2 }, () => ({ dur: f1(between(r, 5.5, 9)), delay: -f1(between(r, 0, 9)) })),
            inward,
        }));
    }, [box, seed, side]);
    return (
        <>
            {lines.map((l, i) => (
                <div key={i} className="dp-ley-wrap" data-x={l.x} style={{ left: l.x }}>
                <div className="dp-ley">
                    {l.nodes.map((n, j) => (
                        <React.Fragment key={j}>
                            {n.tap > 0 && <span className="dp-ley-tap" style={css({ top: n.y, width: n.tap, left: l.inward > 0 ? 0 : -n.tap, '--to': l.inward > 0 ? 'to right' : 'to left' })} />}
                            <span className="dp-ley-node" style={{ top: n.y - 5 }} />
                        </React.Fragment>
                    ))}
                    {l.charges.map((c, j) => <span key={j} className="dp-ley-charge d-loop" style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />)}
                </div>
                </div>
            ))}
        </>
    );
};

const MageMatter: React.FC<MatterProps> = ({ box, seed, side }) => {
    // The crystalline ground: a jittered triangular lattice, its facets in four depths of tint.
    const facets = useMemo(() => {
        const r = seeded(`tess:${seed}`);
        const s = 132, rowH = s * 0.866;
        const cols = Math.ceil(box.W / s) + 3, rows = Math.ceil(box.H / rowH) + 3;
        const pts: Point[][] = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => ({
            x: (i - 1 + (j % 2) * 0.5) * s + between(r, -26, 26), y: (j - 1) * rowH + between(r, -22, 22),
        })));
        const depth = ['', '', '', ''];
        const tri = (a: Point, b: Point, c: Point) => {
            const roll = r();
            depth[roll < 0.5 ? 0 : roll < 0.74 ? 1 : roll < 0.92 ? 2 : 3] += `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}L${f1(c.x)} ${f1(c.y)}Z`;
        };
        for (let j = 0; j < rows - 1; j++) {
            for (let i = 0; i < cols - 1; i++) {
                const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], d = pts[j + 1][i + 1];
                if (j % 2) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
            }
        }
        return depth;
    }, [box.W, box.H, seed]);
    return (
        <>
            <svg className="dp-tess" width={box.W} height={box.H}>
                {facets.map((d, i) => <path key={i} d={d} fillOpacity={[0, 0.05, 0.1, 0.17][i]} />)}
            </svg>
            {side && <Leylines box={box} seed={seed} side={side} />}
        </>
    );
};

/* ═════════════════════════════════════════════════ CONSTELLATION: the Star Stream Void */

const ConstellationMatter: React.FC<MatterProps> = ({ box, isDark, seed, side }) => {
    const p = paletteOf(isDark);
    const dustUrl = useBaked(`dust:${isDark ? 'd' : 'l'}`, () => dustField(7, isDark ? p.glow : p.shade, isDark ? p.crown : p.glow, isDark ? 0.3 : 0.36));
    const stream = useMemo(() => starTile('plane', 640, 110, 170, isDark ? '251, 191, 36' : '91, 33, 182', isDark ? '255, 244, 214' : '46, 16, 101'), [isDark]);
    const tex = { dust: dustUrl ? `url(${dustUrl})` : 'none', stream };
    const sky = useMemo(() => {
        const r = seeded(`sky:${seed}`);
        const { W, H } = box;
        // A third of the stars gather along the stream's diagonal (bottom-left to top-right).
        const len = Math.hypot(W, H), nx = H / len, ny = W / len;
        let dots = '', glints = '';
        for (let i = Math.round((W * H) / 6200); i > 0; i--) {
            let x = r() * W, y = r() * H;
            if (r() < 0.36) {
                const t = r(), off = (r() + r() + r() - 1.5) * 90;
                x = t * W + nx * off; y = H - t * H + ny * off;
            }
            const size = between(r, 0.5, 1.5);
            if (r() < 0.06) glints += `M${f1(x - 6)} ${f1(y)}H${f1(x + 6)}M${f1(x)} ${f1(y - 6)}V${f1(y + 6)}`;
            dots += `M${f1(x)} ${f1(y)}m${f1(-size)} 0a${f1(size)} ${f1(size)} 0 1 0 ${f1(size * 2)} 0a${f1(size)} ${f1(size)} 0 1 0 ${f1(-size * 2)} 0`;
        }
        return { dots, glints, len: Math.round(len), angle: f1((-Math.atan2(H, W) * 180) / Math.PI) };
    }, [box, seed]);
    const web = useMemo(() => {
        if (!side) return null;
        const r = seeded(`web:${side}:${seed}`);
        const [x0, x1] = reach(box, side);
        const width = x1 - x0;
        const nodes = Array.from({ length: 5 }, (_, i) => ({
            x: f1(x0 + width * between(r, 0.14, 0.84)), y: f1(box.H * (0.15 + i * 0.185 + between(r, -0.04, 0.04))),
            dur: f1(between(r, 3, 6.5)), delay: -f1(between(r, 0, 6.5)),
        }));
        // The thread runs node to node, and off the screen's edge from the first and the last.
        const edge = side === 'l' ? -8 : box.W + 8;
        const path = lineOf([{ x: edge, y: nodes[0].y - 70 }, ...nodes, { x: edge, y: nodes[4].y + 60 }]);
        return { nodes, path };
    }, [box, seed, side]);
    const stars = (
        <svg className="dp-stars" width={box.W} height={box.H}>
            <path d={sky.dots} fill="rgb(var(--d-star))" fillOpacity="0.85" />
            <path d={sky.glints} stroke="rgb(var(--d-star))" strokeWidth="1" fill="none" />
        </svg>
    );
    if (!web) return <><div className="dp-dust" style={{ backgroundImage: tex.dust }} />{stars}</>;
    return (
        <>
            <div className="dp-dust-drift d-loop" style={{ backgroundImage: tex.dust }} />
            {stars}
            {/* The star stream: a river of stars along the diagonal, flowing to the top-right. */}
            <div className="dp-stream" style={{ left: 0, top: box.H, width: sky.len, rotate: `${sky.angle}deg` }}>
                <span className="d-loop" style={{ backgroundImage: tex.stream }} />
            </div>
            <svg className="dp-stars" width={box.W} height={box.H}>
                <path d={web.path} className="dp-thread-glow" />
                <path d={web.path} className="dp-thread" />
            </svg>
            {web.nodes.map((n, i) => <span key={i} className="dp-node d-loop" style={{ left: n.x, top: n.y, animationDuration: `${n.dur}s`, animationDelay: `${n.delay}s` }} />)}
        </>
    );
};

/* ══════════════════════════════════════════════════ IRREGULAR: the Dimensional Fracture */

const IrregularMatter: React.FC<MatterProps> = ({ box, seed, side }) => {
    const f = useMemo(() => {
        const r = seeded(`perimeter:${seed}`);
        const { W, H } = box;
        // Where each fracture enters from the screen's edge. All of them run inward.
        const roots: Point[] = [
            { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H },
            ...[0.24, 0.52, 0.8].map(t => ({ x: 0, y: H * (t + between(r, -0.07, 0.07)) })),
            ...[0.2, 0.48, 0.76].map(t => ({ x: W, y: H * (t + between(r, -0.07, 0.07)) })),
            ...[0.3, 0.72].map(t => ({ x: W * (t + between(r, -0.08, 0.08)), y: 0 })),
            ...[0.26, 0.7].map(t => ({ x: W * (t + between(r, -0.08, 0.08)), y: H })),
        ];
        const scale = Math.min(1, Math.max(0.55, W / 1100));
        const cracks = roots.map(p => {
            const inward = Math.atan2(H / 2 - p.y, W / 2 - p.x) + between(r, -0.55, 0.55);
            const main = jag(r, p, inward, 6 + Math.floor(r() * 4), 34 * scale, 78 * scale);
            const twigs: Point[][] = [];
            for (let b = 1 + Math.floor(r() * 2); b > 0; b--) {
                const at = 1 + Math.floor(r() * (main.length - 2));
                const dir = Math.atan2(main[at].y - main[at - 1].y, main[at].x - main[at - 1].x) + (r() < 0.5 ? -1 : 1) * between(r, 0.5, 1.1);
                twigs.push(jag(r, main[at], dir, 2 + Math.floor(r() * 3), 18 * scale, 44 * scale));
            }
            return { main, twigs, every: f1(between(r, 3.4, 8)), wait: -f1(between(r, 0, 8)) };
        });
        // Shards: the glass between a corner's fracture and the next one along each edge.
        const pairs: [number, number][] = [[0, 4], [0, 10], [1, 7], [1, 11], [2, 9], [2, 13], [3, 6], [3, 12]];
        const shards = pairs.filter(() => r() < 0.7).map(([a, b]) => ({
            d: `${lineOf([...cracks[a].main, ...cracks[b].main.slice().reverse()])}Z`, a: +between(r, 0.05, 0.14).toFixed(2),
        }));
        return { cracks, shards };
    }, [box, seed]);
    const [x0, x1] = side ? reach(box, side) : [0, 0];
    const mine = side ? f.cracks.filter(c => c.main[0].x >= x0 - 1 && c.main[0].x <= x1 + 1) : [];
    return (
        <>
            <svg className="dp-cracks dp-cracks-glow" width={box.W} height={box.H}>
                {f.cracks.flatMap((c, i) => [c.main, ...c.twigs].map((p, j) => <path key={`${i}-${j}`} d={lineOf(p)} />))}
            </svg>
            <svg className="dp-cracks" width={box.W} height={box.H}>
                {f.shards.map((s, i) => <path key={`s${i}`} d={s.d} className="dp-shard" fillOpacity={s.a} />)}
                {f.cracks.map((c, i) => (
                    <React.Fragment key={i}>
                        <path d={lineOf(c.main)} className="dp-crack" />
                        {c.twigs.map((t, j) => <path key={j} d={lineOf(t)} className="dp-crack dp-crack-twig" />)}
                    </React.Fragment>
                ))}
            </svg>
            {side && (
                <>
                    <svg className="dp-cracks" width={box.W} height={box.H}>
                        {mine.map((c, i) => <path key={i} d={lineOf(c.main)} pathLength={1} className="dm-spark-run d-loop" style={{ animationDuration: `${c.every}s`, animationDelay: `${c.wait}s` }} />)}
                    </svg>
                    <Glitches box={box} seed={`${seed}:${side}`} count={3} />
                </>
            )}
        </>
    );
};

/** The micro-glitch: bands of the screen that twitch for 80 ms, a fragment of hex beside each. */
const Glitches: React.FC<{ box: Box; seed: string; count: number }> = ({ box, seed, count }) => {
    const bars = useMemo(() => {
        const r = seeded(`glitch:${seed}`) as Rand;
        return Array.from({ length: count }, () => ({
            x: f1(between(r, 0, box.W * 0.6)), y: f1(between(r, box.H * 0.12, box.H * 0.94)), w: Math.round(between(r, box.W * 0.16, box.W * 0.44)), h: f1(between(r, 2, 8)),
            dur: f1(between(r, 6, 13)), delay: -f1(between(r, 0, 13)), text: HEX[Math.floor(r() * HEX.length)],
        }));
    }, [box, seed, count]);
    return (
        <>
            {bars.map((b, i) => (
                <span key={i} className="dp-glitch d-loop" style={{ left: b.x, top: b.y, width: b.w, height: b.h, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>
                    <span className="dp-hex font-mono">{b.text}</span>
                </span>
            ))}
        </>
    );
};

/* ══════════════════════════════════════════════════════════════════════════ THE BACKPLANE */

const MATTER: Record<Realm, React.FC<MatterProps>> = { NECROMANCER: NecroMatter, PLAYER: PlayerMatter, MAGE: MageMatter, CONSTELLATION: ConstellationMatter, IRREGULAR: IrregularMatter };

/** A gutter narrower than this has no room for living matter (a phone, a narrow tablet). */
const GUTTER_MIN = 56;
/** How far a gutter's strip reaches into the content column, fading out as it goes. */
const GUTTER_REACH = 40;

interface DomainBackplaneProps {
    realm: Realm;
    isDark: boolean;
    /** Show the settled domain and hold it: low-power mode or reduced motion. */
    still?: boolean;
    /** Seeds the layout: the series id, so a series keeps its domain. */
    seed: string;
    /** The cover: the expansion's epicenter. */
    coverRef: React.RefObject<HTMLElement>;
    /** An element as wide as the content column (the hero section). */
    columnRef: React.RefObject<HTMLElement>;
    /** The page's scrolling column: the Mage's leylines break around the dais as it scrolls. */
    scrollRef?: React.RefObject<HTMLElement>;
}

/** The dais's outer ticks reach 0.973 cover widths from the cover's centre (DomainShroud's
 *  wheel); a leyline breaks this far beyond them. */
const DAIS_REACH = 0.973, DAIS_CLEAR = 26;

const DomainBackplane: React.FC<DomainBackplaneProps> = ({ realm, isDark, still = false, seed, coverRef, columnRef, scrollRef }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<Box | null>(null);

    // Measured after the page's first commit (so the content's refs are set), and again when the
    // screen changes size. The epicenter is taken once: the shockwave has gone by then.
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        let epicenter: { ex: number; ey: number } | null = null;
        const measure = () => {
            const fr = root.getBoundingClientRect();
            if (!fr.width || !fr.height) return;
            const col = columnRef.current?.getBoundingClientRect();
            const cover = coverRef.current?.getBoundingClientRect();
            epicenter ??= cover && cover.width
                ? { ex: Math.round(cover.left + cover.width / 2 - fr.left), ey: Math.round(cover.top + cover.height / 2 - fr.top) }
                : { ex: Math.round(fr.width / 2), ey: Math.round(fr.height * 0.4) };
            const next: Box = {
                W: Math.round(fr.width), H: Math.round(fr.height),
                l: col && col.width ? Math.max(0, Math.round(col.left - fr.left)) : 0,
                r: col && col.width ? Math.min(Math.round(fr.width), Math.round(col.right - fr.left)) : Math.round(fr.width),
                ...epicenter,
            };
            setBox(prev => (prev && prev.W === next.W && prev.H === next.H && prev.l === next.l && prev.r === next.r ? prev : next));
        };
        // First measured a task after the page's own commit (see DomainShroud), then on resize.
        const first = setTimeout(measure, 0);
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        return () => { clearTimeout(first); ro.disconnect(); };
    }, [coverRef, columnRef]);

    // MAGE: each leyline the dais's circle crosses breaks where it crosses, wherever the dais is
    // now. The lines are fixed to the screen and the dais scrolls with the page, so the break is
    // re-measured on scroll (once a frame), on resize, and once the page has risen into place.
    useEffect(() => {
        const root = rootRef.current;
        if (realm !== 'MAGE' || !box || !root) return;
        let raf = 0;
        const update = () => {
            raf = 0;
            const fr = root.getBoundingClientRect();
            const cover = coverRef.current?.getBoundingClientRect();
            if (!cover || !cover.width) return;
            const cx = cover.left + cover.width / 2 - fr.left, cy = cover.top + cover.height / 2 - fr.top;
            const R = cover.width * DAIS_REACH + DAIS_CLEAR;
            root.querySelectorAll<HTMLElement>('.dp-ley-wrap').forEach((el) => {
                const dx = Math.abs(Number(el.dataset.x) - cx);
                const h = dx < R ? Math.sqrt(R * R - dx * dx) : -1;
                el.style.setProperty('--ga', h < 0 ? '-99999px' : `${Math.round(cy - h)}px`);
                el.style.setProperty('--gb', h < 0 ? '-99999px' : `${Math.round(cy + h)}px`);
            });
        };
        const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        const settle = setTimeout(update, 900);
        const scroller = scrollRef?.current;
        scroller?.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(settle);
            scroller?.removeEventListener('scroll', queue);
            window.removeEventListener('resize', queue);
        };
    }, [realm, box, coverRef, scrollRef]);

    const Matter = MATTER[realm];
    const gutters = box ? ([['l', box.l], ['r', box.W - box.r]] as [Side, number][]).filter(([, width]) => width >= GUTTER_MIN) : [];

    return (
        <div
            ref={rootRef}
            className="domain dp-root d-in"
            data-realm={realm}
            data-tone={isDark ? 'dark' : 'light'}
            data-still={still ? '' : undefined}
            style={box ? css({ '--ex': `${box.ex}px`, '--ey': `${box.ey}px` }) : undefined}
            aria-hidden="true"
        >
            <div className="dp-light" />
            {box && (
                <>
                    <div className="dp-still"><Matter box={box} isDark={isDark} seed={seed} /></div>
                    {gutters.map(([side, width]) => (
                        <div key={side} className={`dp-gutter dp-gutter-${side}`} style={{ width: width + GUTTER_REACH }}>
                            <div className="dp-gutter-fill" style={{ width: box.W }}><Matter box={box} isDark={isDark} seed={seed} side={side} /></div>
                        </div>
                    ))}
                    {/* A phone has no gutters, but a leyline still runs down each edge of the glass. */}
                    {realm === 'MAGE' && gutters.length === 0 && (['l', 'r'] as const).map(side => (
                        <Leylines key={side} box={{ ...box, l: 12, r: box.W - 12 }} seed={seed} side={side} />
                    ))}
                    <div className="dp-passes">
                        {realm === 'PLAYER' && <span className="dp-radar d-loop" />}
                        {realm === 'IRREGULAR' && <Glitches box={box} seed={seed} count={5} />}
                    </div>
                    <span className="dp-ring d-in" />
                </>
            )}
        </div>
    );
};

export default React.memo(DomainBackplane);
