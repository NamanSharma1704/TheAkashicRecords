import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Users, Share2, Zap, Edit2, Target, AlignLeft, Check, ExternalLink } from 'lucide-react';
import { getProxiedImageUrl } from '../../utils/api';
import { systemFetch } from '../../utils/auth';

import { Theme, Quest } from '../../core/types';
import ScrambleText from '../system/ScrambleText';
import SystemReader from '../reader/SystemReader';
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

interface AniListRecommendation {
    id: number;
    mediaRecommendation: {
        id: number;
        title: { english: string; romaji: string };
        coverImage: { large: string };
        averageScore: number;
    };
}

interface AniListMedia {
    id: number;
    title: { english: string; romaji: string; native: string };
    description: string;
    coverImage: { extraLarge: string; large: string };
    bannerImage: string;
    genres: string[];
    averageScore: number;
    meanScore: number;
    status: string;
    seasonYear: number;
    episodes: number;
    chapters: number;
    characters: { nodes: AniListCharacter[] };
    recommendations: { nodes: AniListRecommendation[] };
    siteUrl: string;
}

// --- COMPONENT ---
const ManhwaDetail: React.FC<ManhwaDetailProps> = ({ isOpen, onClose, quest, theme, allQuests, onSetActive, onUpdate, onEdit }) => {
    const [media, setMedia] = useState<AniListMedia | null>(null);
    const [isReaderOpen, setIsReaderOpen] = useState(false);
    const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
    const [draftSynopsis, setDraftSynopsis] = useState("");
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    const isCustomCover = !!(quest?.coverUrl && quest.coverUrl !== "");
    const finalCover = isCustomCover ? quest.coverUrl : (media?.coverImage?.extraLarge || media?.coverImage?.large || quest?.coverUrl || "");

    console.log("ManhwaDetail Quest:", quest);

    // Fetch Details on Open
    useEffect(() => {
        if (isOpen && quest) {
            setMedia(null);
            fetchDetails(quest.title);
        }
    }, [isOpen, quest]);

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
            meanScore: 90,
            status: "RELEASING",
            seasonYear: 2018,
            episodes: 0,
            chapters: 175,
            siteUrl: "https://tapas.io/series/tbate-comic/info",
            characters: {
                nodes: [
                    {
                        id: 1,
                        name: { full: "Arthur Leywin", native: "Arthur Leywin" },
                        image: { medium: "https://s4.anilist.co/file/anilistcdn/character/large/b123652-32X1i8I9N9n9.png", large: "https://s4.anilist.co/file/anilistcdn/character/large/b123652-32X1i8I9N9n9.png" }, // Placeholder or use generically if possible, but hardcoding for now
                        role: "MAIN"
                    },
                    {
                        id: 2,
                        name: { full: "Sylvie", native: "Sylvie" },
                        image: { medium: "https://s4.anilist.co/file/anilistcdn/character/large/b132895-j7W8F3x1y2z3.png", large: "https://s4.anilist.co/file/anilistcdn/character/large/b132895-j7W8F3x1y2z3.png" },
                        role: "MAIN"
                    }
                ]
            },
            recommendations: { nodes: [] }
        }
    };

    // --- HELPERS ---
    const cleanDescription = (desc: string): string => {
        if (!desc) return "No description available.";
        return desc
            // Remove the block starting with --- and containing Original/Official Translation links
            .replace(/\s*---[\s\S]*?(?:Original|Official|Translations|Links|Webtoon)[\s\S]*$/i, '')
            // Replace legacy formatted chunks just in case
            .replace(/(?:\n|<br\s*\/?>)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Original Webtoon|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
            .split(/\s*-{3,}\s*$/)[0] // Remove trailing horizontal rules
            .trim();
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
            if (data) {
                // Apply description cleaning (redundant but safe)
                data.description = cleanDescription(data.description);
                setMedia(data);
            }
        } catch (e) {
            console.error("Proxy Fetch Failed", e);
        } finally {
            setIsLoadingMedia(false);
        }
    };

    if (!isOpen || !quest) return null;

    // Determine Status Color
    const getStatusColor = (status: string) => {
        if (status === 'RELEASING') return `bg-${theme.accent}-500/10 text-${theme.accent}-500 border-${theme.accent}-500/20`;
        if (status === 'FINISHED') return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
        return `bg-${theme.accent}-500/10 text-${theme.accent}-500 border-${theme.accent}-500/20`;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    return (

        <div className={`fixed inset-0 z-[400] flex animate-in fade-in duration-500 manhwa-detail-backdrop`}
            data-theme={theme.isDark ? 'dark' : 'light'}
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
                        alt="Background Aura"
                    />
                ) : null}

                {/* DEPTH VIGNETTE */}
                <div className="absolute inset-0 z-[2] pointer-events-none manhwa-detail-vignette" />

                {/* LARGE AMBIENT ORB — TOP RIGHT */}
                <div className="absolute pointer-events-none z-[3] manhwa-detail-orb-top-right" />

                {/* LARGE AMBIENT ORB — BOTTOM LEFT */}
                <div className="absolute pointer-events-none z-[3] manhwa-detail-orb-bottom-left" />

                {/* SECONDARY ACCENT ORB — TOP LEFT */}
                <div className="absolute pointer-events-none z-[3] manhwa-detail-orb-top-left" />
            </div>

            {/* TOP NAVIGATION BAR */}
            <div className="absolute top-0 left-0 w-full h-20 flex justify-between items-center px-8 z-50 pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 ${theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'} shadow-[0_0_15px_currentColor]`} />
                    <div className={`font-mono text-[10px] tracking-[0.4em] ${theme.highlightText} font-bold uppercase`}>SYSTEM.ARCHIVE_INSPECTION</div>
                </div>
                <button
                    onClick={onClose}
                    className={`pointer-events-auto w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText} hover:border-current transition-colors cursor-pointer`}
                    title="Close Details"
                    aria-label="Close Details"
                >
                    <X size={16} />
                </button>
            </div>

            {/* MAIN SCROLLABLE CONTENT (CENTERED COLUMN) */}
            <div
                className="relative z-30 w-full h-full overflow-y-auto custom-scrollbar pt-16 sm:pt-24 pb-32 px-4 sm:px-8 md:px-16 manhwa-detail-scroll-container"
                data-theme={theme.isDark ? 'dark' : 'light'}
            >
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-12">

                    {/* HERO SECTION: COVER + TITLE + STATS */}
                    <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-start">
                        {/* COVER ART */}
                        <div className="shrink-0 w-[180px] md:w-[240px] lg:w-[280px] aspect-[2/3] rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 relative group mx-auto md:mx-0">
                            <motion.img
                                layoutId={`cover-${quest.id}`}
                                src={getProxiedImageUrl(finalCover)}
                                alt={quest.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 border-2 border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay pointer-events-none" />
                        </div>

                        {/* TITLE & METADATA */}
                        <div className="flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left">
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                                {media?.status && (
                                    <span className={`px-2 py-0.5 border text-[9px] font-bold tracking-widest uppercase ${getStatusColor(media.status)}`}>
                                        {media.status.replace('_', ' ')}
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 border border-white/10 bg-white/5 text-white/70 text-[9px] font-mono tracking-widest uppercase`}>
                                    CLASS: {quest.classType}
                                </span>
                            </div>

                            <h1 className="text-3xl md:text-4xl lg:text-6xl font-black text-white mb-2 leading-tight tracking-tighter drop-shadow-xl uppercase break-words">
                                {quest.title || media?.title?.english || media?.title?.romaji}
                            </h1>
                            {media?.title?.native && (
                                <h2 className="text-xl md:text-2xl text-white/50 font-medium mb-8">
                                    {media.title.native}
                                </h2>
                            )}

                            {/* PROTOCOL BUTTONS ROW */}
                            <div className="flex flex-wrap gap-3 w-full justify-center md:justify-start mt-4">
                                <button
                                    onClick={() => setIsReaderOpen(true)}
                                    className={`px-8 py-3 rounded-sm border ${theme.isDark ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.2)]'} ${theme.highlightText} font-bold transition-all flex items-center gap-3 group/dive hover:scale-105 active:scale-95 cursor-pointer`}
                                    title="Start Reading"
                                    aria-label="Start Reading"
                                >
                                    <Zap size={16} className={`${theme.highlightText} group-hover/dive:animate-pulse`} />
                                    <ScrambleText text="INITIALIZE_DIVE" className="text-[10px] tracking-[0.2em] font-orbitron" />
                                </button>
                                <button
                                    onClick={() => quest && onEdit && onEdit(quest)}
                                    className={`px-6 py-3 rounded-sm border bg-white/5 hover:bg-white/10 border-white/10 text-white font-bold transition-all flex items-center gap-3 group/edit hover:border-white/30`}
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
                                    className={`px-6 py-3 rounded-sm border bg-white/5 hover:bg-white/10 border-white/10 text-white font-bold transition-all flex items-center gap-3 group/active hover:border-white/30`}
                                >
                                    <Target size={16} className="opacity-70 group-hover/active:opacity-100 transition-opacity" />
                                    <span className="text-[10px] tracking-[0.2em] font-orbitron">MARK_TARGET</span>
                                </button>
                                {quest?.link && (
                                    <a
                                        href={quest.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`px-6 py-3 rounded-sm border bg-white/5 hover:bg-white/10 border-white/10 text-white font-bold transition-all flex items-center gap-3 group/ext hover:border-white/30`}
                                    >
                                        <ExternalLink size={16} className="opacity-70 group-hover/ext:opacity-100 transition-opacity" />
                                        <span className="text-[10px] tracking-[0.2em] font-orbitron">EXTERNAL_LINK</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* PROGRESS HUD: THE RUNIC THREAD */}
                    <motion.div variants={itemVariants} className="w-full relative group mt-4">
                        <div className={`relative rounded-xl p-4 md:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden border ${theme.isDark ? 'bg-black/40 border-white/10' : 'bg-white/60 border-slate-200/80'}`}>
                            {/* Ambient internal glow */}
                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-5 blur-xl pointer-events-none`} />

                            <div className="relative z-10 flex flex-col">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${theme.id === 'LIGHT' ? 'bg-sky-400' : 'bg-amber-400'} animate-pulse shadow-[0_0_10px_currentColor]`} />
                                        <div className={`text-[10px] font-mono font-bold tracking-[0.4em] ${theme.highlightText} uppercase`}>SYNCHRONIZATION_THREAD</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
                                        STATUS: {quest.status}
                                    </div>
                                </div>

                                {/* Numeric Readouts */}
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-5xl font-black text-white tabular-nums tracking-tighter drop-shadow-md">
                                        {quest.currentChapter}
                                    </span>
                                    <span className="text-xl font-medium text-white/30 tracking-widest">
                                        / {(quest.totalChapters || 0) > 0 ? quest.totalChapters : '∞'}
                                    </span>
                                    <span className={`ml-auto text-sm font-mono font-bold ${theme.highlightText}`}>
                                        {((quest.totalChapters || 0) > 0) ? Math.min(100, Math.round((quest.currentChapter / quest.totalChapters) * 100)) : 0}%
                                    </span>
                                </div>

                                {/* The Thread */}
                                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden relative shadow-inner">
                                    <motion.div
                                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${theme.gradient} transition-transform duration-1000 ease-out origin-left manhwa-detail-progress-bar-fill`}
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: Math.min(1, (quest.totalChapters || 0) > 0 ? (quest.currentChapter / quest.totalChapters) : 0) }}
                                    >
                                        <div className="absolute right-0 top-0 h-full w-8 bg-white opacity-50 blur-sm" />
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* TWO COLUMN DATA: SYNOPSIS & METADATA */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
                        {/* LEFT: Synopsis */}
                        <div className={`lg:col-span-2 relative p-4 md:p-8 backdrop-blur-xl rounded-xl group/synopsis border ${theme.isDark ? 'bg-black/30 border-white/5' : 'bg-white/70 border-slate-200/60'}`}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 opacity-60">
                                    <AlignLeft size={16} className={theme.isDark ? 'text-white' : 'text-slate-700'} />
                                    <span className={`text-[10px] font-mono tracking-[0.3em] font-bold uppercase ${theme.isDark ? 'text-white' : 'text-slate-700'}`}>ARCHIVE_SYNOPSIS</span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isEditingSynopsis) {
                                            if (onUpdate && quest) onUpdate(quest.id, { synopsis: draftSynopsis });
                                        } else {
                                            setDraftSynopsis(quest.synopsis || media?.description || "");
                                        }
                                        setIsEditingSynopsis(!isEditingSynopsis);
                                    }}
                                    className={`px-3 py-1 rounded border border-white/10 hover:border-white/30 text-white/50 hover:text-white text-[9px] font-mono tracking-widest uppercase transition-colors flex items-center gap-2`}
                                >
                                    {isEditingSynopsis ? <><Check size={12} /> SAVE_OVERRIDE</> : <><Edit2 size={12} /> MODIFY</>}
                                </button>
                            </div>

                            {isEditingSynopsis ? (
                                <textarea
                                    value={draftSynopsis}
                                    onChange={(e) => setDraftSynopsis(e.target.value)}
                                    className={`w-full h-48 bg-black/40 border border-white/10 rounded-lg p-4 text-sm font-sans text-white/90 focus:outline-none focus:border-white/30 transition-colors resize-y shadow-inner`}
                                    placeholder="Enter custom synopsis override..."
                                />
                            ) : (
                                <div
                                    className={`text-sm md:text-base leading-loose font-sans ${theme.isDark ? 'text-white/80' : 'text-slate-700'}`}
                                    dangerouslySetInnerHTML={{ __html: quest.synopsis || media?.description || "No synopsis available." }}
                                />
                            )}
                        </div>

                        {/* RIGHT: Quick Stats / Tags */}
                        <div className="flex flex-col gap-4">
                            <div className={`p-6 backdrop-blur-xl rounded-xl flex flex-col gap-4 border ${theme.isDark ? 'bg-black/30 border-white/5' : 'bg-white/70 border-slate-200/60'}`}>
                                <span className={`text-[10px] font-mono tracking-widest uppercase ${theme.isDark ? 'text-white/40' : 'text-slate-500'}`}>Genres</span>
                                <div className="flex flex-wrap gap-2">
                                    {media?.genres?.length ? media.genres.map(genre => (
                                        <span key={genre} className={`px-3 py-1 text-[10px] font-mono rounded-full border ${theme.isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                                            {genre}
                                        </span>
                                    )) : <span className={`text-xs ${theme.isDark ? 'text-white/20' : 'text-slate-400'}`}>UNKNOWN</span>}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* CHARACTERS ROW (API DRIVEN) */}
                    {(isLoadingMedia || media?.characters?.nodes?.length) ? (
                        <motion.div variants={itemVariants} className="mt-8">
                            <div className="flex items-center justify-between mb-6 opacity-60 px-2">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-white" />
                                    <span className="text-[10px] font-mono tracking-[0.3em] text-white font-bold uppercase">ENTITIES_DETECTED</span>
                                </div>
                                {isLoadingMedia && (
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'} animate-ping`} />
                                        <span className="text-[8px] font-mono tracking-widest text-white/40">SCANNING_ARCHIVES...</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x min-h-[140px]">
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
                                        <div key={char.id} className="w-[100px] shrink-0 snap-start flex flex-col items-center gap-3 group cursor-pointer p-4 bg-black/20 backdrop-blur-md rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                            <div className="w-[60px] h-[60px] rounded-full overflow-hidden border border-white/20 group-hover:border-white/50 transition-colors">
                                                <img src={getProxiedImageUrl(char.image.medium || char.image.large)} alt={char.name.full} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                            </div>
                                            <div className="text-center w-full">
                                                <div className="text-[10px] font-bold text-white truncate w-full">{char.name.full}</div>
                                                <div className="text-[8px] text-white/40 uppercase truncate w-full mt-1">{char.role}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    ) : null}

                    {/* SIMILAR RECORDS (PURELY DATABASE DRIVEN) */}
                    {React.useMemo(() => {
                        if (!quest) return null;

                        // 1. Strictly internal library similarity
                        const similarQuests = (allQuests || [])
                            .filter(q => q.classType === quest.classType && q.id !== quest.id)
                            .slice(0, 10); // Increased limit since it's the main discovery row now

                        if (similarQuests.length === 0) return null;

                        return (
                            <motion.div variants={itemVariants} className="mt-8">
                                <div className="flex items-center justify-between mb-6 px-2 opacity-60">
                                    <div className="flex items-center gap-2">
                                        <Share2 size={16} className="text-white" />
                                        <span className="text-[10px] font-mono tracking-[0.3em] text-white font-bold uppercase">
                                            SIMILAR_RECORDS_FOUND
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-mono tracking-widest uppercase border border-white/20 px-2 py-0.5 rounded text-white">
                                        DATABASE_SYNC: {quest.classType}
                                    </span>
                                </div>

                                <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
                                    {similarQuests.map((rec) => (
                                        <div key={rec.id} onClick={() => onSetActive && onSetActive(rec.id)} className="w-[160px] shrink-0 snap-start group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer shadow-lg border border-white/5">
                                            <img src={getProxiedImageUrl(rec.coverUrl)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" alt={rec.title} title={rec.title} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                                            <div className="absolute bottom-0 w-full p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                <div className="text-[10px] font-bold truncate text-white uppercase group-hover:textShadow-glow">
                                                    {rec.title}
                                                </div>
                                                <div className={`text-[8px] font-mono mt-1 uppercase ${theme.highlightText}`}>
                                                    {rec.status}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    }, [allQuests, quest?.classType, quest?.id, theme.highlightText, onSetActive])}
                </motion.div>
            </div>

            {/* SHARED NOISE HANDLED BY BACKGROUND CONTROLLER */}

            {/* READER OVERLAY */}
            {quest && <SystemReader
                isOpen={isReaderOpen}
                onClose={() => setIsReaderOpen(false)}
                quest={quest}
                theme={theme}
                onUpdate={onUpdate}
            />}
        </div>
    );
};

export default ManhwaDetail;
