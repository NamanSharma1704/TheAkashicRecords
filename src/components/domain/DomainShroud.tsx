import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HEX, Point, Realm, Rand, between, f1, jag, lineOf, paletteOf, seeded, starTile } from './realms';
import { nebulaDisc, smokeDisc, useBaked, vortexDisc } from './textures';
import './domain.css';

/**
 * The Hero Shroud: tier 1 of a class domain (Feature 30). The epicenter, anchored to the cover
 * and the title, in the page's scroll flow, at full intensity.
 *
 *   part="cover"  a square 3.2 covers wide, centred on the cover and painted behind it. Drawn
 *                 in a 1000-unit box; the cover sits at COVER inside it.
 *   part="title"  behind the title stack (rank, class, title, native title). No slab under
 *                 the words: the stack's text carries a halo of the page's own ground instead
 *                 (.domain-ink, domain.css), hugging each letter, so the domain shows right up
 *                 to them and costs them no contrast.
 *
 * Every motion is a transform or an opacity on its own element. `still` (low-power mode,
 * reduced motion) shows the settled domain and stops.
 */

/** The cover's box inside the 1000-unit shroud (a 2:3 cover, 1000 / 3.2 units wide). */
const COVER = { x0: 344, x1: 656, y0: 268, y1: 732 };
const pct = (units: number) => `${f1(units / 10)}%`;
const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;

interface PartProps {
    isDark: boolean;
    seed: string;
    /** The series' chapter and its known total (0: unknown), for readouts that must be real. */
    chapter?: number;
    total?: number;
}

/* ══════════════════════════════════════════════════════ NECROMANCER: the Abyssal Crypt */

/** A tendril of shadow: a ribbon that tapers as it climbs, in a `w` by `h` box, rooted bottom-centre. */
const tendrilPath = (r: Rand, w: number, h: number, lean: number, root: number): string => {
    const N = 18, phase = between(r, 0, 6.28), turns = between(r, 0.9, 1.6), sway = w * between(r, 0.12, 0.2);
    const left: string[] = [], right: string[] = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const cx = w / 2 + lean * t * t * w * 0.3 + Math.sin(phase + t * turns * Math.PI * 2) * sway * t;
        const half = Math.max(0.4, root * (1 - t) ** 1.3);
        left.push(`${f1(cx - half)} ${f1(h - h * t)}`);
        right.unshift(`${f1(cx + half)} ${f1(h - h * t)}`);
    }
    return `M${left.join('L')}L${right.join('L')}Z`;
};

const NecroCover: React.FC<PartProps> = ({ isDark, seed }) => {
    const p = paletteOf(isDark), tone = isDark ? 'd' : 'l';
    const ash = useBaked(`crypt-ash:${tone}`, () => smokeDisc(29, p.ash, p.glow, isDark ? 0.42 : 0.34));
    const shade = useBaked(`crypt-shade:${tone}`, () => smokeDisc(11, p.shade, p.shade, isDark ? 0.96 : 0.62, 1.5));
    const parts = useMemo(() => {
        const r = seeded(`crypt:${seed}`);
        const side = (i: number) => (i % 2 ? 1 : -1);
        return {
            tendrils: Array.from({ length: 8 }, (_, i) => {
                const s = side(i), w = 120, h = between(r, 300, 560);
                // The far side spreads out; the title's side (right, from md) keeps close and
                // leans in, so no shadow climbs behind the title's first letters.
                const x = s < 0 ? COVER.x0 - between(r, -14, 96) : COVER.x1 + between(r, -18, 22);
                return {
                    x, w, h,
                    d: tendrilPath(r, w, h, s < 0 ? -between(r, -0.4, 1) : -between(r, 0.2, 0.9), between(r, 9, 17)),
                    dur: f1(between(r, 7, 12)), delay: -f1(between(r, 0, 12)), tilt: f1(between(r, 1.6, 3.4) * s),
                };
            }),
            motes: Array.from({ length: 16 }, (_, i) => {
                const s = side(i), dur = between(r, 6, 11);
                return {
                    x: s < 0 ? COVER.x0 - between(r, -6, 170) : COVER.x1 + between(r, -6, 170),
                    y: between(r, 610, 790), size: f1(between(r, 2, 3.6)), dur: f1(dur), delay: -f1(r() * dur),
                    dx: Math.round(between(r, -40, 40)), rise: Math.round(between(r, 170, 380)), a: +between(r, 0.55, 1).toFixed(2),
                };
            }),
            souls: Array.from({ length: 3 }, (_, i) => {
                const s = side(i), dur = between(r, 10, 15);
                return {
                    x: s < 0 ? COVER.x0 - between(r, 30, 120) : COVER.x1 + between(r, 30, 120),
                    y: between(r, 690, 760), dur: f1(dur), delay: -f1(r() * dur), rise: Math.round(between(r, 300, 430)),
                    sway: f1(between(r, 2.2, 3.4)), reach: Math.round(between(r, 10, 22) * s),
                };
            }),
        };
    }, [seed]);
    return (
        <>
            <div className="dm-crypt-pool d-loop" />
            {ash && <img className="dm-disc dm-crypt-ash d-loop" src={ash} alt="" draggable={false} />}
            {shade && <img className="dm-disc dm-crypt-shade d-loop" src={shade} alt="" draggable={false} />}
            {parts.tendrils.map((t, i) => (
                <div
                    key={i}
                    className="dm-tendril d-loop"
                    style={css({ left: pct(t.x - t.w / 2), top: pct(COVER.y1 + 16 - t.h), width: pct(t.w), height: pct(t.h), animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s`, '--tilt': `${t.tilt}deg` })}
                >
                    <svg viewBox={`0 0 ${t.w} ${f1(t.h)}`} preserveAspectRatio="none">
                        <path d={t.d} className="dm-tendril-body" />
                    </svg>
                </div>
            ))}
            {parts.motes.map((m, i) => (
                <span
                    key={i}
                    className="dm-mote d-loop"
                    style={css({ left: pct(m.x), top: pct(m.y), width: m.size, height: m.size, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, '--dx': `${m.dx}px`, '--rise': `${m.rise}px`, '--a': m.a })}
                />
            ))}
            {parts.souls.map((s, i) => (
                <span key={i} className="dm-soul d-loop" style={css({ left: pct(s.x), top: pct(s.y), animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, '--rise': `${s.rise}px` })}>
                    <i className="d-loop" style={css({ animationDuration: `${s.sway}s`, '--reach': `${s.reach}px` })} />
                </span>
            ))}
        </>
    );
};

const NecroTitle: React.FC<PartProps> = ({ isDark }) => {
    const p = paletteOf(isDark), tone = isDark ? 'd' : 'l';
    const shade = useBaked(`vortex-shade:${tone}`, () => vortexDisc(41, p.shade, p.shade, isDark ? 0.95 : 0.58));
    const ash = useBaked(`vortex-ash:${tone}`, () => vortexDisc(53, p.ash, p.glow, isDark ? 0.4 : 0.3));
    return (
        <div className="dt-vortex">
            {ash && <img className="dt-vortex-arm d-loop" src={ash} alt="" draggable={false} />}
            {shade && <img className="dt-vortex-arm dt-vortex-back d-loop" src={shade} alt="" draggable={false} />}
        </div>
    );
};

/* ═══════════════════════════════════════════════════ PLAYER: the Retinal System Matrix */

const arc = (r: number, from: number, to: number) => {
    const a = (from * Math.PI) / 180, b = (to * Math.PI) / 180;
    return `M${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f1(r * Math.cos(b))} ${f1(r * Math.sin(b))}`;
};

const PlayerCover: React.FC<PartProps> = () => {
    let ticks = '';
    for (let i = 0; i < 120; i++) {
        const a = (i * 3 * Math.PI) / 180, out = 318 + (i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5);
        ticks += `M${f1(318 * Math.cos(a))} ${f1(318 * Math.sin(a))}L${f1(out * Math.cos(a))} ${f1(out * Math.sin(a))}`;
    }
    return (
        <>
            {/* The ring's sector: it opens toward the title (right beside it, down on a phone),
                so neither the reticle nor its glow ever passes behind the status window. The
                rings turn inside the still opening. */}
            <div className="dm-sector">
                <div className="dm-holo-glow d-loop" />
                <div className="dm-holo-scan" />
                {/* The targeting ring: a graduated outer ring, and three heavy arcs that hunt inside it. */}
                <div className="dm-reticle d-loop">
                    <svg viewBox="-340 -340 680 680">
                        <circle r="318" className="dm-line-soft" />
                        <path d={ticks} className="dm-line" />
                        <path d={`${arc(332, -18, 18)}${arc(332, 72, 108)}${arc(332, 162, 198)}${arc(332, 252, 288)}`} className="dm-line-heavy" />
                    </svg>
                </div>
                <div className="dm-reticle dm-reticle-in d-loop">
                    <svg viewBox="-340 -340 680 680">
                        <path d={`${arc(296, 8, 74)}${arc(296, 128, 194)}${arc(296, 248, 314)}`} className="dm-line-heavy dm-line-dim" />
                        <path d={`${arc(284, 80, 122)}${arc(284, 200, 242)}${arc(284, 320, 362)}`} className="dm-line" />
                    </svg>
                </div>
            </div>
            {/* Lock brackets: four corner reticles that close on the frame and hold. */}
            <div className="dm-lock">
                {(['tl', 'tr', 'bl', 'br'] as const).map((c, i) => (
                    <span key={c} className={`dm-lock-corner dm-lock-${c} d-in`} style={{ animationDelay: `${f1(0.75 + i * 0.07)}s` }}>
                        <i className="d-loop" />
                    </span>
                ))}
                <span className="dm-lock-rail dm-lock-rail-l" />
                <span className="dm-lock-rail dm-lock-rail-r" />
                {/* The optical scan: one beam, in step with the cover's own scanline, wider than the art. */}
                <span className="dm-laser d-loop" />
            </div>
            <div className="dm-lock-label font-mono d-in">
                <i className="d-loop" />[ TARGET: RECORD_LOCKED ]
            </div>
        </>
    );
};

/** The gauge's segments: one lit per twelfth of the series read. */
const GAUGE = 12;

/**
 * The System's status window, fitted to the title stack (which pads itself to hold it): an
 * asymmetric octagon, two small cuts and two large ones, the large ones edged in gold as the
 * kit's ears. A title bar straddles the top edge (a filled STATUS_WINDOW tab, a graduated rule,
 * the chapter readout, slashes against the ear); the body is glass with scan lines and a sweep;
 * a segmented sync gauge runs down the left edge; the SYNC readout sits on the foot. Every
 * figure is the series' own: its chapter, its known total, the share read. With no total on
 * record the window says only the chapter, and the gauge stays dark.
 */
const PlayerTitle: React.FC<PartProps> = ({ chapter = 0, total = 0 }) => {
    const known = total > 0;
    const share = known ? Math.min(1, chapter / total) : 0;
    const lit = Math.round(share * GAUGE);
    return (
        <div className="dt-sw d-in">
            <span className="dt-sw-glass" />
            <span className="dt-sw-sweep d-loop" />
            <span className="dt-sw-edge" />
            <span className="dt-sw-cut dt-sw-cut-tl" />
            <span className="dt-sw-cut dt-sw-cut-br" />
            <span className="dt-sw-ear dt-sw-ear-tr" />
            <span className="dt-sw-ear dt-sw-ear-bl" />
            <span className="dt-sw-gauge">
                {Array.from({ length: GAUGE }, (_, i) => <i key={i} className={i < lit ? 'on' : undefined} />)}
            </span>
            <div className="dt-sw-head">
                <span className="dt-sw-tab font-mono"><i className="d-loop" />STATUS_WINDOW</span>
                <span className="dt-sw-rule" />
                <span className="dt-sw-read font-mono">CH {chapter}{known ? ` / ${total}` : ''}</span>
                <span className="dt-sw-hash" />
            </div>
            {known && <span className="dt-sw-foot font-mono">SYNC {Math.round(share * 100)}%</span>}
        </div>
    );
};

/* ══════════════════════════════════════════════════ MAGE: the Arcane Leyline Sanctum */

/** Rune marks in a 10 x 14 box about the origin: line glyphs, not any real script. */
const RUNES = [
    'M0 -7V7M-4 -3L4 3', 'M-4 -7V7M-4 -7L4 0L-4 7', 'M-4 7L0 -7L4 7M-2 1H2', 'M0 -7V7M-4 -7L4 -1',
    'M-4 -7L4 7M4 -7L-4 7', 'M-4 -6H4L-4 6H4', 'M0 -7L4 0L0 7L-4 0Z', 'M-4 7V-7L0 -3L4 -7V7',
];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** The star polygon {n/k} on radius `r`. */
const starPath = (n: number, k: number, r: number): string => {
    const g = gcd(n, k);
    let d = '';
    for (let j = 0; j < g; j++) {
        for (let i = 0; i < n / g; i++) {
            const a = -Math.PI / 2 + (((j + i * k) % n) * 2 * Math.PI) / n;
            d += `${i ? 'L' : 'M'}${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`;
        }
        d += 'Z';
    }
    return d;
};
const onRing = (r: number, deg: number) => `rotate(${f1(deg)}) translate(0 ${f1(-r)})`;

const MageCover: React.FC<PartProps> = ({ seed }) => {
    const runes = useMemo(() => {
        const r = seeded(`dais:${seed}`);
        return Array.from({ length: 32 }, (_, i) => (i % 4 === 3 ? -1 : Math.floor(r() * RUNES.length)));
    }, [seed]);
    let ticks = '';
    for (let i = 0; i < 72; i++) {
        const a = (i * 5 * Math.PI) / 180, out = 291 + (i % 6 === 0 ? 13 : 6);
        ticks += `M${f1(291 * Math.cos(a))} ${f1(291 * Math.sin(a))}L${f1(out * Math.cos(a))} ${f1(out * Math.sin(a))}`;
    }
    return (
        <>
            <div className="dm-dais-aura d-loop" />
            <div className="dm-dais-rays d-loop" />
            <span className="dm-dais-pulse d-loop" />
            <span className="dm-dais-pulse d-loop" style={{ animationDelay: '-3s' }} />
            {/* The outer runic wheel, clockwise. Three motes of mana ride it. */}
            <div className="dm-wheel dm-wheel-outer d-loop">
                <svg viewBox="-320 -320 640 640">
                    <circle r="291" className="dm-line-heavy" />
                    <circle r="268" className="dm-line" />
                    <path d={ticks} className="dm-line" />
                    {runes.map((g, i) => (g < 0
                        ? <circle key={i} r="2.2" transform={onRing(279.5, i * 11.25)} className="dm-dot" />
                        : <path key={i} d={RUNES[g]} transform={`${onRing(279.5, i * 11.25)} scale(1.15)`} className="dm-line" vectorEffect="non-scaling-stroke" />))}
                    {[0, 90, 180, 270].map(a => <path key={a} d="M0 -9L7 0L0 9L-7 0Z" transform={onRing(291, a)} className="dm-seal" />)}
                    {[40, 160, 280].map(a => (
                        <g key={a} transform={onRing(279.5, a)}>
                            <circle r="9" className="dm-halo" />
                            <circle r="3.4" className="dm-spark" />
                        </g>
                    ))}
                </svg>
            </div>
            {/* Seven seals on a dashed ring, drifting the other way at half the wheel's pace. */}
            <div className="dm-wheel dm-wheel-seals d-loop">
                <svg viewBox="-320 -320 640 640">
                    <circle r="247" className="dm-line dm-dashed" />
                    {Array.from({ length: 7 }, (_, i) => (
                        <g key={i} transform={onRing(247, (i * 360) / 7)}>
                            <circle r="15" className="dm-seal" />
                            <path d={starPath(3, 1, 9)} className="dm-line" />
                        </g>
                    ))}
                </svg>
            </div>
            {/* The inner star, counter-clockwise, three turns to the wheel's two. */}
            <div className="dm-wheel dm-wheel-star d-loop">
                <svg viewBox="-320 -320 640 640">
                    <circle r="228" className="dm-line" />
                    <path d={starPath(7, 3, 228)} className="dm-line-heavy" />
                    <path d={starPath(7, 2, 228)} className="dm-line dm-line-dim" />
                </svg>
            </div>
        </>
    );
};

const MageTitle: React.FC<PartProps> = () => (
    <div className="dt-leyline">
        <span className="dt-leyline-pulse d-loop" />
    </div>
);

/* ═════════════════════════════════════════════════ CONSTELLATION: the Star Stream Void */

const ConstellationCover: React.FC<PartProps> = ({ isDark, seed }) => {
    const p = paletteOf(isDark), tone = isDark ? 'd' : 'l';
    const core = useBaked(`nebula-core:${tone}`, () => nebulaDisc(5, p.glow, isDark ? p.crown : p.shade, isDark ? 0.62 : 0.5));
    const veil = useBaked(`nebula-veil:${tone}`, () => nebulaDisc(17, isDark ? p.ash : p.shade, p.glow, isDark ? 0.4 : 0.42));
    const stream = useMemo(() => starTile('stream', 640, 110, 150, isDark ? '251, 191, 36' : '91, 33, 182', isDark ? '255, 244, 214' : '46, 16, 101'), [isDark]);
    const glints = useMemo(() => {
        const r = seeded(`void:${seed}`);
        return Array.from({ length: 16 }, () => {
            const a = between(r, 0, Math.PI * 2), d = between(r, 190, 440);
            return { x: 500 + Math.cos(a) * d * 0.82, y: 500 + Math.sin(a) * d, size: f1(between(r, 5, 12)), dur: f1(between(r, 2.6, 6)), delay: -f1(between(r, 0, 6)) };
        });
    }, [seed]);
    return (
        <>
            <div className="dm-breathe d-loop">{veil && <img className="dm-disc dm-nebula-veil d-loop" src={veil} alt="" draggable={false} />}</div>
            <div className="dm-breathe dm-breathe-b d-loop">{core && <img className="dm-disc dm-nebula-core d-loop" src={core} alt="" draggable={false} />}</div>
            {/* The star stream: a river of stars running behind the cover. */}
            <div className="dm-stream">
                <span className="d-loop" style={{ backgroundImage: stream }} />
            </div>
            <div className="dm-rim d-loop" />
            {glints.map((g, i) => (
                <span key={i} className="dm-glint d-loop" style={css({ left: pct(g.x), top: pct(g.y), '--s': `${g.size}px`, animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` })} />
            ))}
        </>
    );
};

interface Threads { w: number; h: number; star: { x: number; y: number }; paths: string[]; nodes: { x: number; y: number }[] }

/**
 * The crown: a four-point flare above the title's far end, with destiny threads running from it
 * to the rank emblem and out to two lesser stars. Laid out from the title stack as it stands.
 */
const ConstellationTitle: React.FC<PartProps> = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [t, setT] = useState<Threads | null>(null);
    useLayoutEffect(() => {
        const root = ref.current, stack = root?.parentElement?.parentElement;
        if (!root || !stack) return;
        const measure = () => {
            const box = root.getBoundingClientRect();
            const title = stack.querySelector('h1')?.getBoundingClientRect();
            const rank = stack.querySelector('[data-domain-anchor="rank"]')?.getBoundingClientRect();
            if (!title || !rank || !box.width) return;
            const star = { x: Math.min(title.right + 8, box.right - 34) - box.left, y: title.top - 12 - box.top };
            const emblem = { x: rank.left + rank.width / 2 - box.left, y: rank.top - 3 - box.top };
            const far = { x: Math.min(star.x + 46, box.width - 10), y: star.y + 44 };
            const high = { x: star.x - 74, y: Math.max(8, star.y - 30) };
            const lift = Math.min(emblem.y, star.y) - 26;
            setT({
                w: box.width, h: box.height, star, nodes: [far, high],
                paths: [
                    `M${f1(star.x)} ${f1(star.y)}C${f1(star.x - (star.x - emblem.x) * 0.3)} ${f1(lift)} ${f1(emblem.x + (star.x - emblem.x) * 0.25)} ${f1(lift)} ${f1(emblem.x)} ${f1(emblem.y)}`,
                    `M${f1(star.x)} ${f1(star.y)}L${f1(far.x)} ${f1(far.y)}`,
                    `M${f1(star.x)} ${f1(star.y)}L${f1(high.x)} ${f1(high.y)}`,
                ],
            });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(stack);
        return () => ro.disconnect();
    }, []);
    return (
        <div ref={ref} className="dt-crown">
            {t && (
                <>
                    <svg width={t.w} height={t.h} viewBox={`0 0 ${f1(t.w)} ${f1(t.h)}`}>
                        {t.paths.map((d, i) => (
                            <React.Fragment key={i}>
                                <path d={d} className="dt-thread-glow" />
                                <path d={d} pathLength={1} className="dt-thread d-in" style={{ animationDelay: `${f1(1 + i * 0.2)}s` }} />
                                <path d={d} pathLength={1} className="dt-thread-pulse d-loop" style={{ animationDelay: `${f1(i * 1.7)}s` }} />
                            </React.Fragment>
                        ))}
                        {t.nodes.map((n, i) => <path key={i} d="M0 -5L4 0L0 5L-4 0Z" transform={`translate(${f1(n.x)} ${f1(n.y)})`} className="dt-node" />)}
                    </svg>
                    <span className="dt-flare d-loop" style={{ left: f1(t.star.x), top: f1(t.star.y) }}><i /></span>
                </>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════ IRREGULAR: the Dimensional Fracture */

const IrregularCover: React.FC<PartProps> = ({ seed }) => {
    const f = useMemo(() => {
        const r = seeded(`rift:${seed}`);
        const { x0, x1, y0, y1 } = COVER;
        // Where each fracture leaves the frame, and the way out from there.
        const roots: [number, number, number][] = [
            [x0, y0, -2.36], [x1, y0, -0.79], [x1, y1, 0.79], [x0, y1, 2.36],
            [x0 + (x1 - x0) * between(r, 0.25, 0.42), y0, -1.57], [x0 + (x1 - x0) * between(r, 0.6, 0.8), y0, -1.57],
            [x0 + (x1 - x0) * between(r, 0.2, 0.42), y1, 1.57], [x0 + (x1 - x0) * between(r, 0.58, 0.82), y1, 1.57],
            [x0, y0 + (y1 - y0) * between(r, 0.22, 0.4), 3.14], [x0, y0 + (y1 - y0) * between(r, 0.6, 0.8), 3.14],
            [x1, y0 + (y1 - y0) * between(r, 0.2, 0.42), 0], [x1, y0 + (y1 - y0) * between(r, 0.58, 0.8), 0],
        ];
        const cracks = roots.map(([x, y, out], i) => {
            const main = jag(r, { x, y }, out + between(r, -0.5, 0.5), 5 + Math.floor(r() * 4), 26, 62);
            const twigs: Point[][] = [];
            for (let b = 1 + Math.floor(r() * 2); b > 0; b--) {
                const at = 1 + Math.floor(r() * (main.length - 2));
                const dir = Math.atan2(main[at + 1 < main.length ? at + 1 : at].y - main[at - 1].y, main[at + 1 < main.length ? at + 1 : at].x - main[at - 1].x) + (r() < 0.5 ? -1 : 1) * between(r, 0.5, 1.1);
                twigs.push(jag(r, main[at], dir, 2 + Math.floor(r() * 3), 14, 34));
            }
            return { main, twigs, delay: f1(0.5 + i * 0.05), every: f1(between(r, 3.2, 7)), wait: -f1(between(r, 0, 7)) };
        });
        // Shards: the glass between two neighbouring fractures, each at its own tilt of light.
        const pairs: [number, number][] = [[0, 4], [4, 5], [5, 1], [1, 10], [10, 11], [11, 2], [2, 7], [7, 6], [6, 3], [3, 9], [9, 8], [8, 0]];
        const shards = pairs.filter(() => r() < 0.6).map(([a, b]) => {
            const A = cracks[a].main, B = cracks[b].main;
            return { d: `${lineOf([...A, ...B.slice().reverse()])}Z`, a: +between(r, 0.05, 0.16).toFixed(2) };
        });
        const slices = Array.from({ length: 4 }, () => ({
            x: between(r, 150, 700), y: between(r, 200, 800), w: between(r, 60, 190), h: f1(between(r, 2, 7)),
            dur: f1(between(r, 4.5, 9)), delay: -f1(between(r, 0, 9)),
        }));
        const hex = [0, 1].map(i => {
            const end = cracks[[1, 9][i]].main;
            const p = end[end.length - 1];
            return { x: p.x, y: p.y, text: HEX[Math.floor(r() * HEX.length)], dur: f1(between(r, 6, 10)), delay: -f1(between(r, 0, 10)) };
        });
        return { cracks, shards, slices, hex };
    }, [seed]);
    const all = f.cracks.flatMap(c => [c.main, ...c.twigs]);
    return (
        <>
            <div className="dm-rim dm-rim-rift d-loop" />
            <svg className="dm-fracture dm-fracture-glow" viewBox="0 0 1000 1000">
                {all.map((p, i) => <path key={i} d={lineOf(p)} />)}
            </svg>
            <svg className="dm-fracture" viewBox="0 0 1000 1000">
                {f.shards.map((s, i) => <path key={`s${i}`} d={s.d} className="dm-shard" style={{ opacity: s.a }} />)}
                {f.cracks.map((c, i) => (
                    <React.Fragment key={i}>
                        <path d={lineOf(c.main)} pathLength={1} className="dm-crack d-in" style={{ animationDelay: `${c.delay}s` }} />
                        <path d={lineOf(c.main.slice(0, 3))} pathLength={1} className="dm-crack dm-crack-root d-in" style={{ animationDelay: `${c.delay}s` }} />
                        {c.twigs.map((t, j) => <path key={j} d={lineOf(t)} pathLength={1} className="dm-crack dm-crack-twig d-in" style={{ animationDelay: `${f1(c.delay + 0.35)}s` }} />)}
                    </React.Fragment>
                ))}
            </svg>
            {/* Micro-sparks leaping along the seams, each fracture on its own irregular beat. */}
            <svg className="dm-fracture dm-sparks" viewBox="0 0 1000 1000">
                {f.cracks.map((c, i) => <path key={i} d={lineOf(c.main)} pathLength={1} className="dm-spark-run d-loop" style={{ animationDuration: `${c.every}s`, animationDelay: `${c.wait}s` }} />)}
            </svg>
            {f.cracks.slice(0, 8).map((c, i) => (
                <span key={i} className="dm-flash d-loop" style={{ left: pct(c.main[0].x), top: pct(c.main[0].y), animationDuration: `${c.every}s`, animationDelay: `${c.wait}s` }} />
            ))}
            {f.slices.map((s, i) => (
                <span key={i} className="dm-slice d-loop" style={{ left: pct(s.x), top: pct(s.y), width: pct(s.w), height: s.h, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
            ))}
            {f.hex.map((h, i) => (
                <span key={i} className="dm-hex font-mono d-loop" style={{ left: pct(h.x), top: pct(h.y), animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}>{h.text}</span>
            ))}
        </>
    );
};

const IrregularTitle: React.FC<PartProps> = ({ seed }) => {
    const d = useMemo(() => {
        const r = seeded(`seam:${seed}`);
        return lineOf(jag(r, { x: 0, y: 8 }, 0, 12, 22, 44).map(p => ({ x: p.x, y: Math.min(15, Math.max(1, p.y)) })));
    }, [seed]);
    return (
        <div className="dt-seam">
            <svg viewBox="0 0 400 16" preserveAspectRatio="none">
                <path d={d} className="dt-seam-glow" vectorEffect="non-scaling-stroke" />
                <path d={d} pathLength={1} className="dt-seam-line d-in" vectorEffect="non-scaling-stroke" />
                <path d={d} pathLength={1} className="dt-seam-spark d-loop" vectorEffect="non-scaling-stroke" />
            </svg>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════ THE SHROUD */

const COVERS: Record<Realm, React.FC<PartProps>> = { NECROMANCER: NecroCover, PLAYER: PlayerCover, MAGE: MageCover, CONSTELLATION: ConstellationCover, IRREGULAR: IrregularCover };
const TITLES: Record<Realm, React.FC<PartProps>> = { NECROMANCER: NecroTitle, PLAYER: PlayerTitle, MAGE: MageTitle, CONSTELLATION: ConstellationTitle, IRREGULAR: IrregularTitle };

interface DomainShroudProps {
    part: 'cover' | 'title';
    realm: Realm;
    isDark: boolean;
    /** Show the settled domain and hold it: low-power mode or reduced motion. */
    still?: boolean;
    /** Seeds the layout: the series id, so a series keeps its domain. */
    seed: string;
    /** The series' chapter and known total (0: unknown), for the title's readouts. */
    chapter?: number;
    total?: number;
}

const DomainShroud: React.FC<DomainShroudProps> = ({ part, realm, isDark, still = false, seed, chapter, total }) => {
    const Part = (part === 'cover' ? COVERS : TITLES)[realm];
    // Mounted one task after the page: opening a series page and raising its domain in one
    // commit made a single 77 ms task on desktop (the rift opening hitched); apart, each is
    // well under 50 ms. The domain blooms in from 0.36 s, so the task's wait never shows.
    const [on, setOn] = useState(false);
    useEffect(() => { const t = setTimeout(() => setOn(true), 0); return () => clearTimeout(t); }, []);
    return (
        <div
            className={`domain ${part === 'cover' ? 'dm-root' : 'dt-root'} d-in`}
            data-realm={realm}
            data-tone={isDark ? 'dark' : 'light'}
            data-still={still ? '' : undefined}
            aria-hidden="true"
        >
            {on && <Part isDark={isDark} seed={seed} chapter={chapter} total={total} />}
        </div>
    );
};

export default React.memo(DomainShroud);
