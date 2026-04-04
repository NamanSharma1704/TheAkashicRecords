import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Theme, Quest } from '../../core/types';
import SystemLogo from '../system/SystemLogo';
import SystemFrame from '../system/SystemFrame';
import EntityAvatar from '../system/EntityAvatar';
import { X, Database, Layers, Target, Download, Upload, RefreshCw, LogOut, Terminal, Edit2, KeyRound, User2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { USER_RANKS } from '../../utils/ranks';
import GalaxyNebula from '../fx/GalaxyNebula';
import OmniscientField from '../fx/OmniscientField';
import NoiseOverlay from '../fx/NoiseOverlay';
import SanctuaryRing from '../fx/SanctuaryRing';
import { systemFetch, getStoredUser, saveAuthData } from '../../utils/auth';

type CalibrationEntry = { processed: number; total: number; title: string; cls: string; changed: boolean };
type CalibrationState = {
    phase: 'running' | 'done' | 'error';
    processed: number;
    total: number;
    updated: number;
    currentTitle: string;
    log: CalibrationEntry[];
    errorMsg: string;
};
const CLASS_COLORS: Record<string, string> = {
    NECROMANCER: 'text-purple-400',
    CONSTELLATION: 'text-amber-500',
    MAGE: 'text-blue-400',
    IRREGULAR: 'text-orange-400',
    PLAYER: 'text-emerald-400',
};

// ── SYSTEM: HIGH-FIDELITY CUSTOM CLASS ARCHETYPES ──
const ArcaneIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Magic Circle Grid */}
        <circle cx="12" cy="12" r="9" strokeWidth="1" strokeDasharray="2 4" strokeLinecap="square" opacity="0.4" />
        <path d="M12 3 L12 21 M3 12 L21 12" strokeWidth="1" opacity="0.2" />
        {/* Core Crystal */}
        <polygon points="12,5 17,12 12,19 7,12" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" strokeLinejoin="miter" />
        {/* Floating Runes */}
        <polygon points="12,8 14,12 12,16 10,12" fill="currentColor" />
        <path d="M5 5 L7 7 M19 19 L17 17 M19 5 L17 7 M5 19 L7 17" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
);

const PlayerIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Shattered Impact Background */}
        <path d="M12 2L14 9L22 12L14 15L12 22L10 15L2 12L10 9Z" strokeWidth="1" strokeLinejoin="miter" opacity="0.2" fill="currentColor" fillOpacity="0.1" />
        {/* Aggressive Twin Serrated Daggers */}
        <path d="M4 20L10 14" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M8 12L17 3L21 3L21 7L12 16L8 12Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.3" strokeLinejoin="miter" />
        <path d="M20 4L14 10" strokeWidth="1.5" />
        <path d="M3 3L7 7" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
    </svg>
);

const IrregularIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Dimensional Rift */}
        <path d="M4 12 L10 4 L14 20 L20 12" strokeWidth="1" strokeLinejoin="miter" strokeDasharray="3 3" opacity="0.4" />
        {/* Erratic Strike */}
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" strokeLinejoin="miter" />
        <path d="M5 14H10M20 10H15" strokeWidth="3" strokeLinecap="square" />
        {/* Glitch Particles */}
        <rect x="2" y="5" width="2" height="2" fill="currentColor" />
        <rect x="19" y="19" width="3" height="1" fill="currentColor" />
    </svg>
);

const NecroIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Shadow Soldier Cowl */}
        <path d="M12 2 L6 8 L6 16 L12 22 L18 16 L18 8 Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1.5" strokeLinejoin="miter" />
        {/* Horns & Crown */}
        <path d="M12 2 L9 7 M12 2 L15 7" strokeWidth="1.5" />
        <path d="M5 6 L8 9 M19 6 L16 9" strokeWidth="1.5" />
        {/* Hollow Glaring Eyes */}
        <path d="M9 13 L11 11" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M15 13 L13 11" strokeWidth="2.5" strokeLinecap="square" />
        <path d="M12 18 L12 16" strokeWidth="2" strokeLinecap="square" opacity="0.6" />
        {/* Aura Embers */}
        <circle cx="4" cy="18" r="1" fill="currentColor" />
        <circle cx="20" cy="18" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
);

const ConstellationIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
        {/* Hexagonal Outer Eye Boundary */}
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        {/* Intersecting Orbit Coordinates */}
        <path d="M2 12 Q 12 2 22 12" strokeWidth="1.5" strokeLinecap="square" opacity="0.6" />
        <path d="M2 12 Q 12 22 22 12" strokeWidth="1.5" strokeLinecap="square" opacity="0.6" />
        {/* Inner God Eye Pupil */}
        <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="6" r="1" fill="currentColor" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
);

// ── CLASS ICON ENGINE ──
const ClassIcon = ({ cls, isDark, className }: { cls: string, isDark?: boolean, className?: string }) => {
    const colorClass = CLASS_COLORS[cls] || 'text-gray-400';
    
    let Icon: React.ElementType = Database;
    if (cls === 'MAGE') Icon = ArcaneIcon;
    else if (cls === 'PLAYER') Icon = PlayerIcon;
    else if (cls === 'IRREGULAR') Icon = IrregularIcon;
    else if (cls === 'NECROMANCER') Icon = NecroIcon;
    else if (cls === 'CONSTELLATION') Icon = ConstellationIcon;

    return (
        <div className={`relative flex items-center justify-center w-7 h-7 rounded bg-gradient-to-br from-current/20 to-transparent ${isDark ? 'border border-black/50' : 'border border-current/20'} ${colorClass} ${className}`}>
            <div className="absolute inset-0 bg-current/5 blur-sm" />
            <Icon className="relative z-10 w-4 h-4 drop-shadow-[0_0_8px_currentColor]" />
        </div>
    );
};

