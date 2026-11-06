import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { ImportRow, Quest, Theme } from '../../core/types';
import { statusLabel } from '../../core/constants';
import { systemFetch } from '../../utils/auth';
import { normalizeTitle } from '../../utils/normalizeTitle';
import { useDialogFocus } from '../../utils/useDialogFocus';

type Source = 'anilist' | 'mal';

interface ListImportDialogProps {
    theme: Theme;
    initialSource: Source;
    /** The library as it stands, to say which rows are new and which update a record. */
    items: Quest[];
    /** Guest sandboxes hold a capped number of records. */
    isGuest: boolean;
    /** Hands the chosen rows to the import pipeline (App), which writes and reports them. */
    onImport: (rows: ImportRow[]) => void;
    onClose: () => void;
}

const GUEST_CAP = 500;
/** The order statuses are listed in, with MyAnimeList's words for them. */
const STATUS_ORDER = ['ACTIVE', 'PLANNED', 'STASIS', 'CONQUERED', 'SEVERED'];
const MAL_STATUS: Record<string, string> = {
    'reading': 'ACTIVE', '1': 'ACTIVE',
    'completed': 'CONQUERED', '2': 'CONQUERED',
    'on-hold': 'STASIS', '3': 'STASIS',
    'dropped': 'SEVERED', '4': 'SEVERED',
    'plan to read': 'PLANNED', '6': 'PLANNED',
};

/** A MyAnimeList export (.xml, or the .xml.gz MAL hands out) as rows keyed by MAL id. */
const parseMalExport = async (file: File) => {
    const text = /\.gz$/i.test(file.name)
        ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : await file.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('That file is not a MyAnimeList export (it is not readable XML).');
    const mangas = [...doc.getElementsByTagName('manga')];
    if (mangas.length === 0) {
        throw new Error(doc.getElementsByTagName('anime').length
            ? 'That is an anime list. Export your manga list from MyAnimeList instead.'
            : 'No manga were found in that file.');
    }
    const text$ = (el: Element, tag: string) => el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
    return mangas.map((m) => {
        const read = Math.max(0, Math.floor(Number(text$(m, 'my_read_chapters')) || 0));
        const score = Math.round(Number(text$(m, 'my_score')) || 0);
        return {
            malId: Math.floor(Number(text$(m, 'series_mangadb_id')) || 0),
            row: {
                title: text$(m, 'series_title'),
                currentChapter: read,
                totalChapters: Math.max(read, Math.floor(Number(text$(m, 'series_chapters')) || 0)),
                status: MAL_STATUS[text$(m, 'my_status').toLowerCase()] || 'ACTIVE',
                rating: score >= 1 && score <= 10 ? score : null,
            } as ImportRow,
        };
    }).filter((e) => e.row.title);
};

/**
 * LIST IMPORT: an AniList list (public, by username) or a MyAnimeList export file, shown as
 * a summary to choose from before anything is written. The rows go through the same pipeline
 * as a CSV: new series are added, ones already here only move forward, and a cover, link,
 * class or appraisal you set is never replaced.
 */
