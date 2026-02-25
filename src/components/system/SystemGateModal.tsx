import React, { useState, useEffect } from 'react';
import { Theme, Quest } from '../../core/types';
import SystemFrame from './SystemFrame';
import { X, RefreshCw, AlertCircle, CheckCircle, Database, Search, Activity, Trash2 } from 'lucide-react';
import { fetchMangadex, fetchAuto, fetchAnilistCover, fetchJikanCover } from '../../utils/api';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-colors duration-700 animate-in fade-in zoom-in-95 duration-200">
            <SystemFrame variant="full" theme={theme} className="w-full max-w-md max-h-[90dvh] flex flex-col transition-all">
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className={`flex justify-between items-center mb-6 pb-4 transition-colors duration-700 shrink-0`}>
                        <span className={`${theme.highlightText} font-mono tracking-widest text-sm flex items-center gap-2 transition-colors duration-700`}>
                            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
                            {isScanning ? "ANALYZING COORDINATES..." : "SYSTEM_OVERWRITE"}
                        </span>
                        <button onClick={onClose}><X className={`${theme.mutedText} hover:${theme.headingText} transition-colors duration-700`} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs flex-1 overflow-y-auto pr-2 hide-scrollbar">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-2 text-[10px] tracking-widest flex items-center gap-2 animate-pulse">
                                <AlertCircle size={12} />
                                {error}
                            </div>
                        )}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className={`block ${theme.mutedText} uppercase text-[9px] tracking-widest transition-colors duration-700`}>Link (Coordinates)</label>

                                {/* SOURCE SELECTOR */}
                                <div className="flex gap-2">
                                    {['AUTO', 'ANILIST', 'MAL', 'MANGADEX'].map(src => (
                                        <button
                                            key={src}
                                            type="button"
                                            onClick={() => setSearchSource(src)}
                                            className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 border ${searchSource === src ? `${theme.border} ${theme.highlightText}` : `border-transparent ${theme.mutedText}`} transition-colors`}
                                        >
                                            {src}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input name="link" value={formData.link} onChange={handleChange} placeholder="https://..." className={`flex-1 ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700`} />
                                <button type="button" onClick={handleScan} disabled={!formData.link || isScanning} className={`px-3 border ${theme.borderSubtle} ${theme.highlightText} hover:bg-${theme.primary}-500/10 disabled:opacity-50 transition-colors flex items-center gap-2`}>
                                    {isScanning ? <Activity size={14} className="animate-pulse" /> : <Search size={14} />}
                                    <span className="hidden sm:inline">SCAN</span>
                                </button>
                            </div>
                            {scanStatus === "ENCRYPTED" && <div className="text-amber-500 text-[9px] mt-1 tracking-widest flex items-center gap-1"><AlertCircle size={10} /> COORDINATES ENCRYPTED. INPUT TRUE NAME.</div>}
                            {scanStatus === "ERROR" && <div className="text-red-500 text-[9px] mt-1 tracking-widest flex items-center gap-1"><AlertCircle size={10} /> SCAN FAILED. NO MATCH FOUND.</div>}
                            {scanStatus === "SUCCESS" && <div className={`${theme.id === 'LIGHT' ? 'text-sky-500' : 'text-amber-500'} text-[9px] mt-1 tracking-widest flex items-center gap-1`}><CheckCircle size={10} /> SCAN COMPLETE. ARTIFACT ACQUIRED.</div>}
                        </div>
                        <div>
                            <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Title</label>
                            <div className="flex gap-2">
                                <input name="title" value={formData.title} onChange={handleChange} className={`flex-1 ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 font-bold`} />
                                <button type="button" onClick={handleTitleSearch} disabled={!formData.title || isScanning} className={`px-3 border ${theme.borderSubtle} ${theme.highlightText} hover:bg-${theme.primary}-500/10 disabled:opacity-50 transition-colors flex items-center gap-2`} title="Search Archives for Cover Art">
                                    <Database size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Current Ch</label><input name="currentChapter" type="number" value={formData.currentChapter} onFocus={(e) => e.target.select()} onChange={handleChange} className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} /></div>
                            <div>
                                <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>
                                    Max Ch {formData.totalChapters === 0 && <span className="text-red-400 opacity-80 ml-1">(REQUIRED)</span>}
                                </label>
                                <input name="totalChapters" type="number" value={formData.totalChapters} onFocus={(e) => e.target.select()} onChange={handleChange} className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                            </div>
                        </div>
                        <div>
                            <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Cover URL</label>
                            <div className="flex gap-2 items-center">
                                <input name="coverUrl" value={formData.coverUrl} onChange={handleChange} className={`flex-1 ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700`} />
                                {formData.coverUrl && <img src={formData.coverUrl} alt="Preview" className="w-8 h-8 object-cover border border-slate-500 rounded" referrerPolicy="no-referrer" />}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700`}>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="CONQUERED">CONQUERED</option>
                                    <option value="SEVERED">SEVERED</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Class</label>
                                <select name="classType" value={formData.classType} onChange={handleChange} className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700`}>
                                    <option value="PLAYER">PLAYER</option>
                                    <option value="IRREGULAR">IRREGULAR</option>
                                    <option value="MAGE">MAGE</option>
                                    <option value="CONSTELLATION">CONSTELLATION</option>
                                    <option value="NECROMANCER">NECROMANCER</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Synopsis</label>
                            <textarea name="synopsis" value={formData.synopsis} onChange={(e) => setFormData(prev => ({ ...prev, synopsis: e.target.value }))} className={`w-full h-24 ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 font-sans text-[10px] resize-none overflow-y-auto block`} />
                        </div>
                        <div className="flex gap-4 pt-4">
                            {initialData && <button type="button" onClick={onDelete} className="px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors duration-700"><Trash2 size={14} /></button>}
                            <button type="submit" disabled={isScanning} className={`flex-1 ${theme.isDark ? 'bg-white/10' : 'bg-sky-500/10'} border ${theme.border} ${theme.highlightText} py-2 hover:bg-${theme.primary}-500 ${theme.isDark ? 'hover:text-black' : 'hover:text-white'} font-bold uppercase tracking-widest transition-colors duration-700 disabled:opacity-50`}>
                                {isScanning ? "PROCESSING..." : "CONFIRM"}
                            </button>
                        </div>
                    </form>
                </div>
            </SystemFrame>
        </div>
    );
};

export default SystemGateModal;
