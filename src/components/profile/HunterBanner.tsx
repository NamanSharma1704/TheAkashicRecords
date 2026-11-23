import React, { useLayoutEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Theme } from '../../core/types';
import EntityAvatar from '../system/EntityAvatar';
import { InscribeGlyph, TransmitGlyph } from '../system/SystemGlyphs';
import { USER_RANKS, LADDER_SPAN, TRANSCENDENT_FROM, ladderWindow } from '../../utils/ranks';
import CompletionSeal from './CompletionSeal';
import BannerRunes from './BannerRunes';
import './HunterBanner.css';

/**
 * The Hunter Profile's banner (2026-11-14): the owner's own art, the Void's in amber and
 * Arcanum's in violet, in place of the plain header box. Everything is on the banner, together:
 * the hunter, the designation, the completion and the rank ladder (the owner: "the avatar, the
 * banner, ranks and progression to be together").
 *
 *   md and up    the whole art (2000 x 489, its frame lined up with the column; see the CSS):
 *                the hunter in the portal; a title plate in the left sky (the designation
 *                between ruled diamonds, the rank set like an engraved title, the name in the
 *                frame's silver); the completion seal in the right sky. Under it, a strip with
 *                the EXP, the rank ladder and the actions (the owner moved those off the art).
 *   below md     the art is too short at a phone's width to carry words, so the banner is a
 *                panel: the art cropped round the medallion, its sides fading into the plate,
 *                the hunter larger in the portal, the designation on the left and the seal and
 *                tools on the right, the ladder along the panel's foot.
 *
 * The art is redrawn at 74% of its height at full width (`banner-green.mjs`): the medallion, the
 * corner pieces and the dragons keep their shape (an 8% squash), and the filigree between them
 * takes up the width.
 *
 * The banner lives (the effects layer, `.hb-fx`): the corner gems glint in turn, the dragons'
 * eyes kindle, embers rise through the sky, the sky breathes, the portal's core pulses. (A sheen
 * along the silver was tried and taken out at the owner's word.) The gems and the eyes are where the art has them (found by `banner-green.mjs`).
 * Transforms and opacity only; held still under reduced motion and in low-power mode (`still`).
 */

/** The corner gems and the dragons' eyes, as fractions of the art (the same in both themes). */
const GEMS: [number, number][] = [
    [0.0421, 0.0479], [0.9703, 0.0485], [0.954, 0.1763], [0.9493, 0.7899],
    [0.9763, 0.8956], [0.0285, 0.9016], [0.0581, 0.7901], [0.0538, 0.18],
];
const EYES: [number, number][] = [[0.0856, 0.535], [0.9282, 0.533]];
/** Embers: seeded, so they rise in the same places each time. In the two skies. */
const EMBERS = (() => {
    let s = 7;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    return Array.from({ length: 18 }, (_, i) => {
        const left = i % 2 ? 0.62 + r() * 0.26 : 0.12 + r() * 0.26;
        const dur = 7 + r() * 7;
        return { left, top: 0.62 + r() * 0.3, size: 1.6 + r() * 2, dur, delay: -r() * dur, dx: (r() - 0.5) * 40, rise: 0.35 + r() * 0.35 };
    });
})();

const ART = {
    dark: { small: '/hunter/banner-void-800.webp', large: '/hunter/banner-void-1600.webp' },
    light: { small: '/hunter/banner-arcanum-800.webp', large: '/hunter/banner-arcanum-1600.webp' },
};
const RATIO = 2000 / 489;

interface RankLike { name: string; exp?: number; next?: { minExp: number; label: string } | null }

interface HunterBannerProps {
    theme: Theme;
    playerRank: RankLike;
    overallPct: number;
    username: string;
    equippedName?: string | null;
    onEdit: () => void;
    onCard: () => void;
    onTour: () => void;
    /** Low-power mode: the banner's effects are held still. */
    still?: boolean;
}

const WIDE = '(min-width: 768px)';

const HunterBanner: React.FC<HunterBannerProps> = ({ theme, playerRank, overallPct, username, equippedName, onEdit, onCard, onTour, still = false }) => {
    const art = theme.isDark ? ART.dark : ART.light;
    // --hb-hot: the hottest point of a light, gold-white on the Void and lilac-white on Arcanum.
    // --hb-gem: the theme's stone (amber, amethyst) for the finials, as the art's gems are.
    const rootStyle = {
        '--hb-rgb': theme.accentFillRGB,
        '--hb-hot': theme.isDark ? '255, 236, 180' : '246, 240, 255',
        '--hb-gem-hi': theme.isDark ? '#fde68a' : '#ede9fe', // theme-color-ok: gem facets, accent-family per theme
        '--hb-gem-lo': theme.isDark ? '#b45309' : '#6d28d9', // theme-color-ok: gem facets, accent-family per theme
    } as React.CSSProperties;
    const currentRankIdx = USER_RANKS.findIndex((r) => r.label === playerRank.name);
    const ladder = ladderWindow(Math.max(0, currentRankIdx));

    // The layout, and the art's height (the portrait and the seal are sized from it).
    const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches);
    const artRef = useRef<HTMLDivElement>(null);
    const [artH, setArtH] = useState(160);
    useLayoutEffect(() => {
        const mq = window.matchMedia(WIDE);
        const onMq = () => setWide(mq.matches);
        mq.addEventListener('change', onMq);
        return () => mq.removeEventListener('change', onMq);
    }, []);
    useLayoutEffect(() => {
        const el = artRef.current;
        if (!el) return;
        const measure = () => setArtH(Math.round(el.getBoundingClientRect().height));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [wide]);

    const rankName = (
        <span className={`inline-block pr-[6px] font-black font-orbitron tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${theme.isDark ? theme.inkGradient : 'from-[#c4b5fd] via-[#ddd6fe] to-white'}`}>
            {playerRank.name}
        </span>
    );
    // Ranks are earned by EXP (chapters read); say how far the next one is.
    const exp = `${(playerRank.exp ?? 0).toLocaleString()} EXP`;
    const toNext = playerRank.next ? `${(playerRank.next.minExp - (playerRank.exp ?? 0)).toLocaleString()} to ${playerRank.next.label}` : 'highest rank';

    const name = (size: string, titleSize: string) => (
        <div className="flex items-baseline gap-x-2 min-w-0 max-w-full">
            <span className={`${size} font-mono font-bold truncate`} style={{ color: theme.accentPlateInk }}>{username}</span>
            {equippedName && (
                <span className={`${titleSize} font-mono font-bold uppercase tracking-[0.15em] text-accent-plate truncate`}>
                    <span className="sr-only">Title: </span>{equippedName}
                </span>
            )}
        </div>
    );

    // The actions: the kit's octagon tools.
    const tools = (size: string, icon: number, column = false) => (
        <div data-tour="profile-actions" className={`flex ${column ? 'flex-col' : ''} items-center gap-1.5 shrink-0`}>
            {[
                { label: 'Edit Profile', icon: InscribeGlyph, onClick: onEdit },
                { label: 'Hunter Card', icon: TransmitGlyph, onClick: onCard },
                { label: 'Tour', icon: HelpCircle, onClick: onTour },
            ].map(({ label, icon: Icon, onClick }) => (
                <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    aria-label={label}
                    title={label}
                    className={`hud hud-tool hud-on-plate hb-tool [--hud-line:var(--accent-line)] ${size} flex items-center justify-center text-accent-plate hover:text-white cursor-pointer`}
                >
                    <Icon size={icon} aria-hidden="true" />
                </button>
            ))}
        </div>
    );

    // THE LADDER. Below lg nine nowrap labels cannot share the width without overprinting, so
    // only the current rank is named there; the nodes still show the rest. Labels hang from the
    // node's centre, not its top: the three node sizes put labels at three heights. Every node
    // sits in a cell of the same width and the track runs from the first cell's centre to the
    // last's, so the nodes fall at even steps and the middle one (PARAGON on the first ladder)
    // at the ladder's centre: on the medallion's axis, under the ledger's middle gem.
    const ladderEl = (
        <div className="relative w-full" style={{ height: '5px' }}>
            <div className="absolute inset-y-0 left-[9px] right-[9px]">
            <div className={`absolute top-0 left-0 w-full h-full rounded-full ${theme.isDark ? 'bg-white/[0.1]' : 'bg-violet-200/30'}`} />
            <div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{
                    width: `${Math.min(100, Math.max(0, (currentRankIdx - ladder.start) / (LADDER_SPAN - 1)) * 100)}%`,
                    background: theme.isDark
                        ? 'linear-gradient(90deg, rgba(251,191,36,0.5) 0%, rgba(251,191,36,1) 100%)'
                        : 'linear-gradient(90deg, rgba(167,139,250,0.4) 0%, rgba(124,58,237,1) 100%)',
                    boxShadow: theme.isDark
                        ? '0 0 10px 3px rgba(251,191,36,0.5), 0 0 20px 6px rgba(251,191,36,0.2)'
                        : '0 0 10px 3px rgba(167,139,250,0.5), 0 0 20px 6px rgba(167,139,250,0.2)',
                }}
            />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between items-center z-10">
                {ladder.ranks.map((rank, i) => {
                    const idx = ladder.start + i;
                    const isReached = idx <= currentRankIdx;
                    // The Transcendent tiers are diamonds, not dots: past MONARCH.
                    const shape = idx >= TRANSCENDENT_FROM ? 'rounded-[2px] rotate-45' : 'rounded-full';
                    const isCurrent = idx === currentRankIdx;
                    // theme-color-ok: rank-track pips use the lighter -400 highlight shades, not the accent
                    const accentColor = theme.isDark ? '#fbbf24' : '#a78bfa';
                    return (
                        <div key={rank.label} className="relative w-[18px] flex flex-col items-center" title={`${rank.label} · ${rank.minExp.toLocaleString()} EXP`}>
                            {isCurrent ? (
                                <div
                                    className={`w-4 h-4 lg:w-[18px] lg:h-[18px] ${shape} border-[2.5px] bg-transparent transition-all duration-500`}
                                    style={{ borderColor: accentColor, boxShadow: `0 0 12px 4px ${accentColor}60, 0 0 24px 6px ${accentColor}30` }}
                                />
                            ) : isReached ? (
                                <div
                                    className={`w-[10px] h-[10px] lg:w-3 lg:h-3 ${shape} transition-all duration-500 ${theme.isDark ? 'bg-amber-400' : 'bg-[#a78bfa]'}`}
                                    style={{ boxShadow: `0 0 7px 2px ${accentColor}80` }}
                                />
                            ) : (
                                <div className={`w-2 h-2 ${shape} transition-all duration-500 ${theme.isDark ? 'bg-white/25' : 'bg-violet-300/40'}`} />
                            )}
                            <div className={`absolute top-[calc(50%_+_14px)] lg:top-[calc(50%_+_15px)] whitespace-nowrap text-[7px] lg:text-[8px] font-mono tracking-[0.12em] font-bold uppercase transition-all [text-shadow:0_0_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.8)]
                                ${isCurrent ? 'text-accent-plate' : `hidden lg:block ${isReached ? 'text-white' : 'text-gray-400'}`}`}>
                                {rank.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
    const fx = (full: boolean) => (
        <div className="hb-fx" aria-hidden="true">
            {full && <BannerRunes isDark={theme.isDark} />}
            {full && <span className="hb-sky hb-sky-l" />}
            {full && <span className="hb-sky hb-sky-r" />}
            {full && EYES.map(([x, y], i) => <span key={i} className="hb-eye" style={{ left: pct(x), top: pct(y), animationDelay: `${-i * 1.7}s` }} />)}
            {full && GEMS.map(([x, y], i) => <span key={i} className="hb-glint" style={{ left: pct(x), top: pct(y), animationDelay: `${(i * 0.85).toFixed(2)}s` }} />)}
            {EMBERS.slice(0, full ? 18 : 10).map((e, i) => (
                <span
                    key={i}
                    className="hb-ember"
                    style={{
                        left: pct(full ? e.left : 0.2 + (e.left - 0.12) * 0.6), top: pct(e.top), width: e.size, height: e.size,
                        animationDuration: `${e.dur.toFixed(2)}s`, animationDelay: `${e.delay.toFixed(2)}s`,
                        '--dx': `${e.dx.toFixed(1)}px`, '--rise': `${Math.round(e.rise * artH)}px`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );

    const actions = (
        <div data-tour="profile-actions" className="flex items-center gap-2">
            {[
                { label: 'Edit Profile', icon: InscribeGlyph, onClick: onEdit },
                { label: 'Hunter Card', icon: TransmitGlyph, onClick: onCard },
                { label: 'Tour', icon: HelpCircle, onClick: onTour },
            ].map(({ label, icon: Icon, onClick }) => (
                <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="hud hud-btn hud-on-plate [--hud-c:5px] [--hud-line:var(--accent-line)] h-7 flex items-center gap-1.5 px-3 text-accent-plate hover:text-white cursor-pointer"
                >
                    <Icon size={10} aria-hidden="true" className="shrink-0" />
                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest whitespace-nowrap">{label}</span>
                </button>
            ))}
        </div>
    );

    const img = (sizes: string, className: string) => (
        <img
            className={className}
            src={art.small}
            srcSet={`${art.small} 800w, ${art.large} 1600w`}
            sizes={sizes}
            width={2000}
            height={489}
            alt=""
            aria-hidden="true"
            decoding="async"
            draggable={false}
        />
    );

    if (wide) {
        const avatar = Math.round(Math.min(210, Math.max(72, artH * 0.48)));
        const seal = Math.round(Math.min(128, Math.max(68, artH * 0.315)));
        // An ornamental rule: a hairline running out to a diamond, the frame's own detailing.
        const rule = (flip = false) => (
            <span aria-hidden="true" className={`hb-rule ${flip ? 'hb-rule-r' : ''}`}><i /></span>
        );
        return (
            <div className="hb-root" style={rootStyle} data-still={still ? '' : undefined}>
                <div ref={artRef} className="hb-art hb-art-wide" style={{ aspectRatio: '2000 / 489' }}>
                    {img('(min-width: 1024px) 1600px, 100vw', 'hb-img')}
                    {fx(true)}
                    <span className="hb-core" aria-hidden="true" />
                    <span className="hb-shade" aria-hidden="true" />

                    {/* THE PORTAL: the hunter. */}
                    <div className="hb-portal">
                        <EntityAvatar theme={theme} size={avatar} rank={playerRank.name} bare />
                    </div>

                    {/* THE LEFT SKY: a title plate in the frame's own language. The designation
                        between ruled diamonds, the rank set like an engraved title, the hunter's
                        name in the silver of the frame beneath. */}
                    <div className="hb-zone hb-zone-l hb-plate">
                        <div className="hb-eyebrow">
                            {rule()}
                            <span className="font-mono font-bold uppercase text-accent-plate">Hunter Designation</span>
                            {rule(true)}
                        </div>
                        <div className="hb-rank hb-rank-title"><span className="sr-only">Hunter designation: </span>{rankName}</div>
                        <span className="hb-close" aria-hidden="true"><i /></span>
                    </div>

                    {/* THE NAMEPLATE, fixed to the medallion under the portrait: silver-rimmed, a gem
                        at either end. */}
                    <div className="hb-nameplate">
                        <span className="hb-gem" aria-hidden="true" />
                        <div className="hb-np-rim">
                            <div className="hb-np-plate">
                                <span className="font-mono font-bold truncate hb-silver">{username}</span>
                                {equippedName && (
                                    <>
                                        <span className="hb-np-dot" aria-hidden="true" />
                                        <span className="font-mono font-bold uppercase tracking-[0.14em] text-accent-plate truncate hb-np-title">
                                            <span className="sr-only">Title: </span>{equippedName}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <span className="hb-gem" aria-hidden="true" />
                    </div>

                    {/* THE RIGHT SKY: the completion. */}
                    <div className="hb-zone hb-zone-r">
                        <CompletionSeal theme={theme} pct={overallPct} size={seal} />
                    </div>
                </div>

                {/* UNDER THE BANNER: a ledger hanging from the frame's bottom rail, rimmed in the
                    frame's silver, with the EXP, the rank ladder and the actions. */}
                <div data-tour="profile-ledger" className="hb-ledger">
                    <div className="hb-ledger-rim">
                        <div className="hb-ledger-plate">
                            {/* Equal sides, so the ladder's centre is the ledger's; the row is
                                set on the medallion's axis (CSS). */}
                            <div className="hb-ledger-row relative z-10 grid items-center gap-3 lg:gap-4">
                                <div className="min-w-0 flex flex-col justify-center">
                                    <span className="text-[12px] lg:text-[13px] font-mono font-bold tabular-nums whitespace-nowrap text-accent-plate">{exp}</span>
                                    <span className="text-[8px] lg:text-[9px] font-mono tracking-[0.16em] uppercase text-gray-300 whitespace-nowrap">{toNext}</span>
                                </div>
                                <span className="hb-divider" aria-hidden="true" />
                                {/* The labels hang under the track: the padding keeps them in. */}
                                <div className="min-w-0 pt-1 pb-5 mx-1 lg:mx-2">{ladderEl}</div>
                                <span className="hb-divider" aria-hidden="true" />
                                <div className="min-w-0 flex justify-end">
                                    <div className="2xl:hidden">{tools('w-8 h-8', 13)}</div>
                                    <div className="hidden 2xl:block">{actions}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span className="hb-gem hb-ledger-gem hb-ledger-gem-l" aria-hidden="true" />
                    <span className="hb-gem hb-ledger-gem hb-ledger-gem-c" aria-hidden="true" />
                    <span className="hb-gem hb-ledger-gem hb-ledger-gem-r" aria-hidden="true" />
                </div>
            </div>
        );
    }

    // Below md: one panel.
    const avatar = Math.round(artH * 0.5);
    // The rank fits the side beside the medallion (about 100 px): an Orbitron capital is about
    // 0.72 em wide, so the longer names (SOVEREIGN, PRIMORDIAL) step down from 19 px.
    const rankPx = Math.max(13, Math.min(19, Math.floor(100 / (0.72 * playerRank.name.length))));
    return (
        <div className="hb-root" style={rootStyle} data-still={still ? '' : undefined}>
            <div className="hud hud-shell hud-on-plate hb-panel relative bg-[#0a0a0a] overflow-hidden">
                <div ref={artRef} className="hb-crop relative" style={{ height: 'clamp(150px, 46vw, 200px)' }}>
                    <div className="hb-crop-art" style={{ width: `${Math.round(artH * RATIO)}px` }}>
                        {img('800px', 'hb-img')}
                        {fx(false)}
                        <span className="hb-core" aria-hidden="true" />
                    </div>
                    <span className="hb-fade" aria-hidden="true" />
                    <div className="hb-portal">
                        <EntityAvatar theme={theme} size={avatar} rank={playerRank.name} bare />
                    </div>

                    {/* The designation, left of the medallion. */}
                    <div className="hb-side hb-side-l">
                        {name('text-[10px]', 'text-[7px]')}
                        <div className="hb-rank leading-tight mt-0.5" style={{ fontSize: rankPx }}><span className="sr-only">Hunter designation: </span>{rankName}</div>
                        <div className="hb-chip mt-1 text-[8px] font-mono tracking-[0.06em] uppercase text-gray-300 leading-snug">
                            <div>{exp}</div>
                            <div>{toNext}</div>
                        </div>
                    </div>

                    {/* The completion and the actions, right of it: the tools in a column beside
                        the seal, clear of the medallion's rim. */}
                    <div className="hb-side hb-side-r">
                        <CompletionSeal theme={theme} pct={overallPct} size={60} />
                        {tools('w-[26px] h-[26px]', 11, true)}
                    </div>
                </div>

                <div className="relative z-10 px-6 pt-1 pb-6">{ladderEl}</div>
            </div>
        </div>
    );
};

export default HunterBanner;