interface HunterProfileProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    playerRank: any;
    onImport: (newItems: Quest[]) => void;
    onRefresh: () => Promise<void>;
    onLogout: () => void;
    showNotification: (message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', confirm?: boolean) => Promise<boolean>;
    onSelectManhwa?: (id: string) => void;
}

const HunterProfile: React.FC<HunterProfileProps> = ({ isOpen, onClose, theme, items, playerRank, onImport, onRefresh, onLogout, showNotification, onSelectManhwa }) => {
    const totalChapters = useMemo(() => items.reduce((acc, i) => acc + (i.currentChapter || 0), 0), [items]);
    const totalManhwa = items.length;
    const conquered = useMemo(() => items.filter(i => i.status === 'CONQUERED').length, [items]);
    const active = useMemo(() => items.filter(i => i.status === 'ACTIVE').length, [items]);
    const totalPossible = useMemo(() => items.reduce((acc, i) => acc + (i.totalChapters || 0), 0), [items]);
    const overallPct = totalPossible > 0 ? Math.min(100, Math.round((totalChapters / totalPossible) * 100)) : 0;

    // Class distribution
    const classEntries = useMemo(() => {
        const allowedClasses = ['PLAYER', 'IRREGULAR', 'MAGE', 'CONSTELLATION', 'NECROMANCER'];
        const classCounts: Record<string, number> = {
            'PLAYER': 0, 'IRREGULAR': 0, 'MAGE': 0, 'CONSTELLATION': 0, 'NECROMANCER': 0
        };
        items.forEach(i => {
            const c = i.classType || 'UNKNOWN';
            if (allowedClasses.includes(c)) {
                classCounts[c] += 1;
            }
        });
        return Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
    }, [items]);

    // Top series by chapters read
    const topSeries = useMemo(() => [...items].sort((a, b) => (b.currentChapter || 0) - (a.currentChapter || 0)).slice(0, 5), [items]);

    // Active series with completion % 
    const activeSeries = useMemo(() => items.filter(i => i.status === 'ACTIVE' && i.totalChapters > 0 && i.currentChapter <= i.totalChapters)
        .map(i => ({ ...i, pct: Math.min(100, Math.round((i.currentChapter / i.totalChapters) * 100)) }))
        .sort((a, b) => b.pct - a.pct), [items]);

    // Current rank index for rank history
    const currentRankIdx = useMemo(() => USER_RANKS.findIndex((r: any) => r.label === playerRank.name), [playerRank]);

    // --- CALIBRATION STATE ---
    const [calibration, setCalibration] = useState<CalibrationState | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- ACCOUNT MODAL STATE ---
    const [storedUser, setStoredUser] = useState(() => getStoredUser());
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accountForm, setAccountForm] = useState({ newUsername: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [accountStatus, setAccountStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
    const [accountLoading, setAccountLoading] = useState(false);

    const handleAccountUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountStatus(null);
        if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
            setAccountStatus({ type: 'error', msg: 'New passwords do not match.' });
            return;
        }
        if (!accountForm.newUsername.trim() && !accountForm.newPassword) {
            setAccountStatus({ type: 'error', msg: 'Provide a new username or new password to update.' });
            return;
        }
        setAccountLoading(true);
        try {
            const res = await systemFetch('/api/auth/update', {
                method: 'PUT',
                body: JSON.stringify({
                    newUsername: accountForm.newUsername.trim() || undefined,
                    currentPassword: accountForm.currentPassword,
                    newPassword: accountForm.newPassword || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAccountStatus({ type: 'error', msg: data.message || 'Update failed.' });
            } else {
                // Persist new token + user to localStorage
                saveAuthData(data);
                // Immediately update the displayed username in the UI
                setStoredUser(data.user);
                setAccountStatus({ type: 'success', msg: 'Credentials updated. Changes saved to database.' });
                setAccountForm({ newUsername: '', currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch {
            setAccountStatus({ type: 'error', msg: 'Network error. Try again.' });
        } finally {
            setAccountLoading(false);
        }
    };


    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [calibration?.log.length]);

    const handleRecalibrate = async () => {
        const confirmed = await showNotification(
            "INITIALIZE GLOBAL RE-CLASSIFICATION PROTOCOL?\n\nThe system will actively synchronize all archives with external databanks (AniList, MangaDex, Jikan) to re-evaluate entity classifications.\n\nWARNING: Extensive computational operations required. Estimated duration: ~75 seconds.",
            'WARNING', true
        );
        if (!confirmed) return;

        setCalibration({ phase: 'running', processed: 0, total: 0, updated: 0, currentTitle: '...', log: [], errorMsg: '' });

        abortControllerRef.current = new AbortController();

        try {
            const response = await systemFetch('/api/admin/bulk-classify', { 
                method: 'POST',
                signal: abortControllerRef.current.signal
            });
            if (!response.body) throw new Error('No response stream from server');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'start') {
                            setCalibration(p => p ? { ...p, total: event.total } : null);
                        } else if (event.type === 'progress') {
                            setCalibration(p => {
                                if (!p) return null;
                                return {
                                    ...p,
                                    processed: event.processed,
                                    total: event.total,
                                    updated: event.updated,
                                    currentTitle: event.title,
                                    log: [...p.log, { processed: event.processed, total: event.total, title: event.title, cls: event.class, changed: event.changed }]
                                };
                            });
                        } else if (event.type === 'complete') {
                            await onRefresh();
                            setCalibration(p => p ? { ...p, phase: 'done', processed: event.total, updated: event.updated } : null);
                        } else if (event.type === 'error') {
                            setCalibration(p => p ? { ...p, phase: 'error', errorMsg: event.message } : null);
                        }
                    } catch (_) { /* ignore malformed SSE lines */ }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setCalibration(p => p ? { ...p, phase: 'error', errorMsg: 'CALIBRATION PROTOCOL ABORTED BY USER' } : null);
            } else {
                setCalibration(p => p ? { ...p, phase: 'error', errorMsg: err.message } : null);
            }
        }
    };

    const exportToCSV = async () => {
        const confirmed = await showNotification("INITIATE DATA EXTRACTION PROTOCOL?", 'INFO', true);
        if (!confirmed) return;

        const headers = ['Title', 'Current Ch', 'Max Ch', 'Link', 'Cover URL', 'Status', 'Class'];
        const csvRows = items.map(item => [
            item.title,
            item.currentChapter,
            item.totalChapters,
            item.link,
            item.coverUrl,
            item.status,
            item.classType
        ].map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(','));

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `akashic_records_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification("ARCHIVE EXTRACTED SUCCESSFULLY.", "SUCCESS");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/);
                if (lines.length < 2) throw new Error("File is empty or invalid format");

                const newQuests: Quest[] = [];
                // Simple CSV parser that handles quotes
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Robust CSV line parser (handles quotes and empty fields)
                    const fields: string[] = [];
                    let currentField = "";
                    let inQuotes = false;
                    for (let charIndex = 0; charIndex < line.length; charIndex++) {
                        const char = line[charIndex];
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) {
                            fields.push(currentField);
                            currentField = "";
                        } else {
                            currentField += char;
                        }
                    }
                    fields.push(currentField);

                    if (fields.length < 6) {
                        console.warn(`[Import] Skipping malformed line ${i + 1}: Expected 7 fields, found ${fields.length}`, line);
                        continue;
                    }

                    const clean = (s: string) => s ? s.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : "";

                    newQuests.push({
                        id: Math.random().toString(36).substring(2, 11),
                        title: clean(fields[0]),
                        currentChapter: parseInt(clean(fields[1])) || 0,
                        totalChapters: parseInt(clean(fields[2])) || 0,
                        link: clean(fields[3]),
                        coverUrl: clean(fields[4]),
                        status: clean(fields[5]) || 'ACTIVE',
                        classType: clean(fields[6] || 'PLAYER'),
                        lastUpdated: Date.now()
                    });
                }

                if (newQuests.length > 0 && onImport) {
                    onImport(newQuests);
                    showNotification(`Successfully synchronized ${newQuests.length} records.`, 'SUCCESS');
                }
            } catch (err) {
                showNotification("Data corruption detected in source file.", 'ERROR');
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const springConfig = { type: "spring" as const, stiffness: 60, damping: 15 };

    return (
        <div className={`fixed inset-0 z-[300] ${theme.isDark ? 'bg-[#020202]' : 'bg-slate-50'} flex flex-col overflow-hidden transition-colors duration-700`}>
            {/* Background layers */}
            <GalaxyNebula theme={theme} />
            <OmniscientField isDivineMode={theme.id === 'LIGHT'} />
            <SanctuaryRing theme={theme} />
            <NoiseOverlay />
            <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_30%_20%,transparent_40%,rgba(0,0,0,0.5)_100%)] opacity-60" />

            {/* HEADER */}
            <div className={`relative z-10 h-16 flex items-center justify-between px-6 bg-transparent shrink-0`}>
                <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className={`font-mono text-[9px] tracking-[0.2em] ${theme.mutedText} uppercase`}>SYSTEM.ROOT</span>
                        <h2 className={`font-orbitron text-base tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.id === 'LIGHT' ? 'from-sky-600 via-cyan-400 to-indigo-200' : 'from-amber-600 via-yellow-400 to-white'} transition-colors duration-700`}>HUNTER PROFILE</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Compact Sys Admin Tools */}
                    <button onClick={exportToCSV} title="Export Timeline" className={`w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} hover:bg-white/5 transition-colors cursor-pointer`}>
                        <Download size={14} />
                    </button>
                    <label title="Synchronize Timeline" className={`w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} hover:bg-white/5 transition-colors cursor-pointer`}>
                        <input type="file" accept=".csv" onChange={async (e) => {
                            const confirmed = await showNotification("RE-SYNCHRONIZE DATABASE?", "WARNING", true);
                            if (confirmed) handleImport(e);
                            else e.target.value = "";
                        }} className="hidden" />
                        <Upload size={14} />
                    </label>
                    <button onClick={handleRecalibrate} title="System Recalibration" className={`h-9 px-3 hidden sm:flex items-center justify-center gap-2 border ${theme.borderSubtle} ${theme.highlightText} hover:bg-amber-500/10 transition-colors cursor-pointer relative overflow-hidden group`}>
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-all" />
                        <RefreshCw size={14} className="relative z-10" />
                        <span className="font-mono text-[10px] tracking-widest uppercase relative z-10">Re-Calibrate</span>
                    </button>
                    <button onClick={handleRecalibrate} title="System Recalibration" className={`sm:hidden w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.highlightText} hover:bg-white/5 transition-colors cursor-pointer`}>
                        <RefreshCw size={14} />
                    </button>

                    <div className={`w-px h-5 bg-${theme.isDark ? 'gray-800' : 'gray-300'} mx-0.5 sm:mx-1`} />

                    <button onClick={onLogout} title="TERMINATE_SESSION" className={`h-9 px-3 sm:px-4 flex items-center justify-center gap-2 border ${theme.borderSubtle} text-red-500/80 hover:text-red-500 hover:border-red-500 hover:bg-red-500/5 transition-all font-mono text-[10px] tracking-widest uppercase cursor-pointer group`}>
                        <LogOut size={14} className="group-hover:-translate-x-1 transition-transform hidden sm:block" />
                        <span className="hidden sm:inline">Logout</span>
                        <LogOut size={14} className="sm:hidden" />
                    </button>
                    <button onClick={onClose} className={`w-9 h-9 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText} hover:border-current transition-colors cursor-pointer`}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* CONTENT - NON SCROLLABLE STRICT LAYOUT */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 flex-1 px-4 lg:px-8 py-3 lg:py-6 overflow-y-auto hide-scrollbar max-w-[1600px] mx-auto w-full flex flex-col gap-3 lg:gap-6 pb-12">

                {/* UNIFIED HERO HEADER: IDENTITY + RANK HISTORY */}
                <motion.div variants={itemVariants} className={`flex w-full border ${theme.isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-sky-100 bg-gradient-to-r from-sky-50/50 via-white to-white'} backdrop-blur-md relative overflow-hidden shrink-0 shadow-sm mb-2 rounded-[2px] p-4 lg:p-5 pb-2 lg:pb-3`}>
                          {/* Full-width sweeping glow at the bottom of the card */}
                    <div className="absolute bottom-0 left-0 right-0 h-[55%] pointer-events-none"
                        style={{
                            background: theme.isDark
                                ? 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.1) 40%, transparent 70%)'
                                : 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(14,165,233,0.9) 0%, rgba(56,189,248,0.5) 30%, rgba(186,230,255,0.2) 55%, transparent 70%)'
                        }}
                    />


                    {/* INNER WRAPPER — stacks content vertically */}
                    <div className="flex flex-col w-full">

                        {/* MAIN ROW: AVATAR + RIGHT COLUMN */}
                        <div className="flex flex-row w-full gap-5 lg:gap-8 relative z-10">

                            {/* LEFT COLUMN: AVATAR — EntityAvatar has its own border; username bar continues the frame */}
                            <div className="shrink-0 flex flex-col items-center gap-1.5">
                                <div className="flex flex-col">
                                    {/* EntityAvatar renders its own border (theme.border) — no extra wrapper needed */}
                                    <EntityAvatar theme={theme} size={110} className="drop-shadow-md" />
                                    {/* Username bar — l/r/b borders continue the EntityAvatar frame seamlessly */}
                                    <div
                                        className={`w-[110px] flex items-center justify-center px-2 py-1.5 ${theme.isDark ? 'bg-black border-l border-r border-b border-[#f59e0b]' : 'bg-white/90 border-l border-r border-b border-[#06b6d4]'}`}
                                    >
                                        <span
                                            className="text-[11px] font-mono font-bold overflow-hidden text-ellipsis whitespace-nowrap w-full text-center"
                                            style={{ color: theme.isDark ? '#f59e0b' : '#06b6d4' }}
                                        >{storedUser?.username || 'SOVEREIGN'}</span>
                                    </div>
                                </div>
                                {/* Edit Profile button */}
                                <button
                                    onClick={() => { setAccountStatus(null); setShowAccountModal(true); }}
                                    className={`flex items-center gap-1 px-3 py-1 border ${theme.isDark ? 'border-amber-500/40 text-amber-500/80 hover:border-amber-500/80 hover:text-amber-400' : 'border-sky-400/50 text-sky-500/80 hover:border-sky-400 hover:text-sky-500'} transition-colors cursor-pointer`}
                                >
                                    <Edit2 size={9} />
                                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest">Edit Profile</span>
                                </button>
                            </div>

                            {/* RIGHT COLUMN: text + timeline | donut */}
                            <div className="flex-1 flex flex-row justify-between items-start gap-4 pt-1 min-w-0">

                                {/* LEFT PART: text + timeline below */}
                                <div className="flex flex-col justify-start flex-1 min-w-0">
                                    <div className={`text-[9px] lg:text-[10px] font-mono ${theme.highlightText} tracking-[0.2em] font-bold uppercase mb-0.5`}>HUNTER DESIGNATION</div>
                                    <div className="drop-shadow-sm leading-normal overflow-hidden">
                                        <span className={`inline-block pr-[6px] text-5xl lg:text-[56px] font-black font-manifold tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} mb-4`}>
                                            {playerRank.name}
                                        </span>
                                    </div>

                                    {/* TIMELINE — starts here, right below stats text */}
                                    <div className="relative pb-5">
                                        <div className="relative w-full" style={{ height: '5px' }}>
                                            {/* Base Track */}
                                            <div className={`absolute top-0 left-0 w-full h-full rounded-full ${theme.isDark ? 'bg-white/[0.08]' : 'bg-sky-300/30'}`} />
                                            {/* Active Fill — gradient with glow */}
                                            <div
                                                className="absolute top-0 left-0 h-full rounded-full"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, currentRankIdx / (USER_RANKS.length - 1)) * 100)}%`,
                                                    background: theme.isDark
                                                        ? 'linear-gradient(90deg, rgba(251,191,36,0.5) 0%, rgba(251,191,36,1) 100%)'
                                                        : 'linear-gradient(90deg, rgba(56,189,248,0.4) 0%, rgba(14,165,233,1) 100%)',
                                                    boxShadow: theme.isDark
                                                        ? '0 0 10px 3px rgba(251,191,36,0.5), 0 0 20px 6px rgba(251,191,36,0.2)'
                                                        : '0 0 10px 3px rgba(56,189,248,0.5), 0 0 20px 6px rgba(56,189,248,0.2)'
                                                }}
                                            />
                                            {/* Rank Nodes */}
                                            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between items-center z-10">
                                                {USER_RANKS.map((rank: any, idx: number) => {
                                                    const isReached = idx <= currentRankIdx;
                                                    const isCurrent = idx === currentRankIdx;
                                                    const accentColor = theme.isDark ? '#fbbf24' : '#38bdf8';
                                                    const accentBorder = theme.isDark ? 'amber' : 'sky';
                                                    return (
                                                        <div key={rank.label} className="relative flex flex-col items-center">
                                                            {isCurrent ? (
                                                                <div
                                                                    className={`w-4 h-4 lg:w-[18px] lg:h-[18px] rounded-full border-[2.5px] border-${accentBorder}-400 bg-transparent transition-all duration-500`}
                                                                    style={{ boxShadow: `0 0 12px 4px ${accentColor}60, 0 0 24px 6px ${accentColor}30` }}
                                                                />
                                                            ) : isReached ? (
                                                                <div
                                                                    className={`w-[10px] h-[10px] lg:w-3 lg:h-3 rounded-full transition-all duration-500 ${theme.isDark ? 'bg-amber-400' : 'bg-[#38bdf8]'}`}
                                                                    style={{ boxShadow: `0 0 7px 2px ${accentColor}80` }}
                                                                />
                                                            ) : (
                                                                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${theme.isDark ? 'bg-white/20' : 'bg-sky-400/30'}`} />
                                                            )}
                                                            <div className={`absolute top-[20px] lg:top-[24px] whitespace-nowrap text-[7px] lg:text-[8px] font-mono tracking-[0.12em] font-bold uppercase transition-all
                                                                ${isCurrent ? `${theme.highlightText} opacity-100` : isReached ? `${theme.headingText} opacity-75` : `${theme.mutedText} opacity-35`}`}>
                                                                {rank.label}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT PART: Overall Completion donut */}
                                <div className="relative w-[120px] h-[120px] lg:w-[130px] lg:h-[130px] flex items-center justify-center shrink-0 z-10">
                                    <div className={`absolute inset-[6px] rounded-full ${theme.isDark
                                        ? 'bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12)_0%,rgba(0,0,0,0.3)_100%)]'
                                        : 'bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(224,242,254,0.7)_100%)]'
                                    } backdrop-blur-sm shadow-inner`} />
                                    <div className={`absolute inset-0 rounded-full pointer-events-none ${theme.isDark
                                        ? 'shadow-[0_0_25px_rgba(251,191,36,0.25),0_0_8px_rgba(251,191,36,0.15)]'
                                        : 'shadow-[0_0_20px_rgba(14,165,233,0.2),0_4px_16px_rgba(14,165,233,0.15)]'
                                    }`} />
                                    <div className={`absolute inset-0 rounded-full border ${theme.isDark ? 'border-amber-500/20' : 'border-sky-300/40'} pointer-events-none`} />
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <defs>
                                            <linearGradient id="donutGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor={theme.isDark ? "#fcd34d" : "#7dd3fc"} />
                                                <stop offset="50%" stopColor={theme.isDark ? "#fbbf24" : "#0ea5e9"} />
                                                <stop offset="100%" stopColor={theme.isDark ? "#b45309" : "#0369a1"} />
                                            </linearGradient>
                                        </defs>
                                        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className={theme.isDark ? 'text-white/10' : 'text-sky-100/80'} />
                                        <motion.circle cx="50" cy="50" r="44" stroke="url(#donutGrad2)" strokeWidth="7.5" fill="transparent" strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: Math.max(0, Math.min(1, overallPct / 100)) }}
                                            transition={springConfig}
                                            style={{ filter: `drop-shadow(0 0 3px ${theme.isDark ? 'rgba(251,191,36,0.6)' : 'rgba(14,165,233,0.6)'})` }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-0.5">
                                        <div className={`text-[7px] font-bold tracking-[0.12em] uppercase leading-[1.3] ${theme.isDark ? 'text-slate-300' : 'text-slate-500'}`}>OVERALL<br/>COMPLETION</div>
                                        <div className={`text-[26px] lg:text-[30px] font-black ${theme.isDark ? 'text-amber-400' : 'text-[#0ea5e9]'} leading-[1] tracking-tight`}>
                                            {Math.round(overallPct)}<span className="text-[12px] font-bold">%</span>
                                        </div>
                                    </div>
                                </div>

                            </div>{/* end right column */}
                        </div>{/* end main row */}
                    </div>{/* end inner wrapper */}
                </motion.div>

                {/* COMBAT METRICS */}
                <motion.div variants={itemVariants} className="w-full flex justify-center">
                    <div className="w-full">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Database size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Combat Metrics</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} shadow-sm backdrop-blur-md rounded-md p-3 w-full`}>
                            <div className={`grid grid-cols-2 md:grid-cols-4 gap-y-3 md:gap-y-0 md:divide-x ${theme.isDark ? 'divide-white/10' : 'divide-black/5'}`}>
                                {[
                                    { label: 'TOTAL TITLES', value: totalManhwa, color: theme.headingText },
                                    { label: 'CONQUERED', value: conquered, color: theme.highlightText },
                                    { label: 'IN PROGRESS', value: active, color: theme.highlightText },
                                    { label: 'CH ABSORBED', value: totalChapters.toLocaleString(), color: theme.highlightText },
                                ].map((stat, idx) => (
                                    <div key={stat.label} className={`flex flex-col justify-center px-4 py-1 ${(idx === 0 || idx === 2) ? 'pl-2 md:pl-4' : ''}`}>
                                        <div className={`text-[9px] font-mono ${theme.mutedText} font-bold uppercase tracking-widest mb-1`}>{stat.label}</div>
                                        <div className={`text-2xl lg:text-3xl font-black italic ${stat.color} leading-none`}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* TOP ROW: CLASS DISTRIBUTION + TOP SERIES */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">

                    {/* CLASS DISTRIBUTION */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Database size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Class Distribution</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} shadow-sm rounded-md backdrop-blur-md px-5 py-5 lg:py-6 flex flex-col flex-1 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300`}>
                            <div className="absolute -right-12 -bottom-12 opacity-[0.03] pointer-events-none mix-blend-screen scale-150 transition-transform duration-1000 group-hover:rotate-12">
                                <Database size={240} className={theme.highlightText} />
                            </div>
                            <div className="flex flex-col justify-between h-full flex-1 gap-5 relative z-10">
                                {classEntries.slice(0, 4).map(([cls, count]) => (
                                    <div key={cls} className="flex-1 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <ClassIcon cls={cls} isDark={theme.isDark} />
                                                <span className={`text-xs font-mono font-bold tracking-widest ${CLASS_COLORS[cls] || theme.headingText} uppercase`}>{cls}</span>
                                            </div>
                                            <span className={`text-xs font-mono font-black ${theme.highlightText}`}>{Math.round((count / totalManhwa) * 100)}%</span>
                                        </div>
                                        <div className={`h-[7px] rounded-full w-full ${theme.isDark ? 'bg-gray-800/80 shadow-inner' : 'bg-gray-200/80 shadow-inner'} overflow-hidden`}>
                                            <motion.div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} progress-bloom`} initial={{ width: 0 }} animate={{ width: `${(count / totalManhwa) * 100}%` }} transition={springConfig} style={{ color: theme.id === 'LIGHT' ? '#0ea5e9' : '#fbbf24' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* TOP SERIES */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <Layers size={13} />
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Top Series</span>
                        </div>
                        <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} shadow-sm rounded-md backdrop-blur-md p-4 flex flex-col gap-3 flex-1 relative hover:-translate-y-0.5 transition-transform duration-300`}>
                            {topSeries.slice(0, 4).map((item, i) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onSelectManhwa && onSelectManhwa(item.id)}
                                    className={`flex items-center gap-4 relative overflow-hidden py-3 px-4 h-14 md:h-[60px] rounded-xl border ${theme.isDark ? 'border-white/5 border-b-black/60 bg-black/40 hover:border-white/20' : 'border-black/5 border-b-black/10 bg-white/40 hover:border-black/20'} cursor-pointer group transition-all duration-300 shadow-sm hover:shadow-lg ${theme.isDark ? 'hover:shadow-black/60' : 'hover:shadow-black/20'} hover:-translate-y-0.5 border-b-[3px]`}
                                >
                                    {item.coverUrl && (
                                        <div className="absolute inset-0 z-0 overflow-hidden">
                                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.isDark ? 'from-[#050505] via-[#050505]/95' : 'from-[#f8fafc] via-[#f8fafc]/95'} to-transparent z-10 transition-colors duration-500`} />
                                            <img src={item.coverUrl} className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-[150%] object-cover object-center opacity-70 lg:opacity-85 select-none mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-110 transition-all duration-700" alt="" />
                                        </div>
                                    )}
                                    <div className={`w-7 h-7 flex items-center justify-center shrink-0 relative z-20 rounded shadow-sm ${theme.isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-400/50' : 'bg-sky-400 text-white shadow-sky-400/30'}`}>
                                        <span className="text-[11px] font-black font-mono">#{i + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-20">
                                        <div className={`text-xs font-bold truncate tracking-wide ${theme.headingText} drop-shadow-md`}>{item.title}</div>
                                        <div className={`text-[10px] font-mono mt-0.5 ${theme.highlightText}`}>{item.currentChapter.toLocaleString()} <span className="text-[8px] opacity-40">CN</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* BOTTOM FULL-WIDTH ROW: ACTIVE PROGRESS — horizontal cover cards */}
                <motion.div variants={itemVariants} className="flex flex-col">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                        <Target size={13} />
                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase">Active Progress</span>
                    </div>
                    <div className={`border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} shadow-sm rounded-md backdrop-blur-md p-4 relative`}>
                        {activeSeries.length === 0 && <div className={`text-xs font-mono ${theme.mutedText}`}>NO ACTIVE SERIES</div>}
                        <div
                            className="flex gap-3 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            onWheel={(e) => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY + e.deltaX; }}
                        >
                            {activeSeries.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onSelectManhwa && onSelectManhwa(item.id)}
                                    className={`relative overflow-hidden rounded-xl border cursor-pointer group transition-all duration-300 shrink-0 w-44 h-24 ${theme.isDark ? 'border-white/5 hover:border-white/20' : 'border-black/5 hover:border-sky-200'} shadow-sm hover:shadow-lg hover:-translate-y-0.5`}
                                >
                                    {item.coverUrl ? (
                                        <div className="absolute inset-0 z-0 overflow-hidden">
                                            <img src={item.coverUrl} className="w-full h-full object-cover object-center opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-700 select-none" alt="" />
                                            <div className={`absolute inset-0 bg-gradient-to-t ${theme.isDark ? 'from-black/90 via-black/40' : 'from-black/75 via-black/20'} to-transparent`} />
                                        </div>
                                    ) : (
                                        <div className={`absolute inset-0 ${theme.isDark ? 'bg-gray-900' : 'bg-sky-50'}`} />
                                    )}
                                    <div className="relative z-10 h-full flex flex-col justify-end p-2.5">
                                        <span className="text-[9px] font-bold text-white leading-tight line-clamp-2 mb-1.5 drop-shadow-lg">{item.title}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-black font-mono shrink-0 ${theme.id === 'LIGHT' ? 'bg-sky-500 text-white' : 'bg-amber-500 text-black'}`}>
                                                {item.pct}%
                                            </span>
                                            <div className="h-[3px] rounded-full flex-1 bg-white/20 overflow-hidden">
                                                <motion.div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={springConfig} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

            </motion.div>

            {/* ── CALIBRATION PROGRESS OVERLAY ── */}
            <AnimatePresence>
                {calibration && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    >
                        <SystemFrame 
                            variant="full" 
                            theme={theme} 
                            className="w-full max-w-2xl max-h-[85dvh] relative pointer-events-auto"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                            {/* Scanline Effect Overlay */}
                            {calibration.phase === 'running' && (
                                <motion.div 
                                    initial={{ top: '-100%' }}
                                    animate={{ top: '100%' }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                    className={`absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-${theme.id === 'LIGHT' ? 'sky' : 'amber'}-500/50 to-transparent z-40 pointer-events-none`}
                                />
                            )}
                            <div className="flex flex-col h-[75vh] max-h-[700px] bg-black/50 overflow-hidden">

                                {/* ── HEADER ── */}
                                <div className={`flex justify-between items-center px-5 py-3.5 border-b ${theme.borderSubtle} shrink-0 bg-black/40`}>
                                    <span className={`${theme.highlightText} font-mono tracking-widest text-[11px] sm:text-sm flex items-center gap-2.5 uppercase`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${calibration.phase === 'running' ? 'bg-amber-500 animate-ping' : theme.id === 'LIGHT' ? 'bg-sky-500' : 'bg-amber-500'}`} />
                                        <Terminal size={14} className={calibration.phase === 'running' ? 'animate-pulse' : ''} />
                                        SYS_CALIBRATION_PROTOCOL
                                    </span>
                                    {calibration.phase === 'running' ? (
                                        <button onClick={() => abortControllerRef.current?.abort()}
                                            className={`flex items-center justify-center border ${theme.borderSubtle} ${theme.headingText} opacity-80 hover:opacity-100 hover:bg-white/5 transition-all duration-300 rounded-sm active:scale-90 text-[10px] sm:text-xs font-orbitron px-3 py-1.5 font-bold tracking-wider relative overflow-hidden group`}>
                                            <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-all" />
                                            <span className="relative z-10">ABORT_PROTOCOL</span>
                                        </button>
                                    ) : (
                                        <button onClick={() => setCalibration(null)}
                                            className={`w-7 h-7 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} hover:border-white/30 transition-all duration-300 rounded-sm active:scale-90`}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* ── BODY ── */}
                                <div className="flex-1 min-h-0 flex flex-col p-5 gap-5 pb-5">
                                    
                                    {/* METRICS & PROGRESS */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <div className={`text-[8px] font-orbitron ${theme.headingText} opacity-80 font-bold tracking-[0.3em] uppercase`}>Runtime_Status</div>
                                                <div className={`text-xs font-mono font-bold ${theme.highlightText}`}>
                                                    {calibration.phase === 'running' ? 'EXECUTING_SCAN...' : calibration.phase === 'done' ? 'CALIBRATION_COMPLETE' : 'CRITICAL_FAILURE'}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-6 text-right">
                                                <div className="space-y-0.5">
                                                    <div className={`text-[7px] font-orbitron ${theme.headingText} opacity-80 font-bold tracking-widest uppercase`}>Processed</div>
                                                    <div className={`text-xl font-mono ${theme.headingText}`}>{calibration.processed}<span className={`text-xs ${theme.mutedText}`}>/{calibration.total || '?'}</span></div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className={`text-[7px] font-orbitron ${theme.headingText} opacity-80 font-bold tracking-widest uppercase`}>Reclassified</div>
                                                    <div className={`text-xl font-mono ${theme.highlightText}`}>{calibration.updated}</div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className={`text-[7px] font-orbitron ${theme.headingText} opacity-80 font-bold tracking-widest uppercase`}>Unchanged</div>
                                                    <div className={`text-xl font-mono ${theme.headingText} opacity-70`}>{calibration.processed - calibration.updated}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* PROGRESS BAR */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center px-1">
                                                <div className={`text-[8px] font-mono ${theme.highlightText} truncate max-w-[300px] uppercase`}>
                                                    {calibration.phase === 'running' ? `> SCANNING: ${calibration.currentTitle}` : '> SYSTEM READY.'}
                                                </div>
                                                <div className={`text-[9px] font-orbitron ${theme.highlightText} font-bold`}>
                                                    {calibration.total > 0 ? Math.round((calibration.processed / calibration.total) * 100) : 0}%
                                                </div>
                                            </div>
                                            <div className={`relative h-[2px] w-full bg-black/60 overflow-hidden`}>
                                                <motion.div
                                                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${theme.gradient}`}
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: calibration.total > 0 ? `${(calibration.processed / calibration.total) * 100}%` : '0%' }}
                                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* TERMINAL LOG */}
                                    <div className={`flex flex-col flex-1 min-h-0 border ${theme.borderSubtle} bg-black/40 relative`}>
                                        <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${theme.border} opacity-50`} />
                                        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${theme.border} opacity-50`} />
                                        
                                        <div className={`px-4 py-2 border-b ${theme.borderSubtle} flex justify-between items-center bg-white/[0.02] shrink-0`}>
                                            <span className={`text-[7px] font-orbitron ${theme.mutedText} tracking-[0.2em] uppercase`}>Diagnostic_Feed</span>
                                            <span className={`text-[7px] font-orbitron ${theme.mutedText} tracking-widest uppercase`}>{calibration.log.length}_ENTRIES</span>
                                        </div>
                                        
                                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar hide-scrollbar space-y-[2px]">
                                            {calibration.log.length === 0 ? (
                                                <div className={`text-[9px] font-mono ${theme.mutedText} uppercase tracking-widest animate-pulse opacity-50 p-2`}>
                                                    &gt; AWAITING_DATA_STREAM...
                                                </div>
                                            ) : (
                                                calibration.log.map((entry, i) => (
                                                    <div key={i} className={`flex items-start gap-4 text-[10px] font-mono leading-relaxed px-2 py-1.5 transition-colors ${entry.changed ? `bg-${theme.id === 'LIGHT' ? 'sky' : 'amber'}-500/10` : 'hover:bg-white/5'}`}>
                                                        <span className={`${theme.mutedText} shrink-0`}>[{String(entry.processed).padStart(2, '0')}/{entry.total}]</span>
                                                        <span className={`flex-1 truncate uppercase tracking-widest ${entry.changed ? theme.headingText : theme.baseText}`}>
                                                            {entry.title}
                                                        </span>
                                                        <div className="shrink-0 flex items-center justify-end w-[130px] gap-2">
                                                            <span className={`${CLASS_COLORS[entry.cls] || theme.mutedText} tracking-wider font-bold`}>{entry.cls}</span>
                                                            <span className={`w-3 text-right ${entry.changed ? theme.highlightText : 'text-transparent'}`}>{entry.changed ? '↻' : ''}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            <div ref={logEndRef} className="h-1" />
                                        </div>
                                    </div>
                                </div>

                                {/* ── FOOTER ── */}
                                {(calibration.phase === 'done' || calibration.phase === 'error') && (
                                    <div className={`px-5 py-3.5 bg-black/70 backdrop-blur-md border-t ${theme.borderSubtle} shrink-0 relative overflow-hidden flex`}>
                                        <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-${theme.id === 'LIGHT' ? 'sky' : 'amber'}-500/40 to-transparent`} />
                                        
                                        <button
                                            onClick={() => setCalibration(null)}
                                            className={`flex-1 relative border ${theme.borderSubtle} ${theme.highlightText} hover:bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] font-orbitron font-black uppercase tracking-[0.25em] text-[11px] sm:text-xs transition-all duration-500 py-3.5 rounded-sm overflow-hidden group/ack active:scale-[0.98]`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/ack:translate-x-full transition-transform duration-700" />
                                            {calibration.phase === 'done' ? 'ACKNOWLEDGE_UPDATE' : 'DISMISS_CRITICAL_ERROR'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </SystemFrame>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ACCOUNT SETTINGS MODAL */}
            <AnimatePresence>
                {showAccountModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowAccountModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className={`w-full max-w-md border ${theme.isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-sky-100 bg-white'} shadow-2xl rounded-sm overflow-hidden`}
                        >
                            {/* Modal Header */}
                            <div className={`flex items-center justify-between px-5 py-3.5 border-b ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-sky-50/80'}`}>
                                <div className={`flex items-center gap-2.5 ${theme.highlightText} font-mono text-[11px] tracking-widest uppercase font-bold`}>
                                    <KeyRound size={13} />
                                    HUNTER_CREDENTIALS
                                </div>
                                <button onClick={() => setShowAccountModal(false)} className={`w-7 h-7 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.highlightText} transition-colors rounded-sm`}>
                                    <X size={13} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleAccountUpdate} className="p-5 flex flex-col gap-4">
                                {/* Current username display */}
                                <div className={`flex items-center gap-2 px-3 py-2 border ${theme.borderSubtle} rounded-sm ${theme.isDark ? 'bg-white/[0.03]' : 'bg-sky-50/60'}`}>
                                    <User2 size={12} className={theme.mutedText} />
                                    <span className={`text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Current:</span>
                                    <span className={`text-[11px] font-mono font-bold ${theme.highlightText}`}>{storedUser?.username || '—'}</span>
                                </div>

                                {/* New username */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>New Username <span className="opacity-50">(leave blank to keep)</span></label>
                                    <input
                                        type="text"
                                        value={accountForm.newUsername}
                                        onChange={e => setAccountForm(f => ({ ...f, newUsername: e.target.value }))}
                                        placeholder={storedUser?.username || ''}
                                        className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-sky-50 text-gray-900 placeholder:text-gray-400'} rounded-sm outline-none focus:border-${theme.isDark ? 'amber' : 'sky'}-400 transition-colors`}
                                    />
                                </div>

                                {/* Current password */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>Current Password <span className="text-red-500">*</span></label>
                                    <input
                                        type="password"
                                        required
                                        value={accountForm.currentPassword}
                                        onChange={e => setAccountForm(f => ({ ...f, currentPassword: e.target.value }))}
                                        placeholder="••••••••"
                                        className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-sky-50 text-gray-900 placeholder:text-gray-400'} rounded-sm outline-none focus:border-${theme.isDark ? 'amber' : 'sky'}-400 transition-colors`}
                                    />
                                </div>

                                {/* New password */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>New Password <span className="opacity-50">(leave blank to keep)</span></label>
                                    <input
                                        type="password"
                                        value={accountForm.newPassword}
                                        onChange={e => setAccountForm(f => ({ ...f, newPassword: e.target.value }))}
                                        placeholder="••••••••"
                                        className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-sky-50 text-gray-900 placeholder:text-gray-400'} rounded-sm outline-none focus:border-${theme.isDark ? 'amber' : 'sky'}-400 transition-colors`}
                                    />
                                </div>

                                {/* Confirm new password */}
                                {accountForm.newPassword && (
                                    <div className="flex flex-col gap-1.5">
                                        <label className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={accountForm.confirmPassword}
                                            onChange={e => setAccountForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                            placeholder="••••••••"
                                            className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-sky-50 text-gray-900 placeholder:text-gray-400'} rounded-sm outline-none focus:border-${theme.isDark ? 'amber' : 'sky'}-400 transition-colors`}
                                        />
                                    </div>
                                )}

                                {/* Status message */}
                                {accountStatus && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-sm text-[10px] font-mono font-bold ${
                                        accountStatus.type === 'error'
                                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                    }`}>
                                        {accountStatus.type === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                                        {accountStatus.msg}
                                    </div>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={accountLoading}
                                    className={`w-full py-2.5 font-mono font-black text-[11px] uppercase tracking-[0.25em] border transition-all duration-300 rounded-sm relative overflow-hidden group/submit ${
                                        theme.isDark
                                            ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40'
                                            : 'border-sky-400 text-sky-600 hover:bg-sky-50 disabled:opacity-40'
                                    }`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/submit:translate-x-full transition-transform duration-700" />
                                    {accountLoading ? 'SYNCHRONIZING...' : 'UPDATE_CREDENTIALS'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HunterProfile;