import React, { useMemo, useState } from 'react';
import { Anchor, Award, Flame, Hexagon, Library, Moon, Orbit, RotateCcw, Sparkles, Star, Swords, Zap } from 'lucide-react';
import { Achievement, Theme } from '../../core/types';

/** One icon per kind of feat; the catalogue itself lives on the server. */
const KIND_ICON: Record<string, React.ElementType> = {
    FIRST: Sparkles,
    STREAK: Flame,
    SURGE: Zap,
    BREADTH: Orbit,
    NIGHT: Moon,
    RETURN: RotateCcw,
    CONQUEST: Swords,
    DEPTH: Anchor,
    CLASSES: Hexagon,
    APPRAISAL: Star,
    ARCHIVE: Library,
};

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Tiles shown before "All titles": two rows on a wide screen, earned ones first. */
const COLLAPSED = 6;

interface HunterTitlesProps {
    theme: Theme;
    achievements: Achievement[] | null;
    /** The equipped title's key (shown under the name in the banner); null for none. */
    equipped: string | null;
    /** Equip a title, or null to wear none. Resolves false when the save failed. */
    onEquip: (key: string | null) => Promise<boolean>;
}

/**
 * HUNTER TITLES: what the System has granted, and how far each locked title is. The server
 * weighs and grants them (App syncs after the library changes); this only lays them out.
 * The equipped title leads, then the other earned ones, newest first; locked ones follow,
 * closest to earned first. Any earned title can be equipped to show under the name.
 */
const HunterTitles: React.FC<HunterTitlesProps> = ({ theme, achievements, equipped, onEquip }) => {
    const [showAll, setShowAll] = useState(false);
    const [busy, setBusy] = useState(false);

    const toggleEquip = async (key: string) => {
        setBusy(true);
        await onEquip(equipped === key ? null : key);
        setBusy(false);
    };

    const ordered = useMemo(() => {
        if (!achievements) return [];
        const earned = achievements
            .filter(a => a.unlockedAt)
            .sort((a, b) => Number(b.key === equipped) - Number(a.key === equipped) || Date.parse(b.unlockedAt!) - Date.parse(a.unlockedAt!));
        const locked = achievements
            .filter(a => !a.unlockedAt)
            .map((a, i) => ({ a, i, p: Math.min(1, a.value / a.target) }))
            .sort((x, y) => y.p - x.p || x.i - y.i)
            .map(x => x.a);
        return [...earned, ...locked];
    }, [achievements, equipped]);
    const earnedCount = ordered.filter(a => a.unlockedAt).length;
    const shown = showAll ? ordered : ordered.slice(0, COLLAPSED);

    return (
        <div className="w-full">
            <div className={`flex items-center gap-2 mb-2 ${theme.highlightText}`}>
                <Award size={13} aria-hidden="true" />
                <h3 className={`text-[10px] font-mono font-bold tracking-[0.3em] uppercase ${theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>Hunter Titles</h3>
                {achievements && (
                    <span className={`ml-auto font-mono text-[10px] tracking-widest uppercase tabular-nums ${theme.mutedText}`}>
                        {earnedCount} / {ordered.length} acquired
                    </span>
                )}
            </div>

            {!achievements ? (
                <p className={`px-1 py-3 font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                    Titles appear once the System has weighed your records.
                </p>
            ) : (
                <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {shown.map(a => {
                            const Icon = KIND_ICON[a.kind] || Award;
                            const earned = !!a.unlockedAt;
                            const worn = earned && a.key === equipped;
                            const reached = Math.min(a.value, a.target);
                            return (
                                <li
                                    key={a.key}
                                    className={`hud hud-cell [--hud-c:8px] flex items-start gap-3 p-3 ${earned ? '[--hud-line:var(--accent-line-strong)] [--hud-plate:var(--accent-soft)]' : '[--hud-plate:var(--hud-sheet-glass)]'}`}
                                >
                                    <div
                                        aria-hidden="true"
                                        className={`w-9 h-9 shrink-0 flex items-center justify-center border ${earned ? 'border-accent-line-strong text-accent-icon' : `${theme.borderSubtle} ${theme.mutedText}`}`}
                                    >
                                        <Icon size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`font-orbitron text-[11px] font-bold tracking-[0.14em] uppercase leading-snug ${earned ? theme.headingText : theme.mutedText}`}>
                                            {a.name}
                                            {worn && (
                                                // Outlined in the tile's own ink: the solid accent
                                                // plate measured 4.2:1 in light at this size.
                                                <span className="ml-2 inline-block align-middle px-1 border border-accent-line-strong text-accent-ink font-mono text-[9px] tracking-[0.2em] leading-[14px]">
                                                    EQUIPPED
                                                </span>
                                            )}
                                        </p>
                                        <p className={`font-mono text-[10px] leading-snug mt-0.5 ${theme.mutedText}`}>{a.description}</p>
                                        {earned ? (
                                            // "Recognised": found in records that predate titles, so
                                            // the date is when the System noticed, not when it happened.
                                            <p className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase mt-1.5 text-accent-ink">
                                                {a.recognised ? 'Recognised' : 'Acquired'} · {dateFmt.format(new Date(a.unlockedAt!))}
                                            </p>
                                        ) : a.target > 1 ? (
                                            <div className="mt-1.5 flex items-center gap-2">
                                                <div aria-hidden="true" className={`h-[3px] flex-1 ${theme.isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                                                    <div className="h-full bg-accent-solid" style={{ width: `${(reached / a.target) * 100}%` }} />
                                                </div>
                                                <span className={`font-mono text-[9px] tabular-nums ${theme.mutedText}`}>
                                                    {reached.toLocaleString()} / {a.target.toLocaleString()}
                                                </span>
                                            </div>
                                        ) : (
                                            <p className={`font-mono text-[9px] tracking-[0.2em] uppercase mt-1.5 ${theme.mutedText}`}>Not yet earned</p>
                                        )}
                                    </div>
                                    {earned && (
                                        <button
                                            type="button"
                                            onClick={() => { void toggleEquip(a.key); }}
                                            disabled={busy}
                                            aria-label={`${worn ? 'Unequip' : 'Equip'} ${a.name}`}
                                            className={`hud hud-btn hud-accent [--hud-c:5px] shrink-0 h-7 px-2 font-mono text-[9px] font-bold tracking-[0.2em] uppercase disabled:opacity-60 disabled:cursor-wait text-accent-ink`}
                                        >
                                            {worn ? 'Unequip' : 'Equip'}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {ordered.length > COLLAPSED && (
                        <div className="flex justify-end mt-1">
                            <button
                                type="button"
                                onClick={() => setShowAll(v => !v)}
                                aria-expanded={showAll}
                                className={`hud hud-ghost h-8 px-2 font-mono text-[10px] font-bold tracking-widest uppercase ${theme.highlightText}`}
                            >
                                {showAll ? 'Fewer titles' : `All titles · ${ordered.length}`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default React.memo(HunterTitles);
