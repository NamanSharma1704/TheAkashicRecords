import React, { useState, useEffect } from 'react';
import { Theme, Quest } from '../../core/types';
import SystemFrame from './SystemFrame';
import { X, RefreshCw, AlertCircle, CheckCircle, Database, Search, Activity, Trash2 } from 'lucide-react';
import { fetchMangadex, fetchAuto, fetchAnilistCover, fetchJikanCover, getProxiedImageUrl } from '../../utils/api';

interface SystemGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Quest>) => void;
    onDelete: () => void;
    initialData: Quest | null;
    theme: Theme;
    existingQuests: Quest[];
}

// --- SYSTEM GATE MODAL (Controlled Form with Scan Logic) ---
const SystemGateModal: React.FC<SystemGateModalProps> = ({ onClose, onSave, onDelete, initialData, theme, existingQuests }) => {
    const [formData, setFormData] = useState<Partial<Quest>>({
        title: '',
        currentChapter: 0,
        totalChapters: 0, // Default to 0 to indicate unknown
        status: 'ACTIVE',
        classType: 'PLAYER',
        coverUrl: '',
        link: '',
        synopsis: ''
    });
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState("IDLE"); // IDLE, SCANNING, SUCCESS, ERROR, ENCRYPTED
    const [searchSource, setSearchSource] = useState("AUTO"); // AUTO, ANILIST, MAL, MANGADEX
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const val = type === 'number' ? (value === "" ? 0 : Number(value)) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };


    // --- HELPER TO GUESS CLASS ---
    const inferClassFromTitle = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('necromancer') || t.includes('undead')) return "NECROMANCER";
        if (t.includes('mage') || t.includes('magic') || t.includes('constellation') || t.includes('star')) return "CONSTELLATION";
        if (t.includes('irregular') || t.includes('tower')) return "IRREGULAR";
        if (t.includes('return') || t.includes('reincarnat') || t.includes('wizard')) return "MAGE";
        return "PLAYER";
    };

    const handleTitleSearch = async () => {
        if (!formData.title) return;
        setIsScanning(true);
        setScanStatus("SCANNING");

        let result = null;

        // Source Routing Logic
        if (searchSource === "AUTO") {
            result = await fetchAuto(formData.title);
        } else if (searchSource === "ANILIST") {
            result = await fetchAnilistCover(formData.title);
        } else if (searchSource === "MAL") {
            result = await fetchJikanCover(formData.title);
        } else if (searchSource === "MANGADEX") {
            result = await fetchMangadex(formData.title);
        }

        if (result) {
            const newTitle = result.title.english || result.title.romaji || formData.title;
            setFormData(prev => ({
                ...prev,
                title: prev.title && prev.title !== "" ? prev.title : newTitle,
                coverUrl: result.coverImage?.extraLarge || prev.coverUrl,
                totalChapters: result.chapters || prev.totalChapters,
                synopsis: result.description || prev.synopsis,
                classType: prev.classType === 'UNKNOWN' ? inferClassFromTitle(newTitle) : prev.classType
            }));
            setScanStatus("SUCCESS");
        } else {
            setScanStatus("ERROR");
        }
        setIsScanning(false);
    }

    const handleScan = async () => {
        if (!formData.link) return;
        setIsScanning(true);
        setScanStatus("SCANNING");

        // DELAY FOR SYSTEM EFFECT
        await new Promise(r => setTimeout(r, 1000));

        let inferredTitle = "UNKNOWN ARTIFACT";
        let fetchedData = null;
        let isEncrypted = false;

        try {
            // 1. EXTRACT TITLE FROM URL
            const url = new URL(formData.link!);
            const hostname = url.hostname.toLowerCase();
            const pathSegments = url.pathname.split('/').filter(Boolean);
            let slug = pathSegments[pathSegments.length - 1];

            // Handle common structures: /manga/title-slug-id or /series/title-slug
            if (slug.match(/chapter-\d+$/i) || slug.match(/ch-\d+$/i)) {
                slug = pathSegments[pathSegments.length - 2] || slug;
            }

            // Site-Specific Overrides
            if (hostname.includes('mangadex.org')) {
                // /title/uuid/slug
                if (pathSegments[0] === 'title' && pathSegments.length >= 3) {
                    slug = pathSegments[2];
                } else if (pathSegments[0] === 'title' && pathSegments.length === 2) {
                    // It's just /title/uuid
                    isEncrypted = true;
                }
            } else if (hostname.includes('webtoons.com')) {
                if (['list', 'viewer', 'rss'].includes(slug.toLowerCase())) {
                    slug = pathSegments[pathSegments.length - 2] || slug;
                }
            } else if (hostname.includes('asuracomic') || hostname.includes('asura')) {
                // /series/title-slug-randomid
                if (pathSegments[0] === 'series' && pathSegments.length >= 2) {
                    slug = pathSegments[1];
                }
            }

            if (slug && !isEncrypted) {
                // CLEANUP: 
                // 1. Remove common URL junk like "-manhwa", "-manga", "-comic"
                // 2. Remove trailing hash-like IDs (e.g. title-827364)
                let cleanedSlug = slug
                    .replace(/-(manhwa|manga|comic|webtoon|novel)$/i, '')
                    .replace(/-[a-f0-9]{8,}$/i, '') // Remove long hex IDs
                    .replace(/-[0-9]{4,}$/i, '');   // Remove long numeric IDs

                const parts = cleanedSlug.split('-').filter(p => p.length > 0);
                inferredTitle = parts.join(' ').toUpperCase();

                if (inferredTitle.length < 3) inferredTitle = "UNKNOWN ARTIFACT";
            }

            if (!isEncrypted && inferredTitle !== "UNKNOWN ARTIFACT") {
                // 2. FETCH COVER BASED ON SOURCE SETTING
                if (searchSource === "AUTO") {
                    fetchedData = await fetchAuto(inferredTitle);
                } else if (searchSource === "ANILIST") {
                    fetchedData = await fetchAnilistCover(inferredTitle);
                } else if (searchSource === "MAL") {
                    fetchedData = await fetchJikanCover(inferredTitle);
                } else if (searchSource === "MANGADEX") {
                    fetchedData = await fetchMangadex(inferredTitle);
                }
            } else {
                setScanStatus("ENCRYPTED");
            }

        } catch (e) {
            console.error("Scanning failed", e);
            setScanStatus("ERROR");
        }

        if (!isEncrypted) {
            // Use fetched data if available, otherwise rely on inferred title
            const finalTitle = fetchedData?.title?.english || fetchedData?.title?.romaji || inferredTitle;

            setFormData(prev => ({
                ...prev,
                title: prev.title && prev.title.trim() !== "" ? prev.title : (finalTitle !== "UNKNOWN ARTIFACT" ? finalTitle : prev.title),
                classType: prev.classType && prev.classType !== 'UNKNOWN' ? prev.classType : inferClassFromTitle(finalTitle),
                coverUrl: fetchedData?.coverImage?.extraLarge || prev.coverUrl,
                totalChapters: fetchedData?.chapters || prev.totalChapters,
                currentChapter: prev.currentChapter === 0 ? 1 : prev.currentChapter
            }));
            setScanStatus("SUCCESS");
        }

        setIsScanning(false);
    };

    // --- EVENT HANDLERS ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // VALIDATION: REQUIRED FIELDS
        if (!formData.title?.trim()) {
            setError("TITLE IS REQUIRED");
            return;
        }
        if (!formData.link?.trim()) {
            setError("LINK (COORDINATES) REQUIRED");
            return;
        }

        // DUPLICATE CHECK
        const isEditing = !!initialData;
        const titleChanged = isEditing && initialData.title?.trim().toLowerCase() !== formData.title?.trim().toLowerCase();

        if (!isEditing || titleChanged) {
            const isDuplicate = existingQuests.some(q => q.title.trim().toLowerCase() === formData.title?.trim().toLowerCase());
            if (isDuplicate) {
                setError("ARTIFACT ALREADY EXISTS IN DATABASE");
                return;
            }
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 transition-colors duration-700 animate-in fade-in zoom-in-95 duration-200">
            <SystemFrame variant="full" theme={theme} className="w-full max-w-lg max-h-[92dvh] transition-all">
                <div className="flex flex-col h-full overflow-hidden">

                    {/* ── HEADER ── */}
                    <div className={`flex justify-between items-center px-5 py-3.5 border-b ${theme.borderSubtle} shrink-0 bg-black/30`}>
                        <span className={`${theme.highlightText} font-mono tracking-widest text-[11px] sm:text-sm flex items-center gap-2.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-amber-500 animate-ping' : 'bg-amber-500/50'}`} />
                            <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
                            {isScanning ? 'ANALYZING_COORDINATES...' : 'SYSTEM_OVERWRITE'}
                        </span>
                        <button
                            onClick={onClose}
                            className={`w-7 h-7 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} hover:border-white/30 transition-all duration-300 rounded-sm active:scale-90`}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* ── SCROLLABLE BODY ── */}
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">

                        {/* VALIDATION ERROR */}
                        {error && (
                            <div className="bg-red-500/10 border-l-2 border-red-500 text-red-400 px-3 py-2 text-[9px] tracking-[0.2em] font-orbitron flex items-center gap-2.5">
                                <AlertCircle size={12} className="shrink-0" />
                                <span className="uppercase">{error}</span>
                            </div>
                        )}

                        {/* ── LINK COORDINATES ── */}
                        <div className="space-y-2">
                            <div className={`flex justify-between items-center pb-1.5 border-b ${theme.borderSubtle}`}>
                                <label className={`${theme.mutedText} uppercase text-[8px] tracking-[0.3em] font-orbitron`}>Link_Coordinates</label>
                                <div className="flex gap-0.5">
                                    {['AUTO', 'ANILIST', 'MAL', 'MANGADEX'].map(src => (
                                        <button
                                            key={src}
                                            type="button"
                                            onClick={() => setSearchSource(src)}
                                            className={`text-[7px] font-orbitron font-bold tracking-widest px-2 py-0.5 transition-all duration-300 ${searchSource === src ? `${theme.highlightText} border-b border-amber-500` : `${theme.mutedText} hover:text-white`}`}
                                        >
                                            {src}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative group">
                                <input
                                    id="quest-link"
                                    name="link"
                                    value={formData.link}
                                    onChange={handleChange}
                                    placeholder="ENTER_PROTOCOL_URL"
                                    className={`w-full bg-black/30 border-b-2 ${theme.borderSubtle} focus:border-amber-500/80 pr-28 pl-3 py-2.5 ${theme.baseText} outline-none transition-all duration-500 font-mono text-[10px] placeholder:opacity-25`}
                                />
                                <div className={`absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r ${theme.gradient} group-focus-within:w-[calc(100%-7rem)] transition-all duration-700`} />
                                <button
                                    type="button"
                                    onClick={handleScan}
                                    disabled={!formData.link || isScanning}
                                    className={`absolute right-0 top-0 h-full px-4 font-orbitron text-[8px] font-bold tracking-wider border-l ${theme.borderSubtle} ${theme.highlightText} hover:bg-amber-500 hover:text-black disabled:opacity-25 transition-all duration-300 flex items-center gap-1.5 bg-black/40 active:scale-95 overflow-hidden group/btn`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                    {isScanning ? <Activity size={10} className="animate-pulse" /> : <Search size={10} />}
                                    SCAN_CORE
                                </button>
                            </div>

                            {/* SCAN STATUS */}
                            {scanStatus && scanStatus !== 'IDLE' && (
                                <div className="pt-0.5">
                                    {scanStatus === 'ENCRYPTED' && <div className={`${theme.highlightText} text-[8px] tracking-[0.2em] font-orbitron flex items-center gap-2 animate-pulse`}><AlertCircle size={9} /> COORDINATES ENCRYPTED. INPUT TRUE NAME.</div>}
                                    {scanStatus === 'ERROR' && <div className="text-red-500 text-[8px] tracking-[0.2em] font-orbitron flex items-center gap-2"><AlertCircle size={9} /> SCAN FAILED. NO MATCH FOUND.</div>}
                                    {scanStatus === 'SUCCESS' && <div className={`${theme.highlightText} text-[8px] tracking-[0.2em] font-orbitron flex items-center gap-2`}><CheckCircle size={9} /> SCAN COMPLETE. ARTIFACT ACQUIRED.</div>}
                                </div>
                            )}
                        </div>

                        {/* ── ARTIFACT NOMENCLATURE ── */}
                        <div className="space-y-2">
                            <label className={`block ${theme.mutedText} uppercase text-[8px] tracking-[0.3em] font-orbitron`}>Artifact_Nomenclature</label>
                            <div className="relative group">
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="DESCRIPTOR_REQUIRED"
                                    className={`w-full bg-black/30 border-b-2 ${theme.borderSubtle} focus:border-amber-500/80 pr-12 pl-3 py-2.5 ${theme.headingText} outline-none transition-all duration-500 font-orbitron font-bold text-base sm:text-lg italic tracking-tight placeholder:opacity-20`}
                                />
                                <div className={`absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r ${theme.gradient} group-focus-within:w-[calc(100%-3rem)] transition-all duration-700`} />
                                <button
                                    type="button"
                                    onClick={handleTitleSearch}
                                    disabled={!formData.title || isScanning}
                                    className={`absolute right-0 top-0 h-full px-3 border-l ${theme.borderSubtle} ${theme.highlightText} hover:bg-amber-500/20 disabled:opacity-25 transition-all duration-300 flex items-center justify-center bg-black/40 active:scale-90 group/archive`}
                                    title="Search Archives for Cover Art"
                                >
                                    <Database size={14} className="group-hover/archive:scale-110 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* ── CHAPTER METRICS ── */}
                        <div className={`grid grid-cols-2 gap-3 p-3 border ${theme.borderSubtle} bg-white/[0.03] rounded-sm relative`}>
                            <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${theme.border} opacity-50`} />
                            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${theme.border} opacity-50`} />

                            {/* WISDOM FLOOR */}
                            <div className="space-y-1.5">
                                <label className={`block ${theme.mutedText} uppercase text-[8px] font-orbitron tracking-[0.2em] truncate`}>Wisdom_Floor</label>
                                <div className="relative">
                                    <input
                                        name="currentChapter"
                                        type="number"
                                        value={formData.currentChapter}
                                        onFocus={(e) => e.target.select()}
                                        onChange={handleChange}
                                        className={`w-full bg-black/50 border ${theme.borderSubtle} hover:border-amber-500/40 focus:${theme.border} py-2 px-3 ${theme.baseText} outline-none transition-all font-mono text-center text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                    />
                                    <div className="absolute top-0 right-0 w-0.5 h-full bg-gradient-to-b from-amber-500/30 to-transparent" />
                                </div>
                                <p className={`text-[7px] font-orbitron ${theme.mutedText} tracking-widest opacity-50`}>CURRENT CH.</p>
                            </div>

                            {/* TERMINAL STATE */}
                            <div className="space-y-1.5">
                                <label className={`block ${theme.mutedText} uppercase text-[8px] font-orbitron tracking-[0.2em] truncate`}>Terminal_State</label>
                                <div className="relative">
                                    <input
                                        name="totalChapters"
                                        type="number"
                                        value={formData.totalChapters}
                                        onFocus={(e) => e.target.select()}
                                        onChange={handleChange}
                                        className={`w-full bg-black/50 py-2 px-3 ${theme.baseText} outline-none transition-all font-mono text-center text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${formData.totalChapters === 0
                                            ? 'border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                            : `border ${theme.borderSubtle} hover:border-amber-500/40 focus:${theme.border}`
                                            }`}
                                    />
                                    <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-amber-500/30 to-transparent" />
                                </div>
                                {formData.totalChapters === 0 ? (
                                    <p className="text-[7px] font-orbitron text-red-400/80 tracking-widest flex items-center gap-1">
                                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse shrink-0" />
                                        REQUIRED
                                    </p>
                                ) : (
                                    <p className={`text-[7px] font-orbitron ${theme.mutedText} tracking-widest opacity-50`}>TOTAL CH.</p>
                                )}
                            </div>
                        </div>

                        {/* ── VISUAL MANIFEST ── */}
                        <div className="space-y-2">
                            <label className={`block ${theme.mutedText} uppercase text-[8px] tracking-[0.3em] font-orbitron`}>Visual_Manifest</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="group relative shrink-0 self-start">
                                    <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient} opacity-0 group-hover:opacity-20 blur transition-opacity`} />
                                    {formData.coverUrl ? (
                                        <img
                                            src={getProxiedImageUrl(formData.coverUrl)}
                                            alt="Preview"
                                            className={`w-16 h-24 sm:w-20 sm:h-28 object-cover border ${theme.borderSubtle} group-hover:${theme.border} transition-colors rounded-sm relative z-10`}
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className={`w-16 h-24 sm:w-20 sm:h-28 border border-dashed ${theme.borderSubtle} flex flex-col items-center justify-center relative z-10 bg-black/20 gap-2`}>
                                            <AlertCircle size={16} className="text-white/10" />
                                            <span className={`text-[6px] font-orbitron ${theme.mutedText} opacity-40 tracking-widest`}>NO DATA</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2 min-w-0">
                                    <label className={`block ${theme.mutedText} uppercase text-[7px] tracking-[0.3em] font-orbitron opacity-60`}>Image URL Encoding</label>
                                    <input
                                        name="coverUrl"
                                        value={formData.coverUrl}
                                        onChange={handleChange}
                                        placeholder="IMAGE_LINK_ENCODING"
                                        className={`w-full bg-black/30 border-b ${theme.borderSubtle} focus:border-amber-500/60 px-2 py-2 ${theme.baseText} outline-none transition-all font-mono text-[9px] truncate`}
                                    />
                                    <p className={`text-[8px] font-mono ${theme.mutedText} opacity-30 italic truncate`}>
                                        {formData.coverUrl || 'WAITING_FOR_DATA...'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── CLASSIFICATION GRID ── */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className={`block ${theme.mutedText} uppercase text-[8px] font-orbitron tracking-[0.2em]`}>Protocol_Status</label>
                                <div className="relative">
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className={`w-full appearance-none bg-black/50 border-b-2 ${theme.borderSubtle} focus:border-amber-500/80 px-3 py-2.5 ${theme.headingText} hover:bg-white/5 outline-none transition-all font-orbitron font-bold text-[9px] tracking-widest cursor-pointer`}
                                    >
                                        <option value="ACTIVE" className="bg-black text-amber-500">_ACTIVE</option>
                                        <option value="CONQUERED" className="bg-black text-blue-500">_CONQUERED</option>
                                        <option value="SEVERED" className="bg-black text-red-500">_SEVERED</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white" />
                                    </div>
                                    <div className={`absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r ${theme.gradient} opacity-20`} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={`block ${theme.mutedText} uppercase text-[8px] font-orbitron tracking-[0.2em]`}>Entity_Class</label>
                                <div className="relative">
                                    <select
                                        name="classType"
                                        value={formData.classType}
                                        onChange={handleChange}
                                        className={`w-full appearance-none bg-black/50 border-b-2 ${theme.borderSubtle} focus:border-amber-500/80 px-3 py-2.5 ${theme.headingText} hover:bg-white/5 outline-none transition-all font-orbitron font-bold text-[9px] tracking-widest cursor-pointer`}
                                    >
                                        <option value="PLAYER" className="bg-black">_PLAYER</option>
                                        <option value="IRREGULAR" className="bg-black">_IRREGULAR</option>
                                        <option value="MAGE" className="bg-black">_MAGE</option>
                                        <option value="CONSTELLATION" className="bg-black">_CONSTELLATION</option>
                                        <option value="NECROMANCER" className="bg-black">_NECROMANCER</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white" />
                                    </div>
                                    <div className={`absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r ${theme.gradient} opacity-20`} />
                                </div>
                            </div>
                        </div>

                        {/* ── SYNOPSIS ── */}
                        <div className="space-y-1.5">
                            <label className={`block ${theme.mutedText} uppercase text-[8px] font-orbitron tracking-[0.3em]`}>Memetic_Imprint</label>
                            <div className="relative group">
                                <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${theme.border} opacity-30`} />
                                <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${theme.border} opacity-30`} />
                                <textarea
                                    name="synopsis"
                                    value={formData.synopsis}
                                    onChange={(e) => setFormData(prev => ({ ...prev, synopsis: e.target.value }))}
                                    placeholder="COLLECTING_RESONANCE_DATA..."
                                    className={`w-full h-20 bg-black/30 border ${theme.borderSubtle} focus:${theme.border} px-3 py-2.5 ${theme.baseText} outline-none transition-all duration-500 font-rajdhani italic text-[11px] resize-none custom-scrollbar group-hover:bg-white/5`}
                                />
                            </div>
                        </div>

                    </div>

                    {/* ── STICKY FOOTER ── */}
                    <div className={`px-5 py-3.5 bg-black/70 backdrop-blur-md border-t ${theme.borderSubtle} flex gap-3 shrink-0 relative overflow-hidden`}>
                        <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent`} />

                        {initialData && (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="w-12 h-12 border border-red-900/40 text-red-500/70 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-500 flex items-center justify-center shrink-0 group relative overflow-hidden rounded-sm"
                                title="PURGE_ARTIFACT"
                            >
                                <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/20 transition-all" />
                                <Trash2 size={16} className="relative z-10 group-active:scale-75 transition-transform" />
                            </button>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={isScanning}
                            className={`flex-1 relative border ${theme.border} ${theme.highlightText} hover:bg-amber-500 hover:text-black font-orbitron font-black uppercase tracking-[0.25em] text-[11px] sm:text-sm transition-all duration-500 disabled:opacity-30 flex items-center justify-center gap-2.5 active:scale-[0.98] overflow-hidden group/confirm py-3.5 rounded-sm`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/confirm:translate-x-full transition-transform duration-700" />
                            {isScanning ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    SYNC_IN_PROGRESS...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} className="group-hover/confirm:scale-110 transition-transform" />
                                    {initialData ? 'RESTORE_ARTIFACT' : 'CREATE_REALM_GATE'}
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </SystemFrame>
        </div>
    );
};

export default SystemGateModal;
