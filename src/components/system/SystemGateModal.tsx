import React, { useState, useEffect } from 'react';
import { Theme, Quest } from '../../core/types';
import SystemFrame from './SystemFrame';
import { X, RefreshCw, AlertCircle, CheckCircle, Database, Search, Activity, Trash2, Globe } from 'lucide-react';
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
        totalChapters: null,
        status: 'ACTIVE',
        classType: 'PLAYER',
        coverUrl: '',
        link: '',
        synopsis: '',
        rating: 0
    });
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState("IDLE"); // IDLE, SCANNING, SUCCESS, ERROR, ENCRYPTED
    const [searchSource, setSearchSource] = useState("AUTO"); // AUTO, ANILIST, MAL, MANGADEX
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                synopsis: initialData.synopsis ?? '',
                rating: initialData.rating ?? 0
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };


    // --- HELPER TO GUESS CLASS ---
    const inferClassFromTitle = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('level') || t.includes('hunter') || t.includes('dungeon') || t.includes('necromancer')) return "NECROMANCER";
        if (t.includes('sword') || t.includes('blade') || t.includes('fist') || t.includes('boxer') || t.includes('god')) return "WARRIOR";
        if (t.includes('mage') || t.includes('magic') || t.includes('return') || t.includes('reincarnat')) return "MAGE";
        if (t.includes('villain') || t.includes('demon') || t.includes('regress')) return "DEMON KING";
        if (t.includes('doctor') || t.includes('surgeon')) return "HEALER";
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
            const rawSynopsis = result.description || '';
            // Strip HTML tags from description
            const cleanSynopsis = rawSynopsis.replace(/<[^>]*>/g, '').trim();
            setFormData(prev => ({
                ...prev,
                title: newTitle,
                coverUrl: result.coverImage.extraLarge || prev.coverUrl,
                totalChapters: result.chapters || prev.totalChapters,
                synopsis: cleanSynopsis || prev.synopsis,
                classType: inferClassFromTitle(newTitle)
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
            const pathSegments = url.pathname.split('/').filter(Boolean);
            let slug = pathSegments[pathSegments.length - 1];

            // Handle cases like "/manga/title/chapter-1" -> grab "title"
            if (slug.match(/chapter-\d+/)) {
                slug = pathSegments[pathSegments.length - 2];
            }

            // WEBTOONS.COM SPECIFIC LOGIC
            // Structure: /en/genre/title/list or /en/genre/title/viewer
            if (url.hostname.includes('webtoons.com')) {
                if (slug === 'list' || slug === 'viewer' || slug === 'rss') {
                    if (pathSegments.length >= 2) {
                        slug = pathSegments[pathSegments.length - 2];
                    }
                }
            }

            if (slug) {
                // Decode URL encoding (handles double-encoded %25 -> %3A -> ':')
                let decodedSlug = slug;
                try { decodedSlug = decodeURIComponent(decodeURIComponent(slug)); } catch {
                    try { decodedSlug = decodeURIComponent(slug); } catch { decodedSlug = slug; }
                }

                // CLEANUP: Remove hash IDs from slug
                const parts = decodedSlug.replace(/-+/g, ' ').replace(/_+/g, ' ').split(/\s+/);
                const lastPart = parts[parts.length - 1];

                // Strict check for "Is this just an ID?"
                const strictNumeric = /^\d+$/.test(decodedSlug.replace(/[\s-_]/g, ''));
                if (strictNumeric) {
                    isEncrypted = true;
                } else {
                    const isHash = /^\d+$/.test(lastPart) ||
                        (/^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/).test(lastPart) ||
                        (lastPart.length > 6 && /^[a-fA-F0-9]+$/.test(lastPart));

                    if (isHash) {
                        parts.pop();
                    }
                    inferredTitle = parts.join(' ');
                }
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

        if (inferredTitle === "UNKNOWN ARTIFACT" && !fetchedData) {
            setScanStatus("ERROR");
        }

        if (!isEncrypted) {
            // Only use API title if it has reasonable word overlap with the slug title
            const slugWords = new Set(inferredTitle.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2));
            const apiTitle = (fetchedData?.title?.english || fetchedData?.title?.romaji || '');
            const apiWords = new Set(apiTitle.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2));
            let overlapCount = 0;
            slugWords.forEach((w: string) => { if (apiWords.has(w)) overlapCount++; });
            const similarity = slugWords.size > 0 ? overlapCount / slugWords.size : 0;

            // Use API title only if it matches reasonably well, else keep slug title
            const finalTitle = (apiTitle && similarity >= 0.3)
                ? apiTitle
                : (inferredTitle !== 'UNKNOWN ARTIFACT' ? inferredTitle : (apiTitle || 'UNKNOWN ARTIFACT'));

            const rawSynopsis = fetchedData?.description || '';
            const cleanSynopsis = rawSynopsis.replace(/<[^>]*>/g, '').trim();

            setFormData(prev => ({
                ...prev,
                title: finalTitle !== "UNKNOWN ARTIFACT" ? finalTitle : prev.title,
                classType: inferClassFromTitle(finalTitle),
                coverUrl: fetchedData?.coverImage?.extraLarge || prev.coverUrl,
                totalChapters: fetchedData?.chapters || prev.totalChapters,
                synopsis: cleanSynopsis || prev.synopsis,
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
        if (formData.title.trim() === '---') {
            setError("INVALID TITLE. PLEASE INPUT A VALID NAME.");
            return;
        }
        if (!formData.link?.trim()) {
            setError("LINK (COORDINATES) REQUIRED");
            return;
        }

        // DUPLICATE CHECK
        // Check if title already exists in the library (exclude current item if editing)
        const isDuplicate = existingQuests.some(q =>
            q.title.trim().toLowerCase() === formData.title?.trim().toLowerCase() &&
            q.id !== (initialData?.id || "")
        );

        if (isDuplicate) {
            setError("ARTIFACT ALREADY EXISTS IN DATABASE");
            return;
        }

        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-colors duration-700 animate-in fade-in zoom-in-95 duration-200">
            <SystemFrame variant="full" theme={theme} className="w-full max-w-md h-auto">
                <div className="p-6">
                    <div className={`flex justify-between items-center mb-6 pb-4 border-b ${theme.borderSubtle} transition-colors duration-700`}>
                        <span className={`${theme.highlightText} font-mono tracking-widest text-sm flex items-center gap-2 transition-colors duration-700`}>
                            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
                            {isScanning ? "ANALYZING COORDINATES..." : "SYSTEM_OVERWRITE"}
                        </span>
                        <button onClick={onClose}><X className={`${theme.mutedText} hover:${theme.headingText} transition-colors duration-700`} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
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
                            {scanStatus === "SUCCESS" && <div className="text-emerald-500 text-[9px] mt-1 tracking-widest flex items-center gap-1"><CheckCircle size={10} /> SCAN COMPLETE. ARTIFACT ACQUIRED.</div>}
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
                            <div><label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Max Ch {formData.totalChapters === null && <span className="text-red-400 opacity-80 ml-1">(UNKNOWN)</span>}</label>
                                <input name="totalChapters" type="number" value={formData.totalChapters ?? ''} onFocus={(e) => e.target.select()} onChange={handleChange} placeholder="?" className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
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
                                    <option value="WARRIOR">WARRIOR</option>
                                    <option value="DEMON KING">DEMON KING</option>
                                    <option value="HEALER">HEALER</option>
                                </select>
                            </div>
                        </div>

                        {/* RATING */}
                        <div>
                            <label className={`block ${theme.mutedText} mb-1 uppercase text-[9px] tracking-widest transition-colors duration-700`}>Rating (0–10)</label>
                            <input
                                name="rating"
                                type="number"
                                min="0" max="10" step="0.1"
                                value={formData.rating ?? 0}
                                onChange={handleChange}
                                className={`w-full ${theme.inputBg} border ${theme.borderSubtle} p-2 ${theme.baseText} focus:${theme.border} outline-none transition-colors duration-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            />
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
