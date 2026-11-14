import React, { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Theme, Quest, Achievement, ImportRow } from '../../core/types';
import SystemLogo from '../system/SystemLogo';
import EntityAvatar from '../system/EntityAvatar';
import StatBox from '../system/StatBox';
import { X, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { CodexGlyph, ConquestGlyph, CoversGlyph, DisconnectGlyph, ExportGlyph, GaugeGlyph, ImportGlyph, InscribeGlyph, PulseGlyph, PurgeGlyph, RecalibrateGlyph, ReticleGlyph, StackGlyph, TransmitGlyph, TuneGlyph } from '../system/SystemGlyphs';
import TrashPanel from './TrashPanel';
import ReadingActivity from './ReadingActivity';
import HunterTitles from './HunterTitles';
import HunterCardDialog from './HunterCardDialog';
import { HunterCardData } from './hunterCard';
import ListImportDialog from './ListImportDialog';
import CoverArt from '../quest/CoverArt';
import { USER_RANKS, LADDER_SPAN, TRANSCENDENT_FROM, ladderWindow } from '../../utils/ranks';
import ScrambleText from '../system/ScrambleText';
import { getProxiedImageUrl } from '../../utils/api';
import GalaxyNebula from '../fx/GalaxyNebula';
import OmniscientField from '../fx/OmniscientField';
import NoiseOverlay from '../fx/NoiseOverlay';
import SanctuaryRing from '../fx/SanctuaryRing';
import { systemFetch, getStoredUser } from '../../utils/auth';
import { accentRGB, elevation, emphasis } from '../../core/depth';
import { useDialogFocus } from '../../utils/useDialogFocus';
import { usePageTour } from '../../core/tours';
import { ClassIcon } from './ClassIcon';
import { classColor } from './classColor';
import { useMenuDismiss } from '../../utils/useMenuDismiss';
import CalibrationOverlay, { CalibrationState } from './CalibrationOverlay';
import AccountDialog from './AccountDialog';

interface HunterProfileProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    items: Quest[];
    playerRank: any;
    /** Titles from the last sync; null until the first one lands. */
    achievements: Achievement[] | null;
    /** The equipped title's key, shown under the name; null for none. */
    equippedTitle: string | null;
    /** Equip a title (null for none). Resolves false when the save failed. */
    onEquipTitle: (key: string | null) => Promise<boolean>;
    onImport: (rows: ImportRow[]) => void;
    onRefresh: () => Promise<void>;
    onLogout: () => void;
    showNotification: (message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', confirm?: boolean) => Promise<boolean>;
    onSelectManhwa?: (id: string) => void;
    /** Bring a record back from the server's Trash into the library. Resolves true on success. */
    onRestoreQuest: (id: string) => Promise<boolean>;
    /** Low-power effects: animated background and hero held still. */
    lowPower: boolean;
    onToggleLowPower: () => void;
    /** Chapter sounds (the Resonance Scale), off by default; a per-device toggle. */
    chapterSounds: boolean;
    onToggleChapterSounds: () => void;
}

const HunterProfile: React.FC<HunterProfileProps> = ({ isOpen, onClose, theme, items, playerRank, achievements, equippedTitle, onEquipTitle, onImport, onRefresh, onLogout, showNotification, onSelectManhwa, onRestoreQuest, lowPower, onToggleLowPower, chapterSounds, onToggleChapterSounds }) => {
    const [showTrash, setShowTrash] = useState(false);
    const totalChapters = useMemo(() => items.reduce((acc, i) => acc + (i.currentChapter || 0), 0), [items]);
    const totalManhwa = items.length;
    const equippedName = useMemo(
        () => (equippedTitle && achievements?.find(a => a.key === equippedTitle && a.unlockedAt)?.name) || null,
        [equippedTitle, achievements]
    );
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

    // Current rank index for rank history, and the nine-rank window the ladder shows (it
    // slides along once the reader is past MONARCH, so the next tier is always on it).
    const currentRankIdx = useMemo(() => USER_RANKS.findIndex((r: any) => r.label === playerRank.name), [playerRank]);
    const ladder = useMemo(() => ladderWindow(Math.max(0, currentRankIdx)), [currentRankIdx]);

    // --- CALIBRATION STATE ---
    const [calibration, setCalibration] = useState<CalibrationState | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- ACCOUNT MODAL STATE ---
    const [storedUser, setStoredUser] = useState(() => getStoredUser());
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showCard, setShowCard] = useState(false);



    // ─── COVER BACKFILL ───
    // Looks up records with no cover (up to 8 per press, never-tried first) and stores a cover
    // when a source has the same series. The hourly job does the owner's archive anyway.
    const [coverBusy, setCoverBusy] = useState(false);
    const findMissingCovers = async () => {
        setCoverBusy(true);
        try {
            const res = await systemFetch('/api/quests/backfill-covers', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
            const filled: { title: string }[] = data.filled || [];
            const remaining: number = data.remaining ?? 0;
            const left = remaining ? `\n${remaining} record${remaining === 1 ? '' : 's'} still without a cover.` : '';
            if (filled.length) {
                await onRefresh();
                const named = filled.slice(0, 3).map(f => f.title).join(', ') + (filled.length > 3 ? ` and ${filled.length - 3} more` : '');
                showNotification(`COVERS RECOVERED: ${filled.length}.\n${named}.${left}`, 'SUCCESS');
            } else if (data.checked) {
                showNotification(`NO MATCHING COVERS.\nChecked ${data.checked} record${data.checked === 1 ? '' : 's'}; no source had the same series. They are tried again in a week.${left}`, 'INFO');
            } else if (remaining) {
                showNotification(`NOTHING NEW TO CHECK.\n${remaining} record${remaining === 1 ? ' has' : 's have'} no cover, and each was looked up in the last week. Add one by hand from the editor.`, 'INFO');
            } else {
                showNotification('EVERY RECORD HAS A COVER.\nNothing to look up.', 'SUCCESS');
            }
        } catch (e) {
            showNotification(`COVER SEARCH FAILED.\n${e instanceof Error ? e.message : 'Try again in a while.'}`, 'ERROR');
        } finally {
            setCoverBusy(false);
        }
    };

    const handleRecalibrate = async () => {
        const confirmed = await showNotification(
            "INITIALIZE GLOBAL RE-CLASSIFICATION PROTOCOL?\nRe-checks every title's genres on AniList, MangaDex and MyAnimeList and updates its class (Player, Mage and so on). Only the class changes; chapters and covers are left alone.\nWARNING: This takes about 75 seconds. You can stop it part-way.",
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
            // A refusal (403 for a guest, 5xx) comes back as JSON with no `data:` lines, so the
            // stream loop below would read it, find no events, and leave the overlay on
            // EXECUTING_SCAN indefinitely. Surface it as the failure it is.
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.message || `CALIBRATION_REFUSED (${response.status})`);
            }
            if (!response.body) throw new Error('No response stream from server');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // for(;;) rather than while(true): same loop, but not flagged as a constant condition.
            for (;;) {
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
                    } catch { /* ignore malformed SSE lines */ }
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

    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    useMenuDismiss(exportMenuOpen, setExportMenuOpen, exportMenuRef);
    const [importMenuOpen, setImportMenuOpen] = useState(false);
    const importMenuRef = useRef<HTMLDivElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    useMenuDismiss(importMenuOpen, setImportMenuOpen, importMenuRef);
    // System settings: the per-device switches (low-power effects, chapter sounds).
    const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
    const settingsMenuRef = useRef<HTMLDivElement>(null);
    useMenuDismiss(settingsMenuOpen, setSettingsMenuOpen, settingsMenuRef);
    /** Which reading-list import is open, if any. */
    const [listImport, setListImport] = useState<'anilist' | 'mal' | null>(null);

    /** Hand `content` to the browser as a download. */
    const downloadFile = (content: string, type: string, name: string) => {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };
    const today = () => new Date().toISOString().split('T')[0];

    // ─── FULL BACKUP ───
    // The CSV carries titles and progress only. The backup is the whole library as the server
    // holds it: every record (synopses, the Trash), the reading log behind the stats and the
    // Chronicle, the titles, the settings (streak, quests, order) and the week's quest days.
    const exportBackup = async () => {
        try {
            const res = await systemFetch('/api/backup');
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) throw new Error(data?.message || `HTTP ${res.status}`);
            // Indented, so the file reads in any text editor; a restore compacts it again.
            downloadFile(`${JSON.stringify(data, null, 2)}\n`, 'application/json', `akashic_backup_${today()}.json`);
            const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
            const s = data.summary ?? {};
            const records = (s.records ?? data.quests.length) as number;
            const parts = [
                plural(records, 'record', 'records') + (s.recordsInTrash ? ` (+${s.recordsInTrash} in the Trash)` : ''),
                plural(data.readingLog.length, 'reading-log entry', 'reading-log entries'),
                plural(data.achievements?.length ?? 0, 'title', 'titles'),
            ];
            showNotification(`BACKUP SEALED.\nSaved ${parts.join(', ')}, with your streak, quests and settings. Import the file here to restore it.`, 'SUCCESS');
        } catch (e) {
            showNotification(`BACKUP FAILED.\n${e instanceof Error ? e.message : 'Try again in a while.'}`, 'ERROR');
        }
    };

    const restoreBackup = async (text: string) => {
        let data: { format?: string; exportedAt?: string; quests?: unknown[] } | null = null;
        try { data = JSON.parse(text); } catch { /* reported below */ }
        if (!data || data.format !== 'akashic-records-backup') {
            showNotification("NOT A BACKUP.\nThat file is not an Akashic Records backup. Backups are the .json files saved from Export.", 'WARNING');
            return;
        }
        const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'an unknown date';
        const confirmed = await showNotification(`RESTORE FROM BACKUP?\n${data.quests?.length ?? 0} records saved ${when}. They are merged in: missing titles are added, and nothing in your library is moved backwards or overwritten.`, 'WARNING', true);
        if (!confirmed) return;
        try {
            // Sent compact: the file is indented for reading, and the server caps a restore's
            // size, so the indentation must not count against it.
            const res = await systemFetch('/api/backup', { method: 'POST', body: JSON.stringify(data) });
            const r = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(r.message || `HTTP ${res.status}`);
            await onRefresh();
            const parts = [`${r.added} added`, `${r.updated} updated`, `${r.logEntries} reading-log entr${r.logEntries === 1 ? 'y' : 'ies'}`];
            const restored: string[] = Array.isArray(r.settingsRestored) ? r.settingsRestored : [];
            showNotification(`ARCHIVE RESTORED.\n${parts.join(', ')}${r.skipped ? `; ${r.skipped} skipped` : ''}${r.streakRestored ? '; streak restored' : ''}${r.titlesRestored ? `; ${r.titlesRestored} title${r.titlesRestored === 1 ? '' : 's'} restored` : ''}${restored.length ? `; ${restored.join(', ')} restored` : ''}.`, 'SUCCESS');
        } catch (e) {
            showNotification(`RESTORE FAILED.\n${e instanceof Error ? e.message : 'Try again in a while.'}`, 'ERROR');
        }
    };

    const exportToCSV = () => {
        const headers = ['Title', 'Current Ch', 'Max Ch', 'Link', 'Cover URL', 'Status', 'Class', 'Appraisal'];
        const csvRows = items.map(item => [
            item.title,
            item.currentChapter,
            item.totalChapters,
            item.link,
            item.coverUrl,
            item.status,
            item.classType,
            item.rating ?? ''
        ].map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(','));

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        downloadFile(csvContent, 'text/csv;charset=utf-8;', `akashic_records_${today()}.csv`);

        showNotification(`ARCHIVE EXTRACTED SUCCESSFULLY.\nSaved ${items.length} record${items.length === 1 ? '' : 's'} to your downloads as a CSV file.`, "SUCCESS");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // Cleared so choosing the same file again fires onChange again.
            input.value = '';
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/);
                if (lines.length < 2) throw new Error("File is empty or invalid format");

                const newQuests: Quest[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // RFC 4180 field split. Inside quotes a doubled quote is a literal quote;
                    // the old loop toggled on every quote character, so `"Say ""hi"""`
                    // lost its inner quotes.
                    const fields: string[] = [];
                    let currentField = "";
                    let inQuotes = false;
                    for (let charIndex = 0; charIndex < line.length; charIndex++) {
                        const char = line[charIndex];
                        if (char === '"') {
                            if (inQuotes && line[charIndex + 1] === '"') { currentField += '"'; charIndex++; }
                            else inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
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

                    const clean = (s: string | undefined) => (s ?? '').trim();
                    const title = clean(fields[0]);
                    if (!title) continue;

                    newQuests.push({
                        id: Math.random().toString(36).substring(2, 11),
                        title,
                        currentChapter: parseInt(clean(fields[1])) || 0,
                        totalChapters: parseInt(clean(fields[2])) || 0,
                        link: clean(fields[3]),
                        coverUrl: clean(fields[4]),
                        // Blank stays blank: the import keeps a record's existing status and
                        // class rather than overwriting them with a default.
                        status: clean(fields[5]).toUpperCase(),
                        classType: clean(fields[6]).toUpperCase(),
                        // Optional 8th column (older exports have 7): the Hunter's Appraisal.
                        rating: (() => { const n = parseInt(clean(fields[7])); return n >= 1 && n <= 10 ? n : null; })(),
                        lastUpdated: Date.now()
                    });
                }

                if (newQuests.length === 0) {
                    showNotification("No records found in that file.\nCheck it is an Akashic Records CSV export.", 'WARNING');
                    return;
                }
                // The import reports its own progress and outcome (a toast in App). This used
                // to announce success here, before a single record had been written.
                if (onImport) onImport(newQuests);
            } catch {
                showNotification("Data corruption detected in source file.\nThe file could not be read as CSV.", 'ERROR');
            }
        };
        reader.readAsText(file);
    };

    // Keyboard: the profile itself, and the two panels it can raise over itself, are
    // dialogs. Escape closes whichever is on top; calibration ignores it while running —
    // stopping a scan is ABORT_PROTOCOL's job, not a stray key's.
    const profileRef = useRef<HTMLDivElement>(null);
    useDialogFocus(profileRef, isOpen, onClose);

    const startProfileTour = usePageTour('profile', isOpen);

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
        <div className={`fixed inset-0 z-[300] pt-[var(--safe-top)] ${theme.isDark ? 'bg-[#020202]' : 'bg-[#f1edf7]'} flex flex-col overflow-hidden transition-colors duration-700 outline-none`}
            style={{ '--elev-1': elevation(theme, 1) } as React.CSSProperties}
            ref={profileRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hunter-profile-title"
            tabIndex={-1}
        >
            {/* Background layers */}
            <GalaxyNebula theme={theme} />
            <OmniscientField isDivineMode={theme.id === 'LIGHT'} />
            <SanctuaryRing theme={theme} />
            <NoiseOverlay />
            {/* Corner falloff. This was a 50%-black radial at 60% opacity in BOTH themes —
                on the light page it dragged the edges toward grey and undid the drafting
                field underneath. Light gets a far gentler cool version; only the void can
                afford to be crushed this hard. */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    background: theme.isDark
                        ? 'radial-gradient(circle at 30% 20%, transparent 40%, rgba(0,0,0,0.5) 100%)'
                        : 'radial-gradient(circle at 30% 20%, transparent 55%, rgba(40,26,60,0.07) 100%)',
                    opacity: theme.isDark ? 0.6 : 1,
                }}
            />

            {/* HEADER. On a phone the five tools plus logo and title ran 35px past the right
                edge, which put the close button off-screen — the profile could not be closed.
                Below sm the logo and divider drop out and the gaps tighten; sm+ is unchanged.
                z-20, one above the content: the export menu drops out of here over the banner. */}
            <div className={`relative z-20 h-16 flex items-center justify-between gap-2 px-4 sm:px-6 bg-transparent shrink-0`}>
                <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-10 h-10 hidden sm:flex items-center justify-center">
                        <SystemLogo theme={theme} className="w-full h-full" />
                    </div>
                    {/* With Trash, covers and low-power there are eight tools, which leave a phone
                        ~47px for the title, so it wrapped under the icons. Below sm the title is
                        visually hidden (it still names the dialog); the banner says where you are. */}
                    <div className="flex flex-col leading-none max-sm:sr-only">
                        <span className={`font-mono text-[9px] tracking-[0.2em] ${theme.mutedText} uppercase`}>SYSTEM.ROOT</span>
                        {/* Light takes the label ramp: at 16px this is body-size text, and the ink
                            ramp's bright #a855f7 middle measured 3.43:1 on the page. */}
                        <h2 id="hunter-profile-title" className={`font-orbitron text-base tracking-[0.2em] font-bold bg-clip-text text-transparent bg-gradient-to-r ${theme.isDark ? 'from-amber-600 via-yellow-400 to-white' : theme.labelGradient} transition-colors duration-700`}>
                            {/* Decodes as the Profile lands (the Phase Shift). */}
                            <ScrambleText text="HUNTER PROFILE" decodeOnMount maxMs={500} glyphClassName="text-accent-ink" />
                        </h2>
                    </div>
                </div>
                {/* Below 360px the eight tools ran 37px past a 320px screen (close off it), so
                    there they shrink to 32px with tighter gaps: 284px in all. Only the toolbar's
                    own buttons (direct, or a menu's trigger), never the items inside a menu. */}
                <div data-tour="profile-tools" className="flex items-center gap-1.5 sm:gap-3 shrink-0 max-[359px]:gap-1 max-[359px]:[&>button]:w-8 max-[359px]:[&>button]:h-8 max-[359px]:[&>button]:px-0 max-[359px]:[&>div>button]:w-8 max-[359px]:[&>div>button]:h-8">
                    {/* Compact Sys Admin Tools */}
                    {/* Export: the full backup or the spreadsheet. A menu rather than another
                        button, because a phone's toolbar has no room left. */}
                    <div ref={exportMenuRef} className="relative">
                        <button type="button" onClick={() => setExportMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={exportMenuOpen} title="Export archive" aria-label="Export archive" className={`hud hud-tool w-9 h-9 flex items-center justify-center ${theme.mutedText} hover:${theme.headingText} cursor-pointer`}>
                            <ExportGlyph size={14} aria-hidden="true" />
                        </button>
                        {exportMenuOpen && (
                            <div role="menu" aria-label="Export archive" className={`absolute left-0 top-full mt-1.5 z-50 w-64 p-1 hud hud-menu shadow-xl`}>
                                {[
                                    { label: 'Full backup (.json)', hint: 'Everything: synopses, reading history, titles, quests and settings, Trash. Restores completely.', run: exportBackup },
                                    { label: 'Spreadsheet (.csv)', hint: 'Titles and progress, for Excel or Sheets.', run: exportToCSV },
                                ].map((item, i) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        role="menuitem"
                                        autoFocus={i === 0}
                                        onClick={() => { setExportMenuOpen(false); item.run(); }}
                                        className="hud hud-ghost [--hud-c:6px] w-full text-left px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer"
                                    >
                                        <span className={`font-mono text-[11px] font-bold ${theme.headingText}`}>{item.label}</span>
                                        <span className={`font-mono text-[10px] leading-snug ${theme.mutedText}`}>{item.hint}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Import: a file exported from here, or a reading list from AniList or
                        MyAnimeList. A menu, like Export, for the same lack of toolbar room. */}
                    <div ref={importMenuRef} className="relative">
                        <button type="button" onClick={() => setImportMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={importMenuOpen} title="Import into the archive" aria-label="Import into the archive" className={`hud hud-tool w-9 h-9 flex items-center justify-center ${theme.mutedText} hover:${theme.headingText} cursor-pointer`}>
                            <ImportGlyph size={14} aria-hidden="true" />
                        </button>
                        {importMenuOpen && (
                            <div role="menu" aria-label="Import into the archive" className={`absolute left-0 top-full mt-1.5 z-50 w-64 p-1 hud hud-menu shadow-xl`}>
                                {[
                                    { label: 'Archive file (.csv or .json)', hint: 'A spreadsheet or full backup exported from here.', run: () => importFileRef.current?.click() },
                                    { label: 'AniList list', hint: 'A public AniList manga list, by username.', run: () => setListImport('anilist') },
                                    { label: 'MyAnimeList export', hint: 'The manga list file MyAnimeList lets you download.', run: () => setListImport('mal') },
                                ].map((item, i) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        role="menuitem"
                                        autoFocus={i === 0}
                                        onClick={() => { setImportMenuOpen(false); item.run(); }}
                                        className="hud hud-ghost [--hud-c:6px] w-full text-left px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer"
                                    >
                                        <span className={`font-mono text-[11px] font-bold ${theme.headingText}`}>{item.label}</span>
                                        <span className={`font-mono text-[10px] leading-snug ${theme.mutedText}`}>{item.hint}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* The file picker the first menu item opens; the menu item is the control. */}
                        <input ref={importFileRef} type="file" accept=".csv,.json,application/json" tabIndex={-1} aria-hidden="true" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (/\.json$/i.test(file.name)) {
                                const text = await file.text();
                                e.target.value = "";
                                restoreBackup(text);
                                return;
                            }
                            const confirmed = await showNotification("RE-SYNCHRONIZE DATABASE?\nImports this CSV: new titles are added, and titles the file has further along are updated. Nothing in your library is moved backwards.", "WARNING", true);
                            if (confirmed) handleImport(e);
                            else e.target.value = "";
                        }} />
                    </div>
                    <button type="button" onClick={() => setShowTrash(true)} title="Trash (deleted records)" aria-label="Open the Trash" className={`hud hud-tool w-9 h-9 flex items-center justify-center ${theme.mutedText} hover:${theme.headingText} cursor-pointer`}>
                        <PurgeGlyph size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={findMissingCovers} disabled={coverBusy} aria-busy={coverBusy} title="Find missing covers" aria-label="Find missing covers" className={`hud hud-tool w-9 h-9 flex items-center justify-center ${theme.mutedText} hover:${theme.headingText} cursor-pointer disabled:cursor-wait`}>
                        <CoversGlyph size={14} aria-hidden="true" className={coverBusy ? 'animate-pulse' : ''} />
                    </button>
                    {/* System settings: the per-device switches, low-power effects and chapter
                        sounds. One menu rather than a button each, like Export and Import: with
                        both as buttons the toolbar ran 24px past a 375px phone and pushed the
                        close button off. Centred under its button, so it stays on a phone's
                        screen from the middle of the toolbar. Each item is a checkbox (it says
                        ON or OFF), and the menu stays open to show the change. */}
                    <div ref={settingsMenuRef} className="relative">
                        <button type="button" onClick={() => setSettingsMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={settingsMenuOpen} title="System settings" aria-label="System settings" className={`hud hud-tool w-9 h-9 flex items-center justify-center cursor-pointer ${lowPower || chapterSounds ? 'hud-accent text-accent-ink' : theme.mutedText} hover:${theme.headingText}`}>
                            <TuneGlyph size={14} aria-hidden="true" />
                        </button>
                        {settingsMenuOpen && (
                            <div role="menu" aria-label="System settings" className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-56 p-1 hud hud-menu shadow-xl`}>
                                {[
                                    { label: 'Low-power effects', hint: 'Holds the animated background, rings and dais still.', on: lowPower, toggle: onToggleLowPower, icon: <GaugeGlyph size={14} aria-hidden="true" /> },
                                    { label: 'Chapter sounds', hint: 'A rising note for each chapter read. Plays one when turned on.', on: chapterSounds, toggle: onToggleChapterSounds, icon: chapterSounds ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" /> },
                                ].map((item, i) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        role="menuitemcheckbox"
                                        aria-checked={item.on}
                                        autoFocus={i === 0}
                                        onClick={item.toggle}
                                        className="hud hud-ghost [--hud-c:6px] w-full text-left px-3 py-2.5 flex items-start gap-3 cursor-pointer"
                                    >
                                        <span className={`mt-0.5 shrink-0 ${item.on ? 'text-accent-ink' : theme.mutedText}`}>{item.icon}</span>
                                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                            <span className={`font-mono text-[11px] font-bold ${theme.headingText}`}>{item.label}</span>
                                            <span className={`font-mono text-[10px] leading-snug ${theme.mutedText}`}>{item.hint}</span>
                                        </span>
                                        <span aria-hidden="true" className={`hud hud-cut-br [--hud-c:4px] shrink-0 mt-0.5 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest ${item.on ? '[--hud-line:var(--accent-line-strong)] [--hud-plate:var(--accent-soft-strong)] text-accent-ink' : theme.mutedText}`}>
                                            {item.on ? 'ON' : 'OFF'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={handleRecalibrate} title="System recalibration" className={`hud hud-btn hud-accent h-9 px-3 hidden sm:flex items-center justify-center gap-2 ${theme.highlightText} cursor-pointer group`}>
                        <RecalibrateGlyph size={14} className="relative z-10" aria-hidden="true" />
                        <span className="font-mono text-[10px] tracking-widest uppercase relative z-10">Re-Calibrate</span>
                    </button>
                    <button type="button" onClick={handleRecalibrate} title="System recalibration" aria-label="System recalibration" className={`hud hud-tool sm:hidden w-9 h-9 flex items-center justify-center ${theme.highlightText} cursor-pointer`}>
                        <RecalibrateGlyph size={14} aria-hidden="true" />
                    </button>

                    <div className={`w-px h-5 ${theme.isDark ? 'bg-gray-800' : 'bg-gray-300'} mx-1 hidden sm:block`} aria-hidden="true" />

                    <button type="button" onClick={onLogout} title="Log out" aria-label="Log out" className="hud hud-btn hud-danger h-9 px-3 sm:px-4 flex items-center justify-center gap-2 font-mono text-[10px] tracking-widest uppercase cursor-pointer group">
                        <DisconnectGlyph size={14} className="group-hover:-translate-x-1 transition-transform hidden sm:block" aria-hidden="true" />
                        <span className="hidden sm:inline">Logout</span>
                        <DisconnectGlyph size={14} className="sm:hidden" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={onClose} aria-label="Close profile" title="Close profile" className={`hud hud-tool w-9 h-9 flex items-center justify-center ${theme.mutedText} hover:${theme.highlightText} cursor-pointer`}>
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* CONTENT - NON SCROLLABLE STRICT LAYOUT */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 flex-1 px-4 lg:px-8 py-3 lg:py-6 overflow-y-auto hide-scrollbar max-w-[1600px] mx-auto w-full flex flex-col gap-3 lg:gap-6 pb-[calc(3rem+var(--tabbar-h))]">

                {/* UNIFIED HERO HEADER: IDENTITY + RANK HISTORY */}
                <motion.div data-tour="profile-banner" variants={itemVariants} className="hud hud-shell hud-on-plate flex w-full bg-[#0a0a0a] overflow-hidden shrink-0 mb-2 p-4 lg:p-5 pb-2 lg:pb-3">
                          {/* Full-width sweeping glow at the bottom of the card */}
                    <div className="absolute bottom-0 left-0 right-0 h-[55%] pointer-events-none"
                        style={{
                            background: theme.isDark
                                ? 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.1) 40%, transparent 70%)'
                                : 'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(124,58,237,0.9) 0%, rgba(167,139,250,0.5) 30%, rgba(230,221,248,0.2) 55%, transparent 70%)'
                        }}
                    />


                    {/* INNER WRAPPER — stacks content vertically */}
                    <div className="flex flex-col w-full">

                        {/* MAIN ROW: AVATAR + RIGHT COLUMN.
                            Below sm there is ~45px left for the rank name once the avatar and the
                            donut take their share, so it clipped to "A'" and the donut sat on the
                            ladder. There the row wraps and the right column dissolves (`contents`):
                            avatar and donut share the first line, and the designation + ladder
                            (order-last, full width) run underneath. sm+ is untouched. */}
                        <div className="flex flex-row flex-wrap sm:flex-nowrap w-full gap-5 lg:gap-8 relative z-10">

                            {/* LEFT COLUMN: AVATAR — EntityAvatar has its own border; username bar continues the frame */}
                            <div className="shrink-0 flex flex-col items-center gap-1.5">
                                <div className="flex flex-col">
                                    {/* EntityAvatar renders its own border (theme.border) — no extra wrapper needed */}
                                    <EntityAvatar theme={theme} size={110} className="drop-shadow-md" rank={playerRank.name} />
                                    {/* Username bar — l/r/b borders continue the EntityAvatar frame seamlessly */}
                                    <div
                                        className={`w-[110px] flex items-center justify-center px-2 py-1.5 ${theme.isDark ? 'bg-black border-l border-r border-b border-[#f59e0b]' : 'bg-white/90 border-l border-r border-b border-[#7c3aed]'}`}
                                    >
                                        <span
                                            className="text-[11px] font-mono font-bold overflow-hidden text-ellipsis whitespace-nowrap w-full text-center"
                                            style={{ color: theme.accentInk }}
                                        >{storedUser?.username || 'SOVEREIGN'}</span>
                                    </div>
                                </div>
                                {/* The equipped title, under the name. Plate ink: the banner is a
                                    near-black plate in both themes. Long names wrap to two lines. */}
                                {equippedName && (
                                    <p className="w-[110px] text-center text-[9px] font-mono font-bold uppercase tracking-[0.15em] leading-snug text-accent-plate">
                                        <span className="sr-only">Title: </span>{equippedName}
                                    </p>
                                )}
                            </div>

                            {/* RIGHT COLUMN: text + timeline | donut */}
                            <div className="contents sm:flex flex-1 flex-row justify-between items-start gap-4 pt-1 min-w-0">

                                {/* LEFT PART: text + timeline below */}
                                {/* basis-full, not just w-full: flex-1's 0% basis is what line
                                    breaking reads, so without it this never wrapped. */}
                                <div className="order-last basis-full sm:order-none sm:basis-0 flex flex-col justify-start flex-1 min-w-0">
                                    {/* HEADER LINE: the label, and from lg the identity actions at the
                                        far end, their right edge on the ladder's. Below lg the rank
                                        name needs the width, so the line dissolves (`contents`) and
                                        the actions drop below the ladder (order-last). Stacked under
                                        the avatar they made that column the tallest thing here. */}
                                    <div className="contents lg:flex lg:items-center lg:justify-between lg:gap-6 lg:mb-0.5">
                                        <div className="text-[9px] lg:text-[10px] font-mono tracking-[0.2em] font-bold uppercase mb-0.5 lg:mb-0 text-accent-plate">HUNTER DESIGNATION</div>
                                        {/* The banner is a near-black plate in both themes, so these take
                                            plate inks: light's page inks measured 1.2-2.8:1 here. The tour
                                            lives here, not in the toolbar, which has no room on a phone. */}
                                        <div className="order-last mt-5 lg:order-none lg:mt-0 flex flex-wrap items-center gap-2">
                                            {[
                                                { label: 'Edit Profile', icon: InscribeGlyph, onClick: () => setShowAccountModal(true) },
                                                { label: 'Hunter Card', icon: TransmitGlyph, onClick: () => setShowCard(true) },
                                                { label: 'Tour', icon: HelpCircle, onClick: startProfileTour },
                                            ].map(({ label, icon: Icon, onClick }) => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={onClick}
                                                    className="hud hud-btn hud-on-plate [--hud-c:5px] [--hud-line:var(--accent-line)] h-7 flex items-center gap-1.5 px-3 text-accent-plate hover:text-white cursor-pointer"
                                                >
                                                    <Icon size={10} aria-hidden="true" />
                                                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest">{label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="drop-shadow-sm leading-normal overflow-hidden">
                                        <span className={`inline-block pr-[6px] text-4xl sm:text-5xl lg:text-[56px] font-black font-orbitron tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${theme.isDark ? theme.inkGradient : 'from-[#c4b5fd] via-[#ddd6fe] to-white'} mb-4`}>
                                            {playerRank.name}
                                        </span>
                                    </div>
                                    {/* Ranks are earned by EXP (chapters read); say how far the next one is. */}
                                    <div className="-mt-3 mb-3 text-[10px] font-mono tracking-widest uppercase text-gray-300">
                                        {(playerRank.exp ?? 0).toLocaleString()} EXP{playerRank.next ? ` · ${(playerRank.next.minExp - (playerRank.exp ?? 0)).toLocaleString()} to ${playerRank.next.label}` : ' · highest rank'}
                                    </div>

                                    {/* TIMELINE — starts here, right below stats text */}
                                    <div className="relative pb-5">
                                        <div className="relative w-full" style={{ height: '5px' }}>
                                            {/* Base Track */}
                                            <div className={`absolute top-0 left-0 w-full h-full rounded-full ${theme.isDark ? 'bg-white/[0.08]' : 'bg-violet-200/40'}`} />
                                            {/* Active Fill — gradient with glow */}
                                            <div
                                                className="absolute top-0 left-0 h-full rounded-full"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, (currentRankIdx - ladder.start) / (LADDER_SPAN - 1)) * 100)}%`,
                                                    background: theme.isDark
                                                        ? 'linear-gradient(90deg, rgba(251,191,36,0.5) 0%, rgba(251,191,36,1) 100%)'
                                                        : 'linear-gradient(90deg, rgba(167,139,250,0.4) 0%, rgba(124,58,237,1) 100%)',
                                                    boxShadow: theme.isDark
                                                        ? '0 0 10px 3px rgba(251,191,36,0.5), 0 0 20px 6px rgba(251,191,36,0.2)'
                                                        : '0 0 10px 3px rgba(167,139,250,0.5), 0 0 20px 6px rgba(167,139,250,0.2)'
                                                }}
                                            />
                                            {/* Rank Nodes */}
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
                                                        <div key={rank.label} className="relative flex flex-col items-center" title={`${rank.label} · ${rank.minExp.toLocaleString()} EXP`}>
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
                                                                <div className={`w-2 h-2 ${shape} transition-all duration-500 ${theme.isDark ? 'bg-white/20' : 'bg-violet-400/30'}`} />
                                                            )}
                                                            {/* Below sm nine nowrap labels cannot share the
                                                                width without overprinting, so only the current
                                                                rank is named there; the nodes still show the rest.
                                                                Hung from the node's centre, not its top: the three
                                                                node sizes put labels at three heights. */}
                                                            <div className={`absolute top-[calc(50%_+_13px)] lg:top-[calc(50%_+_16px)] whitespace-nowrap text-[7px] lg:text-[8px] font-mono tracking-[0.12em] font-bold uppercase transition-all
                                                                ${isCurrent ? 'text-accent-plate' : `hidden sm:block ${isReached ? 'text-white' : 'text-gray-400'}`}`}>
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
                                <div className="relative w-[120px] h-[120px] lg:w-[130px] lg:h-[130px] flex items-center justify-center shrink-0 z-10 ml-auto sm:ml-0">
                                    {/* ml-auto: below sm this sits beside the avatar and pairs to the right. */}
                                    <div className={`absolute inset-[6px] rounded-full ${theme.isDark
                                        ? 'bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12)_0%,rgba(0,0,0,0.3)_100%)]'
                                        : 'bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(240,236,250,0.7)_100%)]'
                                    } backdrop-blur-sm shadow-inner`} />
                                    <div className={`absolute inset-0 rounded-full pointer-events-none ${theme.isDark
                                        ? 'shadow-[0_0_25px_rgba(251,191,36,0.25),0_0_8px_rgba(251,191,36,0.15)]'
                                        : 'shadow-[0_0_20px_rgba(124,58,237,0.2),0_4px_16px_rgba(124,58,237,0.15)]'
                                    }`} />
                                    <div className={`absolute inset-0 rounded-full border border-accent-soft-strong pointer-events-none`} />
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <defs>
                                            <linearGradient id="donutGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor={theme.isDark ? "#fcd34d" : "#cbb8f0"} />{/* theme-color-ok: SVG donut ramp, three art shades per theme */}
                                                <stop offset="50%" stopColor={theme.isDark ? "#fbbf24" : "#7c3aed"} />{/* theme-color-ok: SVG donut ramp */}
                                                <stop offset="100%" stopColor={theme.isDark ? "#b45309" : "#5b21b6"} />{/* theme-color-ok: SVG donut ramp */}
                                            </linearGradient>
                                        </defs>
                                        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className={theme.isDark ? 'text-white/10' : 'text-white/10'} />
                                        <motion.circle cx="50" cy="50" r="44" stroke="url(#donutGrad2)" strokeWidth="7.5" fill="transparent" strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: Math.max(0, Math.min(1, overallPct / 100)) }}
                                            transition={springConfig}
                                            style={{ filter: `drop-shadow(0 0 3px ${theme.isDark ? 'rgba(251,191,36,0.6)' : 'rgba(124,58,237,0.6)'})` }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-0.5">
                                        <div className={`text-[7px] font-bold tracking-[0.12em] uppercase leading-[1.3] ${theme.isDark ? 'text-stone-300' : 'text-stone-600'}`}>OVERALL<br/>COMPLETION</div>
                                        <div className={`text-[26px] lg:text-[30px] font-black ${theme.isDark ? 'text-amber-400' : 'text-[#5b21b6]'} leading-[1] tracking-tight`}>
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
                            <CodexGlyph size={13} />
                            <span className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Combat Metrics</span>
                        </div>
                        {/* Four bracketed stat tiles — the shared StatBox, the same framed tile
                            vocabulary as the rest of the profile, with a staggered entrance. */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Total Titles', value: totalManhwa, icon: StackGlyph },
                                { label: 'Conquered', value: conquered, icon: ConquestGlyph },
                                { label: 'In Progress', value: active, icon: RecalibrateGlyph },
                                { label: 'Ch Absorbed', value: totalChapters.toLocaleString(), icon: CodexGlyph },
                            ].map((stat, idx) => (
                                <StatBox
                                    key={stat.label}
                                    value={stat.value}
                                    label={stat.label}
                                    icon={stat.icon}
                                    color={theme.highlightText}
                                    theme={theme}
                                    index={idx}
                                />
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* HUNTER TITLES — what the System has granted, and what is next */}
                <motion.div data-tour="profile-titles" variants={itemVariants} className="w-full">
                    <HunterTitles theme={theme} achievements={achievements} equipped={equippedTitle} onEquip={onEquipTitle} />
                </motion.div>

                {/* READING ACTIVITY — the reading log, a year of days */}
                <motion.div data-tour="profile-activity" variants={itemVariants} className="w-full">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                        <PulseGlyph size={13} />
                        <span className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Reading Activity</span>
                    </div>
                    <ReadingActivity theme={theme} />
                </motion.div>

                {/* TOP ROW: CLASS DISTRIBUTION + TOP SERIES */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">

                    {/* CLASS DISTRIBUTION */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <CodexGlyph size={13} />
                            <span className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Class Distribution</span>
                        </div>
                        <div className={`hud hud-sheet [--hud-c:12px] px-5 py-5 lg:py-6 flex flex-col flex-1 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300`}>
                            <div className="absolute -right-12 -bottom-12 opacity-[0.03] pointer-events-none mix-blend-screen scale-150 transition-transform duration-1000 group-hover:rotate-12">
                                <CodexGlyph size={240} className={theme.highlightText} />
                            </div>
                            <div className="flex flex-col justify-between h-full flex-1 gap-5 relative z-10">
                                {classEntries.slice(0, 4).map(([cls, count]) => (
                                    <div key={cls} className="flex-1 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <ClassIcon cls={cls} isDark={theme.isDark} />
                                                <span className={`text-xs font-mono font-bold tracking-widest ${classColor(cls, theme.isDark)} uppercase`}>{cls}</span>
                                            </div>
                                            <span className={`text-xs font-mono font-black ${theme.highlightText}`}>{Math.round((count / totalManhwa) * 100)}%</span>
                                        </div>
                                        <div className={`h-[7px] rounded-full w-full ${theme.isDark ? 'bg-gray-800/80 shadow-inner' : 'bg-gray-200/80 shadow-inner'} overflow-hidden`}>
                                            <motion.div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} initial={{ width: 0 }} animate={{ width: `${(count / totalManhwa) * 100}%` }} transition={springConfig} style={{ boxShadow: emphasis(theme, accentRGB(theme), 0.5) }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* TOP SERIES */}
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                            <StackGlyph size={13} />
                            <span className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Top Series</span>
                        </div>
                        <div className={`hud hud-sheet [--hud-c:12px] p-4 flex flex-col gap-3 flex-1 relative hover:-translate-y-0.5 transition-transform duration-300`}>
                            {topSeries.slice(0, 4).map((item, i) => (
                                <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => onSelectManhwa && onSelectManhwa(item.id)}
                                    className={`hud hud-media w-full text-left flex items-center gap-4 py-3 px-4 h-14 md:h-[60px] ${theme.isDark ? 'bg-black/40' : 'bg-white/70'} cursor-pointer group`}
                                >
                                    {item.coverUrl && (
                                        <div className="absolute inset-0 z-0 overflow-hidden">
                                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.isDark ? 'from-[#050505] via-[#050505]/95' : 'from-[#fcfaff] via-[#fcfaff]/95'} to-transparent z-10 transition-colors duration-500`} />
                                            <img src={getProxiedImageUrl(item.coverUrl)} className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-[150%] object-cover object-center opacity-70 lg:opacity-85 select-none mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-110 transition-all duration-700" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        </div>
                                    )}
                                    <div className={`w-7 h-7 flex items-center justify-center shrink-0 relative z-20 rounded shadow-sm ${theme.isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-400/50' : 'bg-[#a855f7] text-black shadow-[#a855f7]/40'}`}>
                                        <span className="text-[11px] font-black font-mono">#{i + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-20">
                                        <div className={`text-xs font-bold truncate tracking-wide ${theme.headingText} drop-shadow-md`}>{item.title}</div>
                                        <div className={`text-[10px] font-mono mt-0.5 ${theme.highlightText}`}>{item.currentChapter.toLocaleString()} <span className="text-[8px]">CN</span></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* BOTTOM FULL-WIDTH ROW: ACTIVE PROGRESS — horizontal cover cards */}
                <motion.div variants={itemVariants} className="flex flex-col">
                    <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                        <ReticleGlyph size={13} />
                        <span className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Active Progress</span>
                    </div>
                    <div className={`hud hud-sheet [--hud-c:12px] p-4 relative`}>
                        {activeSeries.length === 0 && <div className={`text-xs font-mono ${theme.mutedText}`}>NO ACTIVE SERIES</div>}
                        <div
                            className="flex gap-3 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            onWheel={(e) => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY + e.deltaX; }}
                        >
                            {activeSeries.map(item => (
                                <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => onSelectManhwa && onSelectManhwa(item.id)}
                                    className="hud hud-media hud-on-plate text-left cursor-pointer group shrink-0 w-44 h-24"
                                >
                                    {/* Dark in both themes: the title is fixed white over a scrim. The
                                        monogram plate (top, clear of the title) sits under the cover,
                                        which hides itself on error; a dead link used to show the
                                        browser's broken-image icon here. */}
                                    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
                                        <CoverArt title={item.title} size="thumb" className="absolute inset-x-0 top-0 h-3/5" />
                                        {item.coverUrl && (
                                            <img src={getProxiedImageUrl(item.coverUrl)} className="relative w-full h-full object-cover object-center opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-700 select-none" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        )}
                                        {/* One scrim for both themes: light's lighter black/75 let bright
                                            cover art under the 9px title (3.9:1). */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                    </div>
                                    <div className="relative z-10 h-full flex flex-col justify-end p-2.5">
                                        <span className="text-[9px] font-bold text-white leading-tight line-clamp-2 mb-1.5 drop-shadow-lg">{item.title}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-black font-mono shrink-0 ${theme.id === 'LIGHT' ? 'bg-violet-500 text-stone-900' : 'bg-amber-500 text-black'}`}>
                                                {item.pct}%
                                            </span>
                                            <div className="h-[3px] rounded-full flex-1 bg-white/20 overflow-hidden">
                                                <motion.div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={springConfig} />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

            </motion.div>


            <CalibrationOverlay
                theme={theme}
                calibration={calibration}
                onAbort={() => abortControllerRef.current?.abort()}
                onDismiss={() => setCalibration(null)}
            />

            <TrashPanel
                isOpen={showTrash}
                onClose={() => setShowTrash(false)}
                theme={theme}
                onRestore={onRestoreQuest}
                confirm={(message) => showNotification(message, 'WARNING', true)}
            />

            {/* READING-LIST IMPORT: AniList or MyAnimeList, into the CSV pipeline */}
            <AnimatePresence>
                {listImport && (
                    <ListImportDialog
                        theme={theme}
                        initialSource={listImport}
                        items={items}
                        isGuest={storedUser?.role === 'GUEST'}
                        onImport={onImport}
                        onClose={() => setListImport(null)}
                    />
                )}
            </AnimatePresence>

            {/* HUNTER CARD: built from this moment's profile, each time it opens */}
            <AnimatePresence>
                {showCard && (
                    <HunterCardDialog
                        theme={theme}
                        onClose={() => setShowCard(false)}
                        data={{
                            username: storedUser?.username || 'SOVEREIGN',
                            rank: playerRank.name,
                            title: equippedName,
                            exp: playerRank.exp ?? 0,
                            next: playerRank.next ?? null,
                            progress: playerRank.progress ?? 0,
                            series: totalManhwa,
                            conquered,
                            chapters: totalChapters,
                            titlesEarned: achievements?.filter(a => a.unlockedAt).length ?? 0,
                            titlesTotal: achievements?.length ?? 0,
                            top: topSeries.slice(0, 3).map(s => ({ title: s.title, chapters: s.currentChapter || 0, coverUrl: s.coverUrl })),
                        } satisfies HunterCardData}
                    />
                )}
            </AnimatePresence>


            <AccountDialog
                theme={theme}
                open={showAccountModal}
                onClose={() => setShowAccountModal(false)}
                username={storedUser?.username}
                onUpdated={setStoredUser}
            />
        </div>
    );
};

export default HunterProfile;