const ListImportDialog: React.FC<ListImportDialogProps> = ({ theme, initialSource, items, isGuest, onImport, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const firstFieldRef = useRef<HTMLInputElement>(null);
    useDialogFocus(ref, true, onClose, firstFieldRef);

    const [source, setSource] = useState<Source>(initialSource);
    const [user, setUser] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [found, setFound] = useState<{ label: string; rows: ImportRow[]; note?: string } | null>(null);
    const [include, setInclude] = useState<Record<string, boolean>>(() => Object.fromEntries(STATUS_ORDER.map(s => [s, true])));

    const switchSource = (next: Source) => { setSource(next); setFound(null); setError(null); };

    const readAniList = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = user.trim();
        if (!/^[A-Za-z0-9_-]{2,20}$/.test(name)) { setError('An AniList username is 2 to 20 letters, digits, dashes or underscores.'); return; }
        setBusy(true); setError(null); setFound(null);
        try {
            const res = await systemFetch(`/api/import/anilist?user=${encodeURIComponent(name)}`);
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.message || 'AniList could not be read. Try again.');
            if (!body.rows.length) throw new Error(`${name}'s AniList has no manga yet.`);
            setFound({ label: `AniList · ${body.user}`, rows: body.rows });
        } catch (err: any) {
            setError(err?.message || 'AniList could not be read. Try again.');
        } finally {
            setBusy(false);
        }
    };

    const readMal = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true); setError(null); setFound(null);
        try {
            const entries = await parseMalExport(file);
            // Each MAL id asked of AniList for an English title, other names, cover and class.
            // A failed lookup keeps MAL's own title and imports without those.
            const ids = [...new Set(entries.map(e => e.malId).filter(Boolean))];
            const looked: Record<string, ImportRow> = {};
            let lookupFailed = false;
            for (let i = 0; i < ids.length; i += 500) {
                try {
                    const res = await systemFetch('/api/import/mal-lookup', { method: 'POST', body: JSON.stringify({ ids: ids.slice(i, i + 500) }) });
                    if (!res.ok) { lookupFailed = true; break; }
                    Object.assign(looked, (await res.json()).found);
                } catch { lookupFailed = true; break; }
            }
            const rows = entries.map(({ malId, row }) => {
                const a = looked[malId];
                if (!a) return row;
                return {
                    ...row,
                    title: a.title || row.title,
                    aliases: [...new Set([row.title, ...(a.aliases ?? [])])].filter(n => n !== (a.title || row.title)),
                    totalChapters: Math.max(row.totalChapters, a.totalChapters || 0, row.currentChapter),
                    coverUrl: a.coverUrl,
                    classType: a.classType,
                };
            });
            const missed = entries.filter(e => !looked[e.malId]).length;
            const series = missed === 1 ? '1 series' : `${missed} series`;
            setFound({
                label: `MyAnimeList · ${file.name}`,
                rows,
                note: missed === 0 ? undefined
                    : lookupFailed
                        ? `AniList could not be reached for ${series}, so ${missed === 1 ? 'it keeps' : 'they keep'} MyAnimeList's title and ${missed === 1 ? 'comes' : 'come'} in without a cover.`
                        : `AniList does not know ${series}; ${missed === 1 ? 'it keeps' : 'they keep'} MyAnimeList's title and ${missed === 1 ? 'has' : 'have'} no cover yet.`,
            });
        } catch (err: any) {
            setError(err?.message || 'That file could not be read.');
        } finally {
            setBusy(false);
        }
    };

    // What the chosen rows will do: how many are new, how many update a record already here.
    const summary = useMemo(() => {
        if (!found) return null;
        const keys = new Set(items.map(q => normalizeTitle(q.title)));
        const byStatus: Record<string, number> = {};
        for (const r of found.rows) byStatus[r.status || 'ACTIVE'] = (byStatus[r.status || 'ACTIVE'] || 0) + 1;
        const chosen = found.rows.filter(r => include[r.status || 'ACTIVE']);
        const known = chosen.filter(r => [r.title, ...(r.aliases ?? [])].some(n => keys.has(normalizeTitle(n)))).length;
        return { byStatus, chosen, known, fresh: chosen.length - known };
    }, [found, include, items]);
    const overCap = isGuest && summary ? items.length + summary.fresh > GUEST_CAP : false;

    const label = `block text-[10px] font-mono font-bold tracking-[0.2em] uppercase mb-1.5 ${theme.mutedText}`;
    const field = `w-full h-10 px-3 bg-transparent border ${theme.borderSubtle} font-mono text-[12px] ${theme.headingText} focus:outline-none focus-visible:border-current`;
    const action = `h-10 px-4 border font-mono text-[10px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-wait ${theme.border} text-accent-ink ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-import-title"
            tabIndex={-1}
            className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-full max-w-lg max-h-[90vh] flex flex-col border ${theme.isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-violet-200 bg-white'} shadow-2xl rounded-sm overflow-hidden`}
                style={{ colorScheme: theme.isDark ? 'dark' : 'light' }}
            >
                <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${theme.borderSubtle}`}>
                    <h3 id="list-import-title" className={`font-orbitron text-sm font-bold tracking-[0.2em] uppercase ${theme.headingText}`}>Import a reading list</h3>
                    <button type="button" onClick={onClose} aria-label="Close" title="Close" className={`w-8 h-8 flex items-center justify-center ${theme.mutedText} ${theme.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} transition-colors`}>
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                    {/* Source: two plain buttons acting as a switch. */}
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Import from">
                        {(['anilist', 'mal'] as Source[]).map(s => (
                            <button
                                key={s}
                                type="button"
                                aria-pressed={source === s}
                                onClick={() => switchSource(s)}
                                className={`h-9 border font-mono text-[10px] font-bold tracking-widest uppercase transition-colors ${source === s ? `${theme.border} bg-accent-soft text-accent-ink` : `${theme.borderSubtle} ${theme.mutedText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}`}
                            >
                                {s === 'anilist' ? 'AniList' : 'MyAnimeList'}
                            </button>
                        ))}
                    </div>

                    {source === 'anilist' ? (
                        <form onSubmit={readAniList} className="flex flex-col gap-2" noValidate>
                            <label className="block">
                                <span className={label}>AniList username</span>
                                <input ref={firstFieldRef} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" spellCheck={false} className={field} placeholder="e.g. YourName" />
                            </label>
                            <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>The list has to be public. Your manga list is read once; nothing is sent to AniList.</p>
                            <div className="flex justify-end">
                                <button type="submit" disabled={busy} aria-busy={busy} className={action}>{busy ? 'Reading…' : 'Read list'}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <label className="block">
                                <span className={label}>MyAnimeList export file</span>
                                <input
                                    ref={firstFieldRef}
                                    type="file"
                                    accept=".xml,.gz,application/xml,text/xml,application/gzip"
                                    disabled={busy}
                                    onChange={(e) => { void readMal(e.target.files?.[0]); e.target.value = ''; }}
                                    className={`${field} h-auto py-2 file:mr-3 file:border-0 file:bg-transparent file:font-mono file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:text-accent-ink`}
                                />
                            </label>
                            <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                                On MyAnimeList, open Profile → Export Lists, choose Manga List and download it. The .xml.gz file works as it is.
                                {busy && ' Reading and matching titles…'}
                            </p>
                        </div>
                    )}

                    {error && <p role="alert" className={`font-mono text-[11px] leading-relaxed ${theme.isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>}

                    {found && summary && (
                        <div className={`flex flex-col gap-3 pt-3 border-t ${theme.borderSubtle}`}>
                            <p className={`font-mono text-[11px] font-bold tracking-widest uppercase ${theme.headingText}`}>
                                {found.label} · {found.rows.length} series
                            </p>
                            <fieldset className="flex flex-col gap-1.5">
                                <legend className={label}>Include</legend>
                                {STATUS_ORDER.filter(s => summary.byStatus[s]).map(s => (
                                    <label key={s} className={`flex items-center gap-2 font-mono text-[12px] ${theme.headingText} cursor-pointer`}>
                                        <input
                                            type="checkbox"
                                            checked={include[s]}
                                            onChange={(e) => setInclude(prev => ({ ...prev, [s]: e.target.checked }))}
                                            className="w-4 h-4 accent-[var(--accent-solid)]"
                                        />
                                        <span className="uppercase tracking-wider">{statusLabel(s)}</span>
                                        <span className={`ml-auto tabular-nums ${theme.mutedText}`}>{summary.byStatus[s]}</span>
                                    </label>
                                ))}
                            </fieldset>
                            <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                                {summary.fresh} new · {summary.known} already in your archive. Those only move forward, and keep your covers, links, classes and appraisals.
                            </p>
                            {found.note && <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>{found.note}</p>}
                            {overCap && (
                                <p role="alert" className={`font-mono text-[11px] leading-relaxed ${theme.isDark ? 'text-red-400' : 'text-red-700'}`}>
                                    Guest archives hold up to {GUEST_CAP} records; this would bring yours to {items.length + summary.fresh}. Untick a group, or the import stops at the limit.
                                </p>
                            )}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    disabled={summary.chosen.length === 0}
                                    onClick={() => { onImport(summary.chosen); onClose(); }}
                                    className={action}
                                >
                                    Import {summary.chosen.length} series
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ListImportDialog;
