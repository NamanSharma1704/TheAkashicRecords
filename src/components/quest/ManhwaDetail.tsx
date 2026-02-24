import React, { useState, useEffect } from 'react';
import { X, Star, Calendar, BookOpen, Users, Share2, Heart, Sword, Zap, Edit2, Save } from 'lucide-react';

import { Theme, Quest } from '../../core/types';


interface ManhwaDetailProps {
    isOpen: boolean;
    onClose: () => void;
    quest: Quest | null;
    theme: Theme;
    allQuests?: Quest[];
    onSetActive?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Quest>) => Promise<void>;
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
const ManhwaDetail: React.FC<ManhwaDetailProps> = ({ isOpen, onClose, quest, theme, allQuests, onSetActive, onUpdate }) => {
    const [media, setMedia] = useState<AniListMedia | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editSynopsis, setEditSynopsis] = useState("");
    const [editTotalCh, setEditTotalCh] = useState(0);
    const [editCurrentCh, setEditCurrentCh] = useState(0);

    const isCustomCover = !!(quest?.coverUrl && quest.coverUrl !== "");
    const finalCover = isCustomCover ? quest.coverUrl : (media?.coverImage?.extraLarge || media?.coverImage?.large || quest?.coverUrl || "");

    useEffect(() => {
        if (quest) {
            setEditTitle(quest.title);
            setEditSynopsis(quest.synopsis || ""); // Strictly from DB or empty
            setEditTotalCh(quest.totalChapters || 0); // Strictly from DB
            setEditCurrentCh(quest.currentChapter || 0);
        }
    }, [quest, isEditing]);

    const handleSaveEdits = async () => {
        if (quest && onUpdate) {
            await onUpdate(quest.id, {
                title: editTitle,
                synopsis: editSynopsis,
                totalChapters: editTotalCh,
                currentChapter: editCurrentCh
            });
            setIsEditing(false);
        }
    };

    console.log("ManhwaDetail Quest:", quest);

    // Fetch Details on Open
    useEffect(() => {
        if (isOpen && quest) {
            setMedia(null);
            setError(null);
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
                extraLarge: quest?.coverUrl || "",
                large: quest?.coverUrl || ""
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
            .replace(/(?:---|\*\*\*)\s*(?:\*\*|\[b\])?(?:Original Webcomic|Official Translations|Links)(?:\*\*|\[\/b\])?[\s\S]*$/i, '')
            .split(/\s*-{3,}\s*$/)[0] // Remove trailing horizontal rules
            .trim();
    };

    // --- PROXY API FETCH ---
    const fetchFromProxy = async (title: string): Promise<AniListMedia | null> => {
        try {
            const res = await fetch(`/api/proxy/metadata?title=${encodeURIComponent(title)}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("[Proxy] Fetch Failed", e);
            return null;
        }
    };

    const fetchDetails = async (title: string) => {
        setLoading(true);
        setError(null);

        // 1. Check Manual Metadata First
        if (MANUAL_METADATA[title]) {
            setMedia(MANUAL_METADATA[title]);
            setLoading(false);
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
            } else {
                setError("NO RECORDS FOUND IN ARCHIVES");
            }
        } catch (e) {
            console.error("Proxy Fetch Failed", e);
            setError("ARCHIVE CONNECTION SEVERED");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !quest) return null;

    // Determine Status Color
    const getStatusColor = (status: string) => {
        if (status === 'RELEASING') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        if (status === 'FINISHED') return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
        return `bg-${theme.accent}-500/10 text-${theme.accent}-500 border-${theme.accent}-500/20`;
    };

    return (
        <div className={`fixed inset-0 z-[70] ${theme.appBg} flex items-center justify-center animate-in fade-in zoom-in-95 duration-300`}>
            {/* BACKDROP BLUR & DARKEN */}
            <div className={`absolute inset-0 ${theme.isDark ? 'bg-black/95' : 'bg-white/95'} backdrop-blur-xl transition-colors duration-700`} onClick={onClose} />

            {/* BACKGROUND FX */}
            <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                <div className={`absolute -top-[20%] -right-[20%] w-[50%] h-[50%] bg-${theme.primary}-500/20 rounded-full blur-[120px]`} />
                <div className={`absolute -bottom-[20%] -left-[20%] w-[50%] h-[50%] bg-${theme.accent}-500/20 rounded-full blur-[120px]`} />
            </div>

            {/* MAIN CONTENT CARD */}
            <div className={`relative w-[95vw] max-w-[1800px] h-full md:h-[95vh] mx-auto md:rounded-2xl border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/50' : 'bg-white/50'} shadow-2xl overflow-hidden flex flex-col md:flex-row`}>

                {/* CLOSE BUTTON */}
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 z-50 p-2 rounded-full ${theme.isDark ? 'bg-black/50 hover:bg-white/10' : 'bg-white/50 hover:bg-black/10'} ${theme.baseText} backdrop-blur-md transition-all border ${theme.borderSubtle}`}
                >
                    <X size={20} />
                </button>

                {/* LEFT COLUMN: VISUALS (COVER + BANNER) */}
                <div className="w-full md:w-[400px] lg:w-[450px] shrink-0 relative flex flex-col border-b md:border-b-0 md:border-r border-white/5 group">
                    {/* Background Banner (Blurred) */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                        {(quest?.coverUrl || media?.bannerImage || finalCover) ? (
                            <img src={quest?.coverUrl || media?.bannerImage || finalCover} className={`w-full h-full object-cover blur-xl ${theme.isDark ? 'opacity-50' : 'opacity-80'} scale-110`} referrerPolicy="no-referrer" />
                        ) : null}
                        <div className={`absolute inset-0 bg-gradient-to-b ${theme.isDark ? 'from-transparent via-[#020202]/50 to-[#020202]' : 'from-transparent via-white/50 to-white'}`} />
                    </div>

                    {/* Main Cover Image */}
                    <div className="relative z-10 flex-1 flex items-center justify-center p-8 md:p-12 pb-0 md:pb-8">
                        <div className={`relative w-[240px] md:w-full max-w-[320px] aspect-[2/3] shadow-2xl rounded-xl overflow-hidden border border-white/10 group-hover:scale-[1.02] transition-transform duration-700 ease-out`}>
                            <img
                                src={finalCover}
                                alt={quest.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                            {/* Overlay Gradient for Text Visibility */}
                            <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black/90' : 'from-black/40'} via-transparent to-transparent opacity-80`} />

                            {/* Stats Overlay on Cover (Reference Style) */}
                            <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end">
                                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm drop-shadow-md">
                                    <Star size={16} fill="currentColor" />
                                    <span>{media?.averageScore || 0}%</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-white/90 font-mono text-xs drop-shadow-md">
                                    <Heart size={14} fill="currentColor" />
                                    <span>{(media?.averageScore || 0) * 123 / 10}K</span>
                                </div>
                            </div>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="relative z-10 p-6 md:p-12 pt-6 flex flex-col gap-3">
                        {quest?.link && (
                            <a
                                href={quest.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-full py-3.5 rounded-lg ${theme.isDark ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20'} text-emerald-500 font-bold border border-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]`}
                            >
                                <Zap size={16} className="fill-emerald-500/20" /> INITIALIZE DIVE
                            </a>
                        )}
                        <button
                            onClick={() => isEditing ? handleSaveEdits() : setIsEditing(true)}
                            className={`w-full py-3.5 rounded-lg ${theme.isDark ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'bg-cyan-500/10 hover:bg-cyan-500/20'} ${theme.highlightText} font-bold border ${theme.borderSubtle} transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest`}
                        >
                            {isEditing ? <><Save size={16} /> SAVE_CHANGES</> : <><Edit2 size={16} /> EDIT_MANHWA</>}
                        </button>
                        <button
                            onClick={() => {
                                if (quest && onSetActive) {
                                    onSetActive(quest.id);
                                    onClose();
                                }
                            }}
                            className={`w-full py-3.5 rounded-lg ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} ${theme.baseText} font-bold border ${theme.borderSubtle} transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest`}
                        >
                            <Sword size={16} /> SET AS ACTIVE QUEST
                        </button>
                    </div>
                </div>

                {/* RIGHT COLUMN: DETAILS */}
                <div
                    className="flex-1 overflow-y-auto custom-scrollbar relative"
                    style={{
                        '--scrollbar-thumb': theme.id === 'LIGHT' ? '#0ea5e9' : '#f59e0b', // Sky-500 : Amber-500
                        '--scrollbar-track': 'transparent',
                        '--scrollbar-thumb-hover': theme.id === 'LIGHT' ? '#0284c7' : '#d97706' // Sky-600 : Amber-600
                    } as React.CSSProperties}
                >
                    <div className="p-6 md:p-12 pb-32">
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-full py-20 animate-pulse">
                                <div className={`text-xl font-mono ${theme.highlightText} tracking-widest`}>ACCESSING ARCHIVES...</div>
                            </div>
                        )}

                        {!loading && media && (
                            <div className="flex flex-col gap-10 animate-in slide-in-from-bottom-4 duration-700">

                                {/* HEADER SECTION */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <input
                                                    className={`w-full bg-transparent border-b ${theme.borderSubtle} focus:border-${theme.highlightText} outline-none text-3xl md:text-5xl font-black ${theme.headingText} mb-2 leading-tight tracking-tight uppercase`}
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                />
                                            ) : (
                                                <h1 className={`text-3xl md:text-5xl font-black ${theme.headingText} mb-2 leading-tight tracking-tight drop-shadow-lg uppercase break-words`}>
                                                    {quest.title || media.title.english || media.title.romaji}
                                                </h1>
                                            )}
                                            {(media.title.native) && !isEditing && (
                                                <h2 className={`text-lg md:text-xl ${theme.mutedText} font-medium mb-2`}>
                                                    {media.title.native}
                                                </h2>
                                            )}
                                        </div>
                                    </div>

                                    {/* PROGRESS BAR */}
                                    {quest.status === 'ACTIVE' && (
                                        <div className="w-full mt-6 group relative">
                                            <div className="border border-white/10 rounded-xl p-4 md:p-6 bg-black/40 backdrop-blur-sm shadow-xl">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className={`text-[10px] font-bold font-mono tracking-widest ${theme.mutedText} uppercase opacity-60`}>CHAPTER PROGRESS</div>
                                                </div>

                                                {isEditing ? (
                                                    <div className="flex justify-between items-end mb-2">
                                                        <div className="flex flex-col">
                                                            <div className={`text-[8px] uppercase tracking-widest ${theme.mutedText} pb-1`}>CURRENT</div>
                                                            <input type="number" value={editCurrentCh} onChange={e => setEditCurrentCh(Number(e.target.value))} className={`w-24 bg-transparent border-b border-gray-500/50 outline-none text-2xl font-black ${theme.highlightText} tabular-nums text-left`} />
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className={`text-[8px] uppercase tracking-widest ${theme.mutedText} pb-1`}>TOTAL</div>
                                                            <input type="number" value={editTotalCh} onChange={e => setEditTotalCh(Number(e.target.value))} className={`w-24 bg-transparent border-b border-gray-500/50 outline-none text-xl font-bold ${theme.highlightText} tabular-nums text-right`} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-end mb-1">
                                                        <div className={`text-2xl md:text-3xl font-black ${theme.isDark ? 'text-amber-400' : 'text-cyan-500'} tabular-nums leading-none`}>
                                                            {quest.currentChapter}
                                                        </div>
                                                        <div className={`text-sm md:text-base font-bold ${theme.isDark ? 'text-amber-400' : 'text-cyan-500'} tabular-nums opacity-80 leading-none`}>
                                                            <div className={`text-[8px] uppercase tracking-widest ${theme.mutedText} pb-1 flex justify-end`}>TOTAL</div>
                                                            {quest.totalChapters > 0 ? quest.totalChapters : '0'}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BAR ITSELF */}
                                                <div className={`h-2.5 w-full ${theme.isDark ? 'bg-white/10' : 'bg-black/5'} rounded-full overflow-hidden relative shadow-inner`}>
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${theme.gradient} progress-bloom transition-all duration-700 ease-out`}
                                                        style={{
                                                            width: `${Math.min(100, (quest.totalChapters || 0) > 0 ? (quest.currentChapter / quest.totalChapters) * 100 : 0)}%`,
                                                            color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24',
                                                            boxShadow: '0 0 10px currentColor'
                                                        }}
                                                    />
                                                </div>

                                                {/* SUB-LABELS */}
                                                {!isEditing && (
                                                    <div className="flex justify-between items-center mt-2 text-[8px] md:text-[10px] font-mono font-bold uppercase tracking-wider">
                                                        <div className={`${theme.mutedText} opacity-70`}>CH {quest.currentChapter}</div>
                                                        <div className={`${theme.isDark ? 'text-amber-500' : 'text-cyan-600'} opacity-90`}>
                                                            {(quest.totalChapters || 0) > 0 ? Math.round((quest.currentChapter / quest.totalChapters) * 100) : 0}%
                                                        </div>
                                                        <div className={`${theme.mutedText} opacity-70`}>/ {(quest.totalChapters || 0) > 0 ? quest.totalChapters : 'ONGOING'}</div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`absolute -inset-2 bg-gradient-to-r ${theme.gradient} opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-700 pointer-events-none`} />
                                        </div>
                                    )}

                                    {/* PILLS ROW */}
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <div className={`px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300 flex items-center gap-2`}>
                                            <BookOpen size={12} /> {media.status ? media.status.charAt(0) + media.status.slice(1).toLowerCase().replace('_', ' ') : 'Unknown'}
                                        </div>
                                        <div className={`px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300 flex items-center gap-2`}>
                                            <Calendar size={12} /> {media.seasonYear || 'Unknown'}
                                        </div>
                                        {media.status && (
                                            <div className={`px-3 py-1.5 border border-white/20 rounded text-xs font-bold tracking-wider uppercase ${getStatusColor(media.status)} bg-transparent`}>
                                                {media.status.replace('_', ' ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* GENRES */}
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {media.genres.map(genre => (
                                            <span key={genre} className={`px-3 py-1 text-xs font-medium border border-white/10 rounded-full bg-white/5 text-gray-400 hover:text-white hover:border-white/30 transition-colors cursor-default`}>
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* SYNOPSIS */}
                                <div>
                                    <div className={`text-xs font-bold ${theme.mutedText} uppercase tracking-widest mb-3 flex items-center justify-between`}>
                                        <span>SYNOPSIS</span>
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            className={`w-full min-h-[200px] p-4 bg-black/20 backdrop-blur-sm border ${theme.borderSubtle} focus:border-${theme.highlightText} outline-none text-sm md:text-base leading-relaxed ${theme.baseText} font-sans rounded-xl resize-y custom-scrollbar`}
                                            value={editSynopsis}
                                            onChange={e => setEditSynopsis(e.target.value)}
                                            placeholder="Enter synopsis..."
                                        />
                                    ) : (
                                        <div
                                            className={`text-sm md:text-base leading-relaxed ${theme.baseText} font-sans`}
                                            dangerouslySetInnerHTML={{ __html: quest.synopsis || "No synopsis available." }}
                                        />
                                    )}
                                </div>

                                {/* CHARACTERS */}
                                {media.characters?.nodes?.length > 0 && (
                                    <div>
                                        <div className={`text-xs font-bold ${theme.mutedText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                                            <Users size={14} /> CHARACTERS
                                        </div>
                                        <div className="flex overflow-x-auto gap-6 pb-4 custom-scrollbar snap-x">
                                            {media.characters.nodes.map(char => (
                                                <div key={char.id} className="w-[80px] shrink-0 snap-start flex flex-col items-center gap-2 group cursor-pointer">
                                                    <div className={`w-[80px] h-[80px] rounded-full overflow-hidden border-2 ${theme.borderSubtle} group-hover:border-${theme.highlightText} transition-colors relative`}>
                                                        <img src={char.image.large} alt={char.name.full} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                                    </div>
                                                    <div className="text-center w-full">
                                                        <div className={`text-[10px] font-bold ${theme.headingText} truncate w-full`}>{char.name.full}</div>
                                                        <div className={`text-[8px] ${theme.mutedText} uppercase truncate w-full`}>{char.role}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SIMILAR RECORDS */}
                                {media.recommendations?.nodes?.length > 0 && (
                                    <div>
                                        <div className={`text-xs font-bold ${theme.mutedText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                                            <Share2 size={14} /> SIMILAR RECORDS
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {media.recommendations?.nodes
                                                ?.filter((node: any) => {
                                                    if (!allQuests) return true; // Show all if no tracker context
                                                    const recTitle = node.mediaRecommendation.title.english || node.mediaRecommendation.title.romaji || "";
                                                    const cleanRec = recTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                                                    return allQuests.some(q => {
                                                        const cleanQuest = q.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                                                        return cleanQuest.includes(cleanRec) || cleanRec.includes(cleanQuest);
                                                    });
                                                })
                                                .map((node: any) => {
                                                    const rec = node.mediaRecommendation;
                                                    return (
                                                        <div key={rec.id} className="group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-500">
                                                            <img src={rec.coverImage?.large} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                                                            <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black/90 via-transparent' : 'from-white/90 via-transparent'} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                                            <div className="absolute bottom-0 w-full p-2">
                                                                <div className={`text-[10px] font-bold truncate ${theme.headingText} group-hover:${theme.highlightText} transition-colors uppercase`}>
                                                                    {rec.title.english || rec.title.romaji}
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <Star size={8} className="text-yellow-500 fill-yellow-500" />
                                                                    <span className={`text-[9px] font-mono ${theme.mutedText}`}>
                                                                        {rec.averageScore ? `${rec.averageScore}%` : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!loading && !media && !error && (
                            <div className="text-center py-20 font-mono text-xs opacity-50">INITIALIZING SCAN...</div>
                        )}

                        {error && (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                                <div className="text-red-500 font-mono mb-2 uppercase tracking-widest">{error}</div>
                                <div className={`text-xs ${theme.mutedText}`}>Data could not be retrieved from the Akashic Records.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManhwaDetail;
