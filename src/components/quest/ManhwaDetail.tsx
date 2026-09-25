import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X, Users, Share2, Zap, Edit2, Target, AlignLeft, Check, Activity, ExternalLink } from 'lucide-react';
import { getProxiedImageUrl, cleanDescription } from '../../utils/api';
import { systemFetch } from '../../utils/auth';
import { sanitizeHtml } from '../../utils/sanitize';

import { Theme, Quest } from '../../core/types';
import ScrambleText from '../system/ScrambleText';
import RankSigil from './RankSigil';
import { getQuestRankObj } from '../../utils/ranks';
import { useDialog } from '../../utils/useDialog';
import { accentRGB, elevation, emphasis } from '../../core/depth';
import './ManhwaDetail.css';



interface ManhwaDetailProps {
    isOpen: boolean;
    onClose: () => void;
    quest: Quest | null;
    theme: Theme;
    allQuests?: Quest[];
    onSetActive?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Quest>) => Promise<void>;
    onEdit?: (quest: Quest) => void;
}

interface AniListCharacter {
    id: number;
    name: { full: string; native: string };
    image: { medium: string; large: string };
    role: string;
}

interface AniListMedia {
    id: number;
    title: { english: string; romaji: string; native: string };
    description: string;
    coverImage: { extraLarge: string; large: string };
    bannerImage: string;
    genres: string[];
    averageScore: number;
    status: string;
    seasonYear: number;
    chapters: number;
    characters: { nodes: AniListCharacter[] };
    siteUrl: string;
}

// Character avatar with graceful fallback: AniList (and the manual metadata) can hand
// back a missing, placeholder, or 404 image. Rather than show the browser's broken-image
// glyph, fall back to the character's initial in a themed circle. Prefers the smaller
// `medium` asset for these 60px avatars, dropping to `large` only when medium is absent.
const CharacterAvatar: React.FC<{ char: AniListCharacter }> = ({ char }) => {
    const [failed, setFailed] = useState(false);
    const src = getProxiedImageUrl(char.image?.medium || char.image?.large);
    const initial = (char.name?.full?.trim()?.[0] || '?').toUpperCase();
    const showImg = !!src && !failed;
    return (
        // The character cards are dark plates in BOTH themes, so the fallback disc and its
        // initial are pinned too. Light used slate-600 on a slate-200 disc laid over the
        // black card, which composited to 2.9:1.
        <div className="w-[60px] h-[60px] rounded-full overflow-hidden border border-white/20 group-hover:border-white/50 transition-colors flex items-center justify-center bg-white/10">
            {showImg ? (
                <img
                    src={src}
                    alt={char.name.full}
                    width={60}
                    height={60}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className="text-lg font-black font-mono text-white/80" aria-hidden="true">{initial}</span>
            )}
        </div>
    );
};

/**
 * Light-theme surface for anything that carries text on this view.
 *
 * The light backdrop is a deliberate cinematic mid-slate (see ManhwaDetail.css) with a
 * vignette, so bare it runs from L≈0.15 to 0.40 — a band where neither the ink nor white
 * clears AA. The panels used to be 35% white, which only lifted that to ~0.37 and left
 * the ink at 2.9:1 and slate-700 body copy at 3.7:1. At 60% the plate reads as paper laid
 * on the slate, the light theme's own depth model, and the house inks pass on it.
 */
const LIGHT_PLATE = 'bg-white/60 border-white/50';
/**
 * Accent ink on those plates. The plate composites to L≈0.50–0.58 over the slate — paler
 * than the page but darker than the white panels the house ink (#155e75) was tuned on,
 * where it measured 3.96–4.45:1. This view therefore reads its accents in cyan-900, the
 * deep end of the same ink family (the last stop of `gradientInk`): 4.7:1 or better.
 */
const LIGHT_INK = 'text-cyan-900';

// Unified numbered section header: index chip + icon + label + fading rule, with an
// optional right-aligned action (e.g. the synopsis MODIFY button, a scanning indicator).
//
// `bare` marks a header that sits straight on the backdrop rather than inside a panel. On
// light that backdrop is mid-slate — too dark for the ink, too pale for white — so a bare
// header gets the same paper plate the panels use.
const SectionHeader: React.FC<{ index: string; icon: React.ReactNode; label: string; theme: Theme; bare?: boolean; children?: React.ReactNode }> = ({ index, icon, label, theme, bare = false, children }) => {
    const accent = theme.id === 'LIGHT' ? LIGHT_INK : 'text-amber-400';
    const rule = theme.id === 'LIGHT' ? 'from-sky-500/50' : 'from-amber-400/40';
    const plate = bare && !theme.isDark ? `${LIGHT_PLATE} backdrop-blur-xl rounded-lg border px-3 py-2` : 'px-1';
    return (
        // Wraps rather than overflows: on a phone the trailing chip ran off the screen edge.
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 mb-6 ${plate}`}>
            <span className={`text-[11px] font-black font-mono ${accent}`}>{index}</span>
            <span className="opacity-60 flex items-center" aria-hidden="true">{icon}</span>
            <h2 className={`text-[10px] font-mono tracking-[0.3em] font-bold uppercase ${theme.isDark ? 'text-white/80' : 'text-slate-700'}`}>{label}</h2>
            <span className={`flex-1 min-w-[24px] h-px bg-gradient-to-r ${rule} to-transparent`} />
            {children}
        </div>
    );
};

// --- COMPONENT ---
const ManhwaDetail: React.FC<ManhwaDetailProps> = ({ isOpen, onClose, quest, theme, allQuests, onSetActive, onUpdate, onEdit }) => {
    const [media, setMedia] = useState<AniListMedia | null>(null);
    const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
    const [draftSynopsis, setDraftSynopsis] = useState("");
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const prefersReduced = useReducedMotion();

    // Dialog behaviour: focus the panel on open, trap Tab inside it, close on Escape,
    // and restore focus to whatever was focused before it opened. The shared hook also
    // yields the keyboard to the Gate editor when EDIT_ARTIFACT opens it on top of this
    // view, and does not re-run when App hands down a fresh onClose — which it does on
    // every render, and which used to pull focus back to the panel shell each time.
    useDialog(dialogRef, isOpen, onClose);

    const isCustomCover = !!(quest?.coverUrl && quest.coverUrl !== "");
    const finalCover = isCustomCover ? quest.coverUrl : (media?.coverImage?.extraLarge || media?.coverImage?.large || quest?.coverUrl || "");

    // Same-class entries from the library, used by the SIMILAR_RECORDS row far below.
    //
    // This must be computed HERE, above the `if (!isOpen || !quest) return null` guard.
    // It previously lived inline in the JSX as a React.useMemo, which meant the hook ran
    // only when the modal was open — the hook count changed between renders, and React
    // throws "Rendered more hooks than during the previous render" as soon as a parent
    // keeps this component mounted across the isOpen transition.
    const similarQuests = useMemo(() => {
        if (!quest) return [];
        return (allQuests || [])
            .filter(q => q.classType === quest.classType && q.id !== quest.id)
            .slice(0, 10);
    }, [allQuests, quest]);

    // Ambient starfield for the backdrop — matches the Boot/Login constellation motif.
    // Generated once; positions are stable across re-renders (e.g. chapter logging).
    const STARS = useMemo(() => Array.from({ length: 110 }, () => ({
        left: +(Math.random() * 100).toFixed(2),
        top: +(Math.random() * 100).toFixed(2),
        size: +(Math.random() * 2 + 1.2).toFixed(2),
        opacity: +(Math.random() * 0.45 + 0.45).toFixed(2),
    })), []);

    // Fetch Details on Open
    //
    // Keyed on the title rather than the quest object: the library hands down a fresh
    // object on every progress update, so depending on `quest` re-ran the whole AniList
    // lookup each time a chapter was logged.
    useEffect(() => {
        if (isOpen && quest?.title) {
            setMedia(null);
            fetchDetails(quest.title);
        }
        // fetchDetails is stable for a given title and intentionally excluded; including
        // it would require memoising MANUAL_METADATA, which closes over `quest` and `media`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, quest?.title]);

    // Manual Data for OEL/Missing Titles
    const MANUAL_METADATA: Record<string, AniListMedia> = {
        "The Beginning After The End": {
            id: 999999,
            title: {
                english: "The Beginning After The End",
                romaji: "The Beginning After The End",
                native: "The Beginning After The End"
            },
            description: "King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power. Reincarnated into a new world filled with magic and monsters, the king has a second chance to relive his life. Correcting the mistakes of his past will not be his only challenge, however. Underneath the peace and prosperity of the new world is an undercurrent threatening to destroy everything he has worked for, questioning his role and reason for being born again.",
            coverImage: {
                extraLarge: getProxiedImageUrl(quest?.coverUrl || media?.coverImage?.extraLarge || "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108343-T9D6L7Gnd8d6.jpg"),
                large: getProxiedImageUrl(quest?.coverUrl || media?.coverImage?.large || "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108343-T9D6L7Gnd8d6.jpg")
            },
            bannerImage: "", // Use cover as fallback in UI
            genres: ["Fantasy", "Action", "Adventure", "Isekai"],
            averageScore: 95,
            status: "RELEASING",
            seasonYear: 2018,
            chapters: 175,
            siteUrl: "https://tapas.io/series/tbate-comic/info",
            characters: {
                nodes: [
                    {
                        id: 1,
                        // No verified art asset for these; left blank so CharacterAvatar
                        // renders the initial instead of firing a doomed image request.
                        name: { full: "Arthur Leywin", native: "Arthur Leywin" },
                        image: { medium: "", large: "" },
                        role: "MAIN"
                    },
                    {
                        id: 2,
                        name: { full: "Sylvie", native: "Sylvie" },
                        image: { medium: "", large: "" },
                        role: "MAIN"
                    }
                ]
            }
        }
    };

    // --- PROXY API FETCH ---
    const fetchFromProxy = async (title: string): Promise<AniListMedia | null> => {
        try {
            const res = await systemFetch(`/api/proxy/metadata?title=${encodeURIComponent(title)}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("[Proxy] Fetch Failed", e);
            return null;
        }
    };

    const fetchDetails = async (title: string) => {
        setIsLoadingMedia(true);
        // 1. Check Manual Metadata First
        if (MANUAL_METADATA[title]) {
            setMedia(MANUAL_METADATA[title]);
            setIsLoadingMedia(false);
            return;
        }

        // Clean title for better matching
        const cleanTitle = title
            .replace(/\s*Season\s*\d+/gi, '')
            .replace(/\s+\d+$/, '')
            .trim();

        try {
            const data = await fetchFromProxy(cleanTitle);
            // Description cleaning happens once, at render, so stored synopses get it too.
            if (data) setMedia(data);
        } catch (e) {
            console.error("Proxy Fetch Failed", e);
        } finally {
            setIsLoadingMedia(false);
        }
    };

    if (!isOpen || !quest) return null;

    // Status badge colour. Uses LITERAL class strings (never string-interpolated) so
    // Tailwind actually compiles them, and stays on the amber/sky theme palette. The
    // previous `bg-${theme.accent}-500/10` form built classes Tailwind never generated
    // (accent = yellow/indigo, absent from safelist and source), so every badge except
    // FINISHED rendered with no colour at all.
    const getStatusColor = (status: string) => {
        const finished = ['FINISHED', 'COMPLETED'].includes((status || '').toUpperCase());
        if (finished) return theme.isDark
            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
            : 'bg-indigo-500/10 text-indigo-800 border-indigo-500/40';
        return theme.isDark
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : `bg-sky-500/10 ${LIGHT_INK} border-sky-600/40`;
    };

    const containerVariants = {
        hidden: { opacity: prefersReduced ? 1 : 0 },
        visible: { opacity: 1, transition: { staggerChildren: prefersReduced ? 0 : 0.1 } }
    };

    const itemVariants = {
        hidden: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: prefersReduced ? 0 : 0.6 } }
    };

    // Shared surface + label styles for the right-hand data column. In LIGHT mode the
    // panels are soft frosted cards (not bright white) so they don't glare — mirroring
    // how dark mode's panels are subtle recesses rather than high-contrast blocks.
    const panelClass = theme.isDark ? 'bg-black/30 border-white/5' : LIGHT_PLATE;
    // white/40 measured 3.7:1 on the dark panels; 55% clears AA.
    const labelClass = `text-[10px] font-mono tracking-widest uppercase ${theme.isDark ? 'text-white/55' : 'text-slate-700'}`;
    const metricCellClass = `flex flex-col gap-1 p-3 rounded-lg border ${theme.isDark ? 'bg-white/5 border-white/5' : 'bg-white/70 border-white/50'}`;

    // Theme accent shorthands + this quest's rank sigil.
    const accentBorder = theme.id === 'LIGHT' ? 'border-sky-400' : 'border-amber-400';
    const accentBg = theme.id === 'LIGHT' ? 'bg-sky-400' : 'bg-amber-400';
    const rank = getQuestRankObj(quest);

    // Theme-aware text so nothing goes white-on-light in LIGHT mode.
    const strongText = theme.isDark ? 'text-white' : 'text-slate-900';
    const faintText = theme.isDark ? 'text-white/55' : 'text-slate-700';
    // Secondary numerals ("/ 650", "/100", "CH"): quieter than the value they qualify, but
    // still read — white/30 and slate-400 measured 2.5:1 and 1.1:1.
    const subText = theme.isDark ? 'text-white/50' : 'text-slate-700';
    // Read accent text: the theme ink on the void, LIGHT_INK on the light plates.
    const accentText = theme.isDark ? theme.highlightText : LIGHT_INK;
    const iconText = theme.isDark ? 'text-white' : 'text-slate-700';
    const chipBtn = theme.isDark
        ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white hover:border-white/30'
        : 'bg-white/60 hover:bg-white/80 border-slate-400/60 text-slate-800 hover:border-slate-600';

    // EXP-style progress readout.
    const totalCh = quest.totalChapters || 0;
    const progress = totalCh > 0 ? Math.min(1, quest.currentChapter / totalCh) : 0;
    const TICKS = 40;
    const filledTicks = Math.round(TICKS * progress);

    return (

        <div className={`fixed inset-0 z-[400] flex animate-in fade-in duration-500 manhwa-detail-backdrop`}
            data-theme={theme.isDark ? 'dark' : 'light'}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manhwa-detail-title"
            tabIndex={-1}
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* FULL-BLEED CINEMATIC BACKDROP */}
            <div className="absolute inset-0 z-0 overflow-hidden">

                {/* BASE GRADIENT LAYER */}
                <div className="absolute inset-0 z-[1] manhwa-detail-base-gradient" />

                {/* COVER ART AURA */}
                {(quest?.coverUrl || media?.bannerImage || finalCover) ? (
                    <img
                        src={getProxiedImageUrl(quest?.coverUrl || media?.bannerImage || finalCover)}
                        className="w-full h-full object-cover blur-3xl scale-125 transform-gpu manhwa-detail-aura"
                        referrerPolicy="no-referrer"
                        alt=""
                        aria-hidden="true"
                    />
                ) : null}

                {/* DEPTH VIGNETTE */}
                <div className="absolute inset-0 z-[2] pointer-events-none manhwa-detail-vignette" />

                {/* HUD GRID OVERLAY (Boot/Login consistency) */}
                <div className="absolute inset-0 z-[2] pointer-events-none manhwa-detail-grid" />

                {/* AMBIENT STARFIELD */}
                <div className="absolute inset-0 z-[3] pointer-events-none">
                    {STARS.map((s, i) => (
                        <span
                            key={i}
                            className="absolute rounded-full manhwa-detail-star"
                            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: s.opacity }}
                        />
                    ))}
                </div>
            </div>

            {/* TOP NAVIGATION BAR */}
            {/* The bar floats over whatever scrolls beneath it — the vignetted corner at rest,
                a pale panel or a cover poster mid-scroll — so it carries its own shade rather
                than betting on any of them. On the void the shade is invisible at rest and
                only shows up to hold the label clear of art passing under it; on light it
                also switches the label to a pale ink. */}
            <div className={`absolute top-0 left-0 w-full h-20 flex justify-between items-center px-4 sm:px-8 z-50 pointer-events-none bg-gradient-to-b ${theme.isDark ? 'from-black/90 via-black/80 via-60% to-transparent' : 'from-slate-950/85 via-slate-950/75 via-60% to-transparent'}`} style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 ${theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'} shadow-[0_0_15px_currentColor]`} />
                    <div className={`font-mono text-[10px] tracking-[0.4em] ${theme.isDark ? theme.highlightText : 'text-cyan-50'} font-bold uppercase`}>SYSTEM.ARCHIVE_INSPECTION</div>
                </div>
                <button
                    onClick={onClose}
                    className={`pointer-events-auto w-9 h-9 flex items-center justify-center border ${theme.isDark ? `${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText}` : 'border-white/40 text-slate-100 hover:text-white'} hover:border-current transition-colors cursor-pointer`}
                    title="Close Details"
                    aria-label="Close Details"
                >
                    <X size={16} />
                </button>
            </div>

            {/* MAIN SCROLLABLE CONTENT (CENTERED COLUMN) */}
            <div
                className="relative z-30 w-full h-full overflow-y-auto overscroll-contain custom-scrollbar pb-32 px-4 sm:px-8 md:px-16 manhwa-detail-scroll-container"
                style={{ paddingTop: 'calc(max(80px, env(safe-area-inset-top) + 64px) + 8px)' }}
                data-theme={theme.isDark ? 'dark' : 'light'}
            >
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-12">

                    {/* HERO SECTION: COVER + TITLE + STATS */}
                    <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-start">
                        {/* COVER ART — SCANNED ARTIFACT */}
                        <div className="shrink-0 w-[180px] md:w-[240px] lg:w-[280px] relative group mx-auto md:mx-0">
                            {/* Data spine */}
                            <div className="hidden md:flex flex-col justify-between items-center absolute top-4 bottom-4 -left-5 z-20">
                                {[`CH ${quest.currentChapter}`, `${Math.round(progress * 100)}%`, quest.status].map((s, i) => (
                                    <span key={i} className={`manhwa-detail-spine text-[9px] font-mono tracking-[0.15em] ${theme.id === 'LIGHT' ? 'text-white' : 'text-amber-400/80'}`}>{s}</span>
                                ))}
                            </div>

                            {/* Bracketed frame */}
                            <div className={`relative p-[3px] border ${accentBorder} border-opacity-30`}>
                                <span className={`absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 ${accentBorder} z-20`} />
                                <span className={`absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 ${accentBorder} z-20`} />
                                <span className={`absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 ${accentBorder} z-20`} />
                                <span className={`absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 ${accentBorder} z-20`} />
                                <div className="relative aspect-[2/3] rounded-md overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                    <motion.img
                                        layoutId={`cover-${quest.id}`}
                                        src={getProxiedImageUrl(finalCover)}
                                        alt={`Cover art for ${quest.title}`}
                                        width={280}
                                        height={420}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                        referrerPolicy="no-referrer"
                                    />
                                    {/* Scanline sweep */}
                                    <div className={`absolute left-0 right-0 h-[2px] ${accentBg} opacity-70 pointer-events-none manhwa-detail-cover-scan`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* TITLE & METADATA */}
                        <div
                            className={`flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left ${theme.isDark ? '' : `${LIGHT_PLATE} border backdrop-blur-xl rounded-xl p-5 md:p-7`}`}
                            style={theme.isDark ? undefined : { boxShadow: elevation(theme, 2) }}
                        >
                            {/* Rank emblem */}
                            <div className="flex items-center gap-3 mb-4">
                                <RankSigil rank={rank} theme={theme} size={44} />
                                <span className={`text-[10px] font-mono tracking-[0.25em] uppercase font-bold ${theme.id === 'LIGHT' ? LIGHT_INK : 'text-amber-400'}`}>RANK {rank.name}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                                {media?.status && (
                                    <span className={`px-2 py-0.5 border text-[9px] font-bold tracking-widest uppercase ${getStatusColor(media.status)}`}>
                                        {media.status.replace('_', ' ')}
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 border text-[9px] font-mono tracking-widest uppercase ${theme.isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-slate-400/60 bg-slate-900/5 text-slate-700'}`}>
                                    CLASS: {quest.classType}
                                </span>
                            </div>

                            <h1 id="manhwa-detail-title" className={`text-3xl md:text-4xl lg:text-6xl font-black ${strongText} mb-2 leading-tight tracking-tighter drop-shadow-xl uppercase break-words`}>
                                {quest.title || media?.title?.english || media?.title?.romaji}
                            </h1>
                            {media?.title?.native && (
                                <h2 className={`text-xl md:text-2xl font-medium mb-8 ${theme.isDark ? 'text-white/50' : 'text-slate-600'}`}>
                                    {media.title.native}
                                </h2>
                            )}

                            {/* PROTOCOL BUTTONS ROW */}
                            <div className="flex flex-wrap gap-3 w-full justify-center md:justify-start mt-4">
                                {quest?.link && (
                                    <a
                                        href={quest.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        // Light fills with the accent and labels it near-black, as the dashboard's
                                        // ENTER PORTAL does: the ink on a 25% sky wash over the slate was 2.3:1.
                                        className={`px-8 py-3 rounded-sm border ${theme.isDark ? `bg-amber-500/25 hover:bg-amber-500/40 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.35)] ${theme.highlightText}` : 'bg-[#06b6d4] hover:bg-cyan-400 border-[#06b6d4] text-slate-900'} font-bold transition flex items-center gap-3 group/dive hover:scale-105 active:scale-95 cursor-pointer`}
                                        style={theme.isDark ? undefined : { boxShadow: emphasis(theme, accentRGB(theme)) }}
                                        title="Enter Portal"
                                        aria-label="Enter Portal"
                                    >
                                        <Zap size={16} aria-hidden="true" className="group-hover/dive:animate-pulse" />
                                        <ScrambleText text="ENTER_PORTAL" className="text-[10px] tracking-[0.2em] font-orbitron" />
                                    </a>
                                )}
                                <button
                                    onClick={() => quest && onEdit && onEdit(quest)}
                                    className={`px-6 py-3 rounded-sm border ${chipBtn} font-bold transition flex items-center gap-3 group/edit`}
                                >
                                    <Edit2 size={16} className="opacity-70 group-hover/edit:opacity-100 transition-opacity" />
                                    <span className="text-[10px] tracking-[0.2em] font-orbitron">EDIT_ARTIFACT</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (quest && onSetActive) {
                                            onSetActive(quest.id);
                                            onClose();
                                        }
                                    }}
                                    className={`px-6 py-3 rounded-sm border ${chipBtn} font-bold transition flex items-center gap-3 group/active`}
                                >
                                    <Target size={16} className="opacity-70 group-hover/active:opacity-100 transition-opacity" />
                                    <span className="text-[10px] tracking-[0.2em] font-orbitron">MARK_TARGET</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* PROGRESS HUD: THE RUNIC THREAD */}
                    <motion.div variants={itemVariants} className="w-full relative group mt-4">
                        <div className={`relative rounded-xl p-4 md:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden border ${theme.isDark ? 'bg-black/40 border-white/10' : LIGHT_PLATE}`}>
                            {/* Ambient internal glow */}
                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5 blur-xl pointer-events-none`} />

                            <div className="relative z-10 flex flex-col">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${theme.id === 'LIGHT' ? 'bg-sky-400' : 'bg-amber-400'} animate-pulse shadow-[0_0_10px_currentColor]`} />
                                        <div className={`text-[10px] font-mono font-bold tracking-[0.4em] ${accentText} uppercase`}>SYNCHRONIZATION_THREAD</div>
                                    </div>
                                    <div className={`text-[10px] font-mono ${faintText} tracking-widest uppercase`}>
                                        STATUS: {quest.status}
                                    </div>
                                </div>

                                {/* Numeric Readouts */}
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-5xl font-black ${strongText} tabular-nums tracking-tighter drop-shadow-md`}>
                                        {quest.currentChapter}
                                    </span>
                                    <span className={`text-xl font-medium tracking-widest ${subText}`}>
                                        / {(quest.totalChapters || 0) > 0 ? quest.totalChapters : '∞'}
                                    </span>
                                    <span className={`ml-auto text-sm font-mono font-bold ${accentText}`}>
                                        {Math.round(progress * 100)}% SYNC
                                    </span>
                                </div>

                                {/* The Thread — segmented EXP/sync readout */}
                                <div className="flex gap-[2px] h-2 items-stretch">
                                    {Array.from({ length: TICKS }).map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={`flex-1 rounded-[1px] ${i < filledTicks ? accentBg : (theme.isDark ? 'bg-white/10' : 'bg-black/10')}`}
                                            initial={prefersReduced ? false : { opacity: 0, scaleY: 0.4 }}
                                            animate={{ opacity: 1, scaleY: 1 }}
                                            transition={{ duration: prefersReduced ? 0 : 0.4, delay: prefersReduced ? 0 : (i < filledTicks ? i * 0.015 : 0) }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* TWO COLUMN DATA: SYNOPSIS & METADATA */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
                        {/* LEFT: Synopsis */}
                        <div className={`lg:col-span-2 relative p-4 md:p-8 backdrop-blur-xl rounded-xl group/synopsis border ${theme.isDark ? 'bg-black/30 border-white/5' : LIGHT_PLATE}`}>
                            <SectionHeader index="01" icon={<AlignLeft size={16} className={theme.isDark ? 'text-white' : 'text-slate-700'} />} label="ARCHIVE_SYNOPSIS" theme={theme}>
                                <button
                                    onClick={() => {
                                        if (isEditingSynopsis) {
                                            if (onUpdate && quest) onUpdate(quest.id, { synopsis: draftSynopsis });
                                        } else {
                                            setDraftSynopsis(quest.synopsis || media?.description || "");
                                        }
                                        setIsEditingSynopsis(!isEditingSynopsis);
                                    }}
                                    className={`shrink-0 min-h-[28px] px-3 py-1.5 rounded border text-[9px] font-mono tracking-widest uppercase transition-colors flex items-center gap-2 ${theme.isDark ? 'border-white/10 hover:border-white/30 text-white/70 hover:text-white' : 'border-slate-400/60 hover:border-slate-600 text-slate-700 hover:text-slate-900'}`}
                                >
                                    {isEditingSynopsis ? <><Check size={12} /> SAVE_OVERRIDE</> : <><Edit2 size={12} /> MODIFY</>}
                                </button>
                            </SectionHeader>

                            {isEditingSynopsis ? (
                                <textarea
                                    value={draftSynopsis}
                                    onChange={(e) => setDraftSynopsis(e.target.value)}
                                    className={`w-full h-48 rounded-lg p-4 text-sm font-sans resize-y shadow-inner transition-colors focus:outline-none focus-visible:ring-2 ${theme.isDark ? 'bg-black/40 border border-white/10 text-white/90 focus-visible:ring-amber-400/60' : 'bg-white/60 border border-slate-300 text-slate-800 focus-visible:ring-sky-400/60'}`}
                                    placeholder="Enter custom synopsis override…"
                                    aria-label="Custom synopsis override"
                                />
                            ) : (
                                <div
                                    className={`text-sm md:text-base leading-loose font-sans ${theme.isDark ? 'text-white/80' : 'text-slate-700'}`}
                                    // Synopsis text is third-party (AniList/MangaDex/MAL). cleanDescription
                                    // turns markdown and credit blocks into the small HTML subset, and
                                    // sanitizeHtml then keeps <br>/<i>/<b> and strips everything else.
                                    // Cleaning here rather than at fetch time also repairs synopses that
                                    // were saved before cleaning existed.
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(cleanDescription(quest.synopsis || media?.description, "No synopsis available.")) }}
                                />
                            )}
                        </div>

                        {/* RIGHT: System Metrics + Genres */}
                        <div className="flex flex-col gap-4">
                            {/* RECORD METRICS (AniList-derived: score, year, chapters, source) */}
                            {(isLoadingMedia || media) && (
                                <div className={`p-6 backdrop-blur-xl rounded-xl flex flex-col gap-5 border ${panelClass}`}>
                                    {/* The fade lives on the icon only: at 60% the label measured 2.2:1. */}
                                    <div className="flex items-center gap-2">
                                        <Activity size={16} aria-hidden="true" className={`opacity-60 ${theme.isDark ? 'text-white' : 'text-slate-700'}`} />
                                        <span className={`text-[10px] font-mono tracking-[0.3em] font-bold uppercase ${theme.isDark ? 'text-white/80' : 'text-slate-700'}`}>RECORD_METRICS</span>
                                    </div>

                                    {isLoadingMedia ? (
                                        <div className="flex flex-col gap-4 animate-pulse">
                                            <div className="h-2 w-full bg-white/10 rounded" />
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="h-16 bg-white/5 rounded-lg" />
                                                <div className="h-16 bg-white/5 rounded-lg" />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Resonance score */}
                                            {media?.averageScore ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-baseline">
                                                        <span className={labelClass}>RESONANCE</span>
                                                        <span className={`font-mono font-bold ${accentText}`}>
                                                            {media.averageScore}<span className={`${subText} text-xs`}>/100</span>
                                                        </span>
                                                    </div>
                                                    <div className={`h-1.5 w-full ${theme.isDark ? 'bg-white/10' : 'bg-slate-900/10'} rounded-full overflow-hidden shadow-inner`}>
                                                        <motion.div
                                                            className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full origin-left`}
                                                            initial={prefersReduced ? false : { scaleX: 0 }}
                                                            animate={{ scaleX: Math.min(1, media.averageScore / 100) }}
                                                            transition={{ duration: prefersReduced ? 0 : 1, ease: 'easeOut' }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Year / Depth */}
                                            {(media?.seasonYear || media?.chapters) ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {media?.seasonYear ? (
                                                        <div className={metricCellClass}>
                                                            <span className={labelClass}>ORIGIN</span>
                                                            <span className={`text-lg font-black ${strongText} tabular-nums leading-none`}>{media.seasonYear}</span>
                                                        </div>
                                                    ) : null}
                                                    {media?.chapters ? (
                                                        <div className={metricCellClass}>
                                                            <span className={labelClass}>DEPTH</span>
                                                            <span className={`text-lg font-black ${strongText} tabular-nums leading-none`}>
                                                                {media.chapters}<span className={`text-xs ml-1 ${subText}`}>CH</span>
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            {/* Source link */}
                                            {media?.siteUrl ? (
                                                <a
                                                    href={media.siteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors group/src ${theme.isDark ? 'border-white/10 hover:border-white/30 text-white/70 hover:text-white' : 'border-slate-400/60 hover:border-slate-600 text-slate-700 hover:text-slate-900'}`}
                                                    title="Open source record"
                                                >
                                                    <span className="text-[9px] font-mono tracking-widest uppercase">VIEW_SOURCE</span>
                                                    <ExternalLink size={12} className="opacity-60 group-hover/src:opacity-100 transition-opacity" />
                                                </a>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* GENRES */}
                            <div className={`p-6 backdrop-blur-xl rounded-xl flex flex-col gap-4 border ${panelClass}`}>
                                <span className={labelClass}>GENRES</span>
                                <div className="flex flex-wrap gap-2">
                                    {media?.genres?.length ? media.genres.map(genre => (
                                        <span key={genre} className={`px-3 py-1 text-[10px] font-mono rounded-full border ${theme.isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-slate-400/40 bg-white/60 text-slate-800'}`}>
                                            {genre}
                                        </span>
                                    )) : <span className={`text-xs ${theme.isDark ? 'text-white/55' : 'text-slate-600'}`}>{isLoadingMedia ? 'SCANNING...' : 'UNKNOWN'}</span>}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* CHARACTERS ROW (API DRIVEN) */}
                    {(isLoadingMedia || media) && (
                        <motion.div variants={itemVariants} className="mt-8">
                            <SectionHeader index="02" icon={<Users size={16} className={iconText} />} label="ENTITIES_DETECTED" theme={theme} bare>
                                {isLoadingMedia && (
                                    <div className="shrink-0 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'} animate-ping`} />
                                        <span className={`text-[8px] font-mono tracking-widest ${theme.isDark ? 'text-white/55' : 'text-slate-600'}`}>SCANNING_ARCHIVES…</span>
                                    </div>
                                )}
                            </SectionHeader>

                            {(!isLoadingMedia && !media?.characters?.nodes?.length) ? (
                                // Loaded, but the character source returned nothing (usually the
                                // external archive (AniList / MAL) being unreachable). Show an
                                // honest offline state instead of silently hiding the section.
                                <div className={`flex items-center gap-4 px-5 py-8 rounded-xl border border-dashed ${theme.isDark ? 'border-white/10 bg-black/10' : 'border-slate-500/50 bg-white/60 backdrop-blur-xl'}`}>
                                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${theme.isDark ? 'border-white/10' : 'border-slate-400/50'}`}>
                                        <Users size={18} className={theme.isDark ? 'text-white/40' : 'text-slate-600'} aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[10px] font-mono tracking-[0.3em] uppercase ${theme.isDark ? 'text-white/70' : 'text-slate-700'}`}>No entities on record</span>
                                        <span className={`text-[9px] font-mono tracking-widest uppercase ${theme.isDark ? 'text-white/55' : 'text-slate-600'}`}>External archive link unavailable, retry later</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex overflow-x-auto overscroll-x-contain gap-4 pb-4 custom-scrollbar snap-x min-h-[140px]" aria-live="polite" aria-busy={isLoadingMedia}>
                                    {isLoadingMedia ? (
                                        // SKELETON LOADERS
                                        Array(6).fill(0).map((_, i) => (
                                            <div key={i} className="w-[100px] shrink-0 animate-pulse flex flex-col items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/5">
                                                <div className="w-[60px] h-[60px] rounded-full bg-white/10" />
                                                <div className="h-2 w-12 bg-white/10 rounded" />
                                                <div className="h-1.5 w-8 bg-white/5 rounded" />
                                            </div>
                                        ))
                                    ) : (
                                        media?.characters?.nodes?.map(char => (
                                            <div key={char.id} className={`w-[100px] shrink-0 snap-start flex flex-col items-center gap-3 group p-4 ${theme.isDark ? 'bg-black/20' : 'bg-black/60'} backdrop-blur-md rounded-lg border border-white/5`}>
                                                <CharacterAvatar char={char} />
                                                <div className="text-center w-full">
                                                    <div className={`text-[10px] font-bold truncate w-full ${theme.isDark ? 'text-white' : 'text-slate-100'}`} title={char.name.full}>{char.name.full}</div>
                                                    {/* One value, not a per-theme pair: white/40 measured 3.71:1 on the dark card too, so
                                                        this was failing in BOTH themes. 60% clears AA on each (7.2 dark, 4.7 light). */}
                                                    <div className="text-[8px] text-white/60 uppercase truncate w-full mt-1">{char.role}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* SIMILAR RECORDS (PURELY DATABASE DRIVEN) */}
                    {similarQuests.length > 0 && (
                        <motion.div variants={itemVariants} className="mt-8">
                                <SectionHeader index="03" icon={<Share2 size={16} className={iconText} />} label="SIMILAR_RECORDS" theme={theme} bare>
                                    <span className={`shrink-0 text-[9px] font-mono tracking-widest uppercase border px-2 py-0.5 rounded ${theme.isDark ? 'border-white/20 text-white' : 'border-slate-400/60 text-slate-700'}`}>
                                        DATABASE_SYNC: {quest.classType}
                                    </span>
                                </SectionHeader>

                                <div className="flex overflow-x-auto overscroll-x-contain gap-4 pb-4 custom-scrollbar snap-x">
                                    {similarQuests.map((rec) => {
                                        const recRank = getQuestRankObj(rec);
                                        return (
                                        <button
                                            type="button"
                                            key={rec.id}
                                            onClick={() => onSetActive && onSetActive(rec.id)}
                                            aria-label={`Open ${rec.title}`}
                                            className="w-[160px] shrink-0 snap-start group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer shadow-lg border border-white/5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                        >
                                            <img src={getProxiedImageUrl(rec.coverUrl)} width={160} height={240} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" alt="" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                                            {/* Rank chip (Floor-view language) */}
                                            <span className={`absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center text-[11px] font-black font-mono border ${recRank.border} ${recRank.color} bg-black/60 backdrop-blur-sm`}>
                                                {recRank.name}
                                            </span>
                                            <div className="absolute bottom-0 w-full p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                <div className="text-[10px] font-bold truncate text-white uppercase">
                                                    {rec.title}
                                                </div>
                                                {/* On the card's black scrim in both themes, so the ink is pinned light. */}
                                                <div className={`text-[8px] font-mono mt-1 uppercase ${theme.isDark ? theme.highlightText : 'text-cyan-300'}`}>
                                                    {rec.status}
                                                </div>
                                            </div>
                                        </button>
                                        );
                                    })}
                                </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* SHARED NOISE HANDLED BY BACKGROUND CONTROLLER */}

            {/* READER OVERLAY */}

        </div>
    );
};

export default ManhwaDetail;
