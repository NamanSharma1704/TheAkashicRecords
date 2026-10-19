import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { Theme } from '../../core/types';
import { systemFetch } from '../../utils/auth';
import { useDialogFocus } from '../../utils/useDialogFocus';

interface TrashedQuest {
    _id: string;
    title: string;
    currentChapter: number;
    totalChapters: number;
    purgeAt: string;
}

interface TrashPanelProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    /** Restore through the app, so the record rejoins the library on screen. */
    onRestore: (id: string) => Promise<boolean>;
    confirm: (message: string) => Promise<boolean>;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * The Trash: deleted records the server keeps for 30 days before erasing them.
 *
 * Deleting is instant and undoable from its toast; this is the way back once that toast is
 * gone. Restore needs no confirmation. Erasing for good does: it is the one irreversible step.
 */
const TrashPanel: React.FC<TrashPanelProps> = ({ isOpen, onClose, theme, onRestore, confirm }) => {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(ref, isOpen, onClose);
    const [items, setItems] = useState<TrashedQuest[] | null>(null);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError('');
        try {
            const res = await systemFetch('/api/quests/trash');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setItems(await res.json());
        } catch {
            setItems([]);
            setError("Couldn't read the Trash. Check your connection and reopen it.");
        }
    }, []);

    useEffect(() => {
        if (isOpen) { setItems(null); void load(); }
    }, [isOpen, load]);

    const restore = async (q: TrashedQuest) => {
        setBusyId(q._id);
        const ok = await onRestore(q._id);
        setBusyId(null);
        if (ok) setItems(prev => (prev ?? []).filter(i => i._id !== q._id));
    };

    const erase = async (q: TrashedQuest) => {
        const yes = await confirm(`ERASE "${q.title}" FOR GOOD?\nThis cannot be undone. Restoring will no longer be possible.`);
        if (!yes) return;
        setBusyId(q._id);
        try {
            const res = await systemFetch(`/api/quests/${q._id}/permanent`, { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
            setItems(prev => (prev ?? []).filter(i => i._id !== q._id));
        } catch {
            setError(`Couldn't erase "${q.title}". Try again.`);
        } finally {
            setBusyId(null);
        }
    };

    const rowBtn = `h-8 px-2.5 flex items-center gap-1.5 border font-mono text-[10px] font-bold tracking-widest uppercase transition-colors disabled:opacity-40 disabled:cursor-wait`;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    ref={ref}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="trash-title"
                    tabIndex={-1}
                    className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className={`w-full max-w-lg max-h-[80dvh] flex flex-col border ${theme.isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-violet-200 bg-white'} shadow-2xl rounded-sm overflow-hidden`}
                    >
                        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-violet-50/70'} shrink-0`}>
                            <div id="trash-title" className={`flex items-center gap-2.5 ${theme.highlightText} font-mono text-[11px] tracking-widest uppercase font-bold`}>
                                <Trash2 size={13} aria-hidden="true" />
                                ARCHIVE_TRASH
                            </div>
                            <button type="button" onClick={onClose} aria-label="Close" title="Close" className={`w-7 h-7 flex items-center justify-center border ${theme.borderSubtle} ${theme.mutedText} transition-colors rounded-sm ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                <X size={13} aria-hidden="true" />
                            </button>
                        </div>

                        <p className={`px-5 pt-4 pb-2 font-mono text-[11px] leading-relaxed ${theme.mutedText} shrink-0`}>
                            Deleted records stay here for 30 days, then they are erased automatically. Restore puts one straight back in your library.
                        </p>

                        <div className="px-5 pb-5 overflow-y-auto min-h-0">
                            {error && (
                                <p role="alert" className={`mb-3 font-mono text-[11px] ${theme.isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
                            )}
                            {items === null ? (
                                <p className={`py-6 text-center font-mono text-[11px] ${theme.mutedText}`}>Reading the Trash…</p>
                            ) : items.length === 0 ? (
                                <p className={`py-6 text-center font-mono text-[11px] ${theme.mutedText}`}>The Trash is empty.</p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {items.map(q => (
                                        <li key={q._id} className={`flex items-center gap-3 px-3 py-2.5 border ${theme.borderSubtle} rounded-sm ${theme.isDark ? 'bg-white/[0.02]' : 'bg-violet-50/50'}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-mono text-[11px] font-bold uppercase tracking-wide truncate ${theme.headingText}`}>{q.title}</p>
                                                <p className={`font-mono text-[10px] mt-0.5 ${theme.mutedText}`}>
                                                    CH {q.currentChapter}{q.totalChapters ? ` / ${q.totalChapters}` : ''} · erased on {dateFmt.format(new Date(q.purgeAt))}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => restore(q)}
                                                disabled={busyId === q._id}
                                                aria-label={`Restore ${q.title}`}
                                                className={`${rowBtn} ${theme.border} bg-accent-soft hover:bg-accent-soft-strong`}
                                                style={{ color: theme.accentInk }}
                                            >
                                                <RotateCcw size={12} aria-hidden="true" /> Restore
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => erase(q)}
                                                disabled={busyId === q._id}
                                                aria-label={`Erase ${q.title} for good`}
                                                title="Erase for good"
                                                className={`${rowBtn} w-8 px-0 justify-center border-red-900/40 ${theme.isDark ? 'text-red-400' : 'text-red-700'} hover:bg-red-500 hover:text-white hover:border-red-500`}
                                            >
                                                <Trash2 size={12} aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrashPanel;
