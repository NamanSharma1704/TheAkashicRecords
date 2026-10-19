import React, { useState, useEffect, useLayoutEffect, useMemo, Suspense, lazy, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Quest } from './types';
import SystemFrame from '../components/system/SystemFrame';
import SystemLogo from '../components/system/SystemLogo';
import ScrambleText from '../components/system/ScrambleText';
import { Activity, ExternalLink, Sun, Moon, Plus, Zap, Crown, X, LayoutTemplate, GripVertical, ChevronLeft, ChevronRight, LogOut, RefreshCw, Search } from 'lucide-react';
import { getPlayerRank, calculateQuestRank, USER_RANKS } from '../utils/ranks';
import { THEMES, ITEMS_PER_FLOOR, ThemeId } from './constants';

import SystemConsole from '../components/system/SystemConsole';
import BootScreen from '../components/system/BootScreen';
import BackgroundController from '../components/fx/BackgroundController';
import EntityAvatar from '../components/system/EntityAvatar';
import SystemNotification from '../components/system/SystemNotification';
import SystemToast, { ToastSpec } from '../components/system/SystemToast';
import SystemCompass from '../components/system/SystemCompass';
import ChapterField from '../components/quest/ChapterField';
import { FLOOR_DEFS, floorIndexForItem } from '../components/tower/floors';
import { useHoldRepeat } from '../utils/useHoldRepeat';
import { normalizeTitle } from '../utils/normalizeTitle';
// Statically imported on purpose: the wrapper is tiny and defers its own `three`
// import to idle, so a lazy boundary here would only put a Suspense hole over the hero.
import HoloDais from '../components/dais/HoloDais';
import Card3D from '../components/quest/Card3D';
import CoverArt from '../components/quest/CoverArt';
import ArcaneSigil from '../components/fx/ArcaneSigil';
import SanctuaryRing from '../components/fx/SanctuaryRing';
import { accentRGB, elevation, emphasis } from './depth';
import { accentVars } from './tokens';
import { InfinitePortalIcon, CalibratedPlusIcon, CalibratedMinusIcon } from '../components/system/CustomIcons';

import { unproxyImageUrl } from '../utils/api';
import { saveAuthData, performLogout, systemFetch, isAuthenticated, getStoredUser } from '../utils/auth';
import LoginScreen from '../components/system/LoginScreen';
import GlitchOverlay from '../components/fx/GlitchOverlay';
import { AuthResponse } from './types';

const API_URL = '/api/quests';

// Placeholder shown when the library is empty. Module scope, not component scope: as a
// per-render object literal it was a fresh reference every time, which made every useMemo
// depending on it recompute on every render.
const DEFAULT_QUEST: Quest = {
    id: '0',
    title: 'No Active Quest',
    coverUrl: "",
    totalChapters: 0,
    currentChapter: 0,
    status: 'LOCKED',
    classType: 'UNKNOWN',
    link: ''
};

// ─── CHAPTER PROGRESS ─────────────────────────────────────────────────────────
// See requestChapter in App for the full model. A "burst" is one run of chapter changes to
// a single quest that ends in one save: merged taps, a held stepper, or a typed number.
type ChapterPair = { current: number; total: number };
interface ChapterBurst {
    questId: string;
    /** What the server last acknowledged. A failed save returns here. */
    confirmed: ChapterPair;
    /** Where this burst began. Undo returns here. */
    start: ChapterPair;
    /** The latest requested values, already on screen. */
    target: ChapterPair;
    typed: boolean;
    undo: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    inFlight: boolean;
    /** A save was requested while one was already in the air. */
    dirty: boolean;
}
interface ChapterRequestOpts {
    /** 'merge' waits CHAPTER_MERGE_MS for more taps; 'now' sends at once; 'hold' waits for the stepper's release. */
    mode: 'merge' | 'now' | 'hold';
    /** Explicit total (Undo restores it). Defaults to the total on screen. */
    total?: number;
    /** Typed by hand: always offered for Undo, and allowed to raise the total. */
    typed?: boolean;
    /** This change is an Undo; its settle confirms the restore instead of offering another. */
    undo?: boolean;
}
/** Taps closer together than this merge into one save. */
const CHAPTER_MERGE_MS = 600;

/**
 * Should this device start in low-power effects mode? Conservative on purpose: only a
 * Save-Data connection, or hardware reporting 2 GB of memory or 2 CPU cores or fewer. Most
 * phones and every iPad report more than that and keep the full effects unless the reader
 * switches them off. (Safari reports no deviceMemory, so it is judged on cores alone.)
 */
const prefersLowPower = (): boolean => {
    try {
        const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
        return !!nav.connection?.saveData
            || (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2)
            || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2);
    } catch {
        return false;
    }
};

/** The dashboard's keyboard shortcuts, shown by "?" and by the console bar's KEYS button. */
const SHORTCUT_HELP = [
    'SYSTEM SHORTCUTS',
    '→ / ←   Next / previous chapter. Hold the key to keep going.',
    'Tap the chapter number to type a chapter in.',
    'Enter   Open the reading link (when nothing else has focus).',
    '/   Search the Divine Spire.',
    'N   Open a new gate.',
    'Ctrl+Z   Undo the last change while its notice is showing.',
    '?   Show this list.',
].join('\n');
/** A burst that moves at least this many chapters gets an Undo toast. */
const UNDO_THRESHOLD = 5;

// Helper to normalize quest data from both MongoDB and local BASE_QUESTS
const mapQuest = (q: any): Quest => ({
    id: String(q._id || q.id || ""),
    title: q.title || "",
    // Keep the ORIGIN url in state. Proxying happens at render time instead, because
    // this value round-trips back to the database through the edit form — mapping it to
    // a proxied path here is what caused "/api/proxy/image?url=..." to be persisted as
    // the cover. unproxyImageUrl also repairs records already written that way.
    coverUrl: unproxyImageUrl(q.cover || q.coverUrl || ""),
    link: q.readLink || q.link || q.siteUrl || "",
    // Undefined, not "", when the record came from the library list (which omits synopses):
    // "" would read as "no synopsis" and an untouched edit form would save it over the real
    // one. An undefined field is dropped from the save, so the stored synopsis is never hit.
    synopsis: typeof q.synopsis === 'string' ? q.synopsis : undefined,
    currentChapter: Number(q.currentChapter) || 0,
    totalChapters: Number(q.totalChapters) || 0,
    status: (q.status || 'ACTIVE').toUpperCase(),
    classType: q.classType || "PLAYER",
    lastUpdated: q.lastRead || q.lastUpdated || Date.now(),
    newChapters: Number(q.newChapters) || 0
});

/** One full record, synopsis included; the library list leaves synopses out. Null on failure. */
const fetchFullQuest = async (id: string): Promise<Quest | null> => {
    if (!id || id === DEFAULT_QUEST.id || id.startsWith('optimistic-')) return null;
    try {
        const res = await systemFetch(`${API_URL}/${id}`);
        return res.ok ? mapQuest(await res.json()) : null;
    } catch {
        return null;
    }
};

// SUB-COMPONENT: QuestListItem to handle individual drag controls and touch scrolling
const QuestListItem = ({ item, theme, activeId, handleLogClick, onDragStateChange }: any) => {
    const dragControls = useDragControls();
    const isHighlighted = activeId === item.id;

    const handleDragStart = (e: React.PointerEvent) => {
        e.preventDefault();
        onDragStateChange?.(true);   // tell scroll container: lock scroll
        dragControls.start(e);
    };

    const handleDragEnd = () => {
        onDragStateChange?.(false);  // restore scroll
    };

    return (
        <Reorder.Item
            key={item.id}
            value={item}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`relative group cursor-pointer border py-1.5 px-3 transition-colors duration-200 ${isHighlighted ? `${theme.border} ${theme.isDark ? 'bg-white/5' : 'bg-violet-500/10'}` : `border-transparent hover:${theme.borderSubtle} bg-transparent`}`}
        >
            <div className="flex justify-between items-center h-full">
                <div className="flex items-center gap-2 max-w-[85%] min-w-0">
                    {/* Drag Handle — always visible on touch (mobile/tablet), hover-only on desktop.
                        Raised above the row button's stretched hit area so a press here drags
                        rather than selects. */}
                    <div
                        aria-hidden="true"
                        className={`relative z-10 cursor-grab active:cursor-grabbing flex-none touch-none select-none ${theme.baseText}
                            p-2 -ml-2
                            opacity-40 lg:opacity-0 group-hover:opacity-70 active:opacity-100
                            transition-opacity
                            [@media(pointer:coarse)]:opacity-60
                            flex items-center justify-center min-w-[28px] min-h-[32px]
                        `}
                        onPointerDown={handleDragStart}
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* The row's action is a real button so it can be reached and fired from
                        the keyboard (an <li> with onClick cannot). Its ::after stretches over
                        the whole row, so the click target is unchanged. */}
                    <button
                        type="button"
                        onClick={() => handleLogClick(item.id)}
                        aria-current={isHighlighted ? 'true' : undefined}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer after:content-[''] after:absolute after:inset-0"
                    >
                    {/* Every row gets a thumbnail box, so titles line up: a row without a
                        cover used to render none and sat out of line with its neighbours.
                        Decorative (alt ""): the title is right beside it. */}
                    <CoverArt
                        url={item.coverUrl}
                        title={item.title}
                        size="thumb"
                        className={`w-8 h-[45px] xl:w-10 xl:h-[56px] flex-none rounded-sm border ${theme.isDark ? 'border-gray-800' : 'border-gray-300'} opacity-80 group-hover:opacity-100 transition-opacity shadow-sm shrink-0`}
                    />
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className={`font-bold font-mono text-[11px] leading-tight ${isHighlighted ? theme.highlightText : `${theme.mutedText} group-hover:${theme.headingText}`} transition-colors duration-700 uppercase line-clamp-2`}>{item.title}</span>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                            <div className={`w-1 h-1 rounded-full flex-none ${item.status === 'ACTIVE' ? (theme.isDark ? 'bg-amber-400' : 'bg-[#7c3aed]') : 'bg-gray-400'}`} />
                            <span className={`text-[9px] ${theme.mutedText} uppercase font-mono tracking-widest transition-colors duration-700 truncate`}>{item.status}</span>
                            {/* Released since you last read on (the chapter tracker). Reading
                                forward clears it, server-side. */}
                            {item.newChapters > 0 && (
                                <span
                                    className="flex-none px-1 border text-[9px] font-mono font-bold tracking-widest leading-[14px]"
                                    style={{ color: theme.accentInk, borderColor: `${theme.accentColor}80` }}
                                >
                                    +{item.newChapters} NEW
                                </span>
                            )}
                        </div>
                    </div>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {isHighlighted && <Sun size={14} className={`${theme.highlightText} animate-spin-slow transition-colors duration-700 shrink-0`} />}
                </div>
            </div>
        </Reorder.Item>
    );
};

// SUB-COMPONENT: ActiveQuestList — owns touch-action state for drag-vs-scroll resolution
// On touch devices, the browser fights between scroll and drag. This component:
//   1. Keeps touchAction='pan-y' normally (allows vertical scroll)
//   2. Switches to touchAction='none' the instant a drag begins (blocks scroll so Motion can move the item)
//   3. Restores 'pan-y' when drag ends
const ActiveQuestList = ({ orderedActiveQuests, handleReorderActiveQuests, theme, activeId, handleLogClick, loaded }: any) => {
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragStateChange = React.useCallback((dragging: boolean) => {
        setIsDragging(dragging);
    }, []);

    return (
        <div
            className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar overscroll-contain ${isDragging ? 'touch-none' : 'touch-pan-y'}`}
        >
            {/* An empty list says how to fill it, rather than leaving a blank panel; but only
                once the library has loaded and the ordered copy has caught up with it, or it
                flashed on every load before the records arrived. */}
            {loaded && orderedActiveQuests.length === 0 && (
                <p className={`px-1 py-3 font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                    No active quests yet. Open a gate to add one, or set a record ACTIVE from its detail view in the Divine Spire.
                </p>
            )}
            <Reorder.Group
                axis="y"
                values={orderedActiveQuests}
                onReorder={handleReorderActiveQuests}
                className="flex flex-col gap-1 h-full pb-6"
            >
                <AnimatePresence initial={false}>
                    {orderedActiveQuests.map((item: any) => (
                        <QuestListItem
                            key={item.id}
                            item={item}
                            theme={theme}
                            activeId={activeId}
                            handleLogClick={handleLogClick}
                            onDragStateChange={handleDragStateChange}
                        />
                    ))}
                </AnimatePresence>
            </Reorder.Group>
        </div>
    );
};

// ----------------------------------------------------------------------
// LAZY LOADED HEAVY COMPONENTS 
// ----------------------------------------------------------------------
const ManhwaDetail = lazy(() => import('../components/quest/ManhwaDetail'));
const HunterProfile = lazy(() => import('../components/profile/HunterProfile'));
const DivineSpire = lazy(() => import('../components/tower/DivineSpire'));
const SystemGateModal = lazy(() => import('../components/system/SystemGateModal'));

// Loading Fallback Strategy
const HeavyLoader = ({ theme }: { theme: any }) => (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center" role="status" aria-label="Loading">
        <div className={`w-16 h-16 border-2 border-dashed ${theme.id === 'LIGHT' ? 'border-violet-400' : 'border-amber-500'} rounded-full animate-spin`} />
    </div>
);

// --- PORTAL DIVE (Entering the gate, travelling to a new world) ---
// Builds a self-contained "dimensional dive" page painted into the freshly-opened tab, which
// then redirects to the manhwa. The open + write happen inside the click gesture, so Safari's
// popup blocker (which kills a window.open deferred past the gesture) never trips — and the
// animation is actually seen, since focus follows the new tab. No inline <script> is used:
// the tab inherits the site CSP (script-src 'self'), which blocks inline scripts; the redirect
// is a <meta refresh>, and the ring/streak markup is pre-generated here (parent origin).
const buildPortalLoader = (href: string, accent: string, accent2: string): string => {
    const rings = Array.from({ length: 12 }, (_, i) => `<div class="ring" style="animation-delay:${(i * 0.11).toFixed(2)}s"><svg viewBox="0 0 120 120" aria-hidden="true"><polygon points="60,6 111,36 111,84 60,114 9,84 9,36" fill="none" stroke="${accent}" stroke-width="1.4"/><polygon points="60,20 98,42 98,78 60,100 22,78 22,42" fill="none" stroke="${accent2}" stroke-width="0.7" opacity="0.5"/></svg></div>`).join('');
    const streaks = Array.from({ length: 26 }, (_, i) => `<div class="streak" style="--r:${Math.round((i * 360) / 26)}deg;animation-delay:${(Math.random() * 0.8).toFixed(2)}s"></div>`).join('');
    const metaUrl = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2; url=${metaUrl}"><title>Akashic Link</title><style>
:root{--a:${accent};--b:${accent2}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:#030205}
.scene{position:fixed;inset:0;overflow:hidden;perspective:520px;perspective-origin:50% 47%;background:radial-gradient(circle at 50% 47%,#100b16 0%,#060409 55%,#030205 100%);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.space{position:absolute;inset:0;transform-style:preserve-3d}
.ring{position:absolute;left:50%;top:47%;width:340px;height:340px;margin:-170px 0 0 -170px;opacity:0;animation:fly 1.3s cubic-bezier(.55,0,.85,1) forwards}
.ring svg{width:100%;height:100%;display:block;filter:drop-shadow(0 0 6px var(--a))}
.streaks{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.streak{position:absolute;left:50%;top:47%;width:2px;height:60vh;transform-origin:top center;background:linear-gradient(to bottom,transparent,var(--b),#fff);opacity:0;animation:warp 1.1s cubic-bezier(.6,0,.9,1) forwards}
.core{position:absolute;left:50%;top:47%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:radial-gradient(circle,#fff 0%,var(--b) 34%,var(--a) 58%,transparent 80%);animation:core 2s cubic-bezier(.6,0,.85,1) forwards}
.cb{position:absolute;width:24px;height:24px;border-color:var(--a);opacity:0;animation:lock 2s ease-out forwards}
.cb.tl{top:22px;left:22px;border-top:2px solid;border-left:2px solid}
.cb.tr{top:22px;right:22px;border-top:2px solid;border-right:2px solid}
.cb.bl{bottom:22px;left:22px;border-bottom:2px solid;border-left:2px solid}
.cb.br{bottom:22px;right:22px;border-bottom:2px solid;border-right:2px solid}
.lock{position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);opacity:0;animation:lockr 2s ease-out forwards;filter:drop-shadow(0 0 8px var(--a))}
.spin{transform-box:fill-box;transform-origin:center;animation:spin 3s linear infinite}
.cap{position:absolute;left:0;right:0;bottom:76px;text-align:center;font-size:11px;letter-spacing:.42em;color:var(--a);font-weight:700;opacity:0;text-shadow:0 0 12px var(--a);animation:cap 2s ease-out forwards}
.flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 47%,#fff 0%,var(--b) 38%,transparent 74%);opacity:0;animation:flash 2s ease-in forwards}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fly{0%{transform:translateZ(-1600px) rotate(0);opacity:0}12%{opacity:.95}82%{opacity:.95}100%{transform:translateZ(360px) rotate(14deg);opacity:0}}
@keyframes warp{0%{transform:rotate(var(--r)) scaleY(0);opacity:0}25%{opacity:.9}100%{transform:rotate(var(--r)) scaleY(1);opacity:0}}
@keyframes core{0%{transform:scale(.2);opacity:.2}55%{transform:scale(3);opacity:.9}82%{transform:scale(26);opacity:1}95%{transform:scale(46);opacity:1}100%{transform:scale(46);opacity:1}}
@keyframes flash{0%,70%{opacity:0}88%{opacity:1}100%{opacity:1}}
@keyframes lock{0%{opacity:0;transform:scale(.7)}4%{opacity:1;transform:scale(1)}14%{opacity:1}22%{opacity:0;transform:scale(1.15)}100%{opacity:0}}
@keyframes lockr{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}5%{opacity:1;transform:translate(-50%,-50%) scale(1)}16%{opacity:.9}26%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}100%{opacity:0}}
@keyframes cap{0%,4%{opacity:0}10%{opacity:1;letter-spacing:.42em}30%{opacity:1}46%{opacity:0;letter-spacing:1.2em}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ring,.streak,.core,.cb,.lock,.spin,.cap{animation:none}.flash{animation:none;opacity:1}}
</style></head><body><div class="scene"><div class="space">${rings}</div><div class="streaks">${streaks}</div><div class="core"></div><span class="cb tl"></span><span class="cb tr"></span><span class="cb bl"></span><span class="cb br"></span><div class="lock"><svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true"><g class="spin"><circle cx="60" cy="60" r="52" fill="none" stroke="${accent}" stroke-width="1" stroke-dasharray="2 6"/></g><polygon points="60,18 96.4,39 96.4,81 60,102 23.6,81 23.6,39" fill="none" stroke="${accent}" stroke-width="1.4"/></svg></div><div class="cap">ENTERING THE GATE</div><div class="flash"></div></div></body></html>`;
};

// --- APP ---
const App: React.FC = () => {
    // The awakening boot sequence plays for a visitor who is not signed in. Once a session
    // exists, a refresh skips it and lands straight on the dashboard — the intro is a first
    // impression, not a toll booth on every reload. (CSV import used to reuse this as a
    // full-screen loader; it reports progress in a toast now and leaves the app usable.)
    const [booting, setBooting] = useState<boolean>(() => !isAuthenticated());
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const checkMobile = () => setIsMobile(window.innerWidth < 768);

        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkMobile, 100);
        };

        checkMobile();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);
    // Restored from the previous visit. Without this the boot sequence and login screen
    // always render in Void regardless of the palette the user chose, since both run
    // before any in-app toggle is reachable.
    const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
        try {
            const saved = localStorage.getItem('akashic_theme');
            return saved === 'LIGHT' || saved === 'DARK' ? saved : 'DARK';
        } catch {
            return 'DARK'; // storage can throw outright in private mode
        }
    });
    const theme = THEMES[currentTheme];

    // Low-power effects: the animated background, the hero rings or sigil, and the dais render
    // one still frame instead of animating. The reader's own choice wins (saved); otherwise the
    // device decides (prefersLowPower). Reduced motion is handled separately and always applies.
    const [lowPower, setLowPower] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('akashic_effects');
            if (saved === 'low') return true;
            if (saved === 'full') return false;
        } catch { /* private mode: fall through to the device check */ }
        return prefersLowPower();
    });
    const toggleLowPower = useCallback(() => {
        setLowPower(prev => {
            const next = !prev;
            try { localStorage.setItem('akashic_effects', next ? 'low' : 'full'); } catch { /* private mode */ }
            return next;
        });
    }, []);

    // The keyboard focus ring (styles/index.css, :focus-visible) draws in the theme's INK.
    // Set on the document root rather than the dashboard wrapper so the boot, login and
    // every overlay — including ones that render outside that wrapper — pick it up.
    // The accent family (src/core/tokens.ts) lives on :root too, so the `accent-*` utilities
    // resolve everywhere: boot, login, and overlays outside the dashboard wrapper. A layout
    // effect, so the variables are in place before paint, and before the theme toggle's
    // view-transition snapshot of the new theme.
    useLayoutEffect(() => {
        const root = document.documentElement.style;
        root.setProperty('--focus-ring', theme.accentInk);
        for (const [name, value] of Object.entries(accentVars(theme))) root.setProperty(name, value);
        root.colorScheme = theme.isDark ? 'dark' : 'light';
    }, [theme]);

    const [library, setLibrary] = useState<Quest[]>([]);
    /**
     * The first library fetch has finished (either way). Until then an empty library means
     * "not here yet", not "you have none": the empty-state prompts wait for this, or every
     * load flashed "Archive empty / Open your first gate" before the records arrived.
     */
    const [libraryLoaded, setLibraryLoaded] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [userState, setUserState] = useState({ streak: 0, dailyAbsorbed: 0 });
    const [isAuth, setIsAuth] = useState<boolean>(isAuthenticated());

    // Cover-extracted accent color — dynamically sampled per active quest

    const handleEnterPortal = useCallback((rawUrl: string) => {
        if (!rawUrl || rawUrl === '#') return;
        // Only real web links are portal targets.
        let target: URL;
        try { target = new URL(rawUrl); } catch { return; }
        if (target.protocol !== 'http:' && target.protocol !== 'https:') return;

        // Open the destination tab SYNCHRONOUSLY, inside the click gesture. Safari's popup
        // blocker kills any window.open deferred past the gesture (e.g. behind a setTimeout),
        // which is why the old animate-then-open flow silently failed there. We paint the
        // "dimensional dive" into the new tab itself, which then redirects to the manhwa.
        const win = window.open('about:blank', '_blank');
        if (win) {
            try { win.opener = null; } catch { /* cross-origin guard */ }
            try {
                // theme-color-ok: written into a new window's document, where there are no CSS variables
                win.document.write(buildPortalLoader(target.href, theme.accentColor, theme.isDark ? '#fbbf24' : '#e6ddf8'));
                win.document.close();
            } catch {
                win.location.href = target.href;
            }
        } else {
            // Popup blocked outright — fall back to a plain in-gesture open.
            window.open(target.href, '_blank', 'noopener,noreferrer');
        }
    }, [theme.accentColor, theme.isDark]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSpireOpen, setIsSpireOpen] = useState(false);
    /** The "/" shortcut opens the Spire straight into its search; reset on close. */
    const [spireStartInSearch, setSpireStartInSearch] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const detailOpenedFromProfile = useRef(false);
    const lastCoverTap = useRef<number>(0);

    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
    const [editingItem, setEditingItem] = useState<Quest | null>(null);

    const [customSortOrder, setCustomSortOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('activeQuestOrder');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [orderedActiveQuests, setOrderedActiveQuests] = useState<Quest[]>([]);

    // --- SCROLL HANDLING STATE ---
    const [isHUDVisible, setIsHUDVisible] = useState(true);
    const [isMobileHudExpanded, setIsMobileHudExpanded] = useState(false);

    const isMobileHudExpandedRef = useRef(false);
    useEffect(() => {
        isMobileHudExpandedRef.current = isMobileHudExpanded;
    }, [isMobileHudExpanded]);

    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerHUD = () => {
        setIsHUDVisible(true);

        if (hudTimeoutRef.current) {
            clearTimeout(hudTimeoutRef.current);
        }

        if (isMobileHudExpandedRef.current) return;

        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDVisible(false);
        }, 2000);
    };

    // Keep the HUD permanently visible while it is expanded;
    // restart the auto-hide countdown when it collapses.
    useEffect(() => {
        if (isMobileHudExpanded) {
            // Cancel any in-flight hide timer and lock HUD on.
            if (hudTimeoutRef.current) {
                clearTimeout(hudTimeoutRef.current);
                hudTimeoutRef.current = null;
            }
            setIsHUDVisible(true);
        } else {
            // HUD just collapsed — restart the 2-second countdown.
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => {
                setIsHUDVisible(false);
            }, 2000);
        }
    }, [isMobileHudExpanded]);

    useEffect(() => {
        if (booting || !isAuth) return;

        let lastScrollY = 0;

        const scrollContainer = document.getElementById('content-scroll');
        if (!scrollContainer) return;

        const handleScroll = () => {
            const currentScrollY = scrollContainer.scrollTop;

            // Header logic
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsHeaderVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setIsHeaderVisible(true);
            }

            lastScrollY = currentScrollY;

            triggerHUD();
        };

        // Initial auto-hide
        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDVisible(false);
        }, 2000);

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        scrollContainer.addEventListener('touchstart', triggerHUD, { passive: true });
        scrollContainer.addEventListener('pointerdown', triggerHUD);

        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
            scrollContainer.removeEventListener('touchstart', triggerHUD);
            scrollContainer.removeEventListener('pointerdown', triggerHUD);
            if (hudTimeoutRef.current) {
                clearTimeout(hudTimeoutRef.current);
            }
        };
    }, [booting, isAuth, isSpireOpen]);

    // Force scroll reset on responsive mode shift to prevent ghost scroll gaps
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                const scroller = document.getElementById('content-scroll');
                if (scroller && scroller.scrollTop > 0) {
                    scroller.scrollTop = 0;
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isSpireOpen && !isDetailOpen && !isModalOpen && !isProfileOpen) {
            triggerHUD();
        }
    }, [isSpireOpen, isDetailOpen, isModalOpen, isProfileOpen]);

    // --- SYSTEM NOTIFICATION STATE ---
    const [sysNote, setSysNote] = useState<{
        isOpen: boolean;
        message: string;
        type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
        confirm: boolean;
        resolve?: (val: boolean) => void;
    }>({ isOpen: false, message: "", type: 'INFO', confirm: false });

    const showSystemNotification = useCallback((message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', confirm: boolean = false): Promise<boolean> => {
        return new Promise((resolve) => {
            setSysNote({ isOpen: true, message, type, confirm, resolve });
        });
    }, []);

    const handleSysNoteClose = (result: boolean) => {
        if (sysNote.resolve) sysNote.resolve(result);
        setSysNote(prev => ({ ...prev, isOpen: false }));
    };

    // --- TOASTS ---
    // Non-blocking notices (SystemToast): confirmations carrying Undo, task progress, soft
    // failures. One at a time; a new toast replaces the current one. Questions that need an
    // answer still go through showSystemNotification above.
    const [toast, setToast] = useState<ToastSpec | null>(null);
    const toastSeq = useRef(0);
    const showToast = useCallback((spec: Omit<ToastSpec, 'id'>) => {
        const id = ++toastSeq.current;
        setToast({ ...spec, id });
        return id;
    }, []);
    /** Patch the toast in place (progress updates) without restarting its timer. */
    const updateToast = useCallback((id: number, patch: Partial<Omit<ToastSpec, 'id'>>) => {
        setToast(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    }, []);
    const dismissToast = useCallback((id: number) => {
        setToast(prev => (prev && prev.id === id ? null : prev));
    }, []);

    const handleLoginSuccess = (auth: AuthResponse) => {
        // The session cookie is already set by the server; this only records display state.
        saveAuthData(auth);
        setIsAuth(true);
        // Data fetching will be triggered by useEffect
    };

    const handleLogout = useCallback(async () => {
        // A guest's sign-out also deletes the demo library, which is worth saying before it happens.
        const isGuest = getStoredUser()?.role === 'GUEST';
        const confirmed = await showSystemNotification(
            `TERMINATE_SESSION: Are you sure?\n${isGuest ? 'This signs you out and deletes the demo library you have been using.' : 'This signs you out on this device. Your archive is kept.'}`,
            "WARNING",
            true
        );
        if (confirmed) {
            await performLogout();
            setIsAuth(false);
            setLibrary([]);
        }
    }, [showSystemNotification]);

    const [guestTimeLeft, setGuestTimeLeft] = useState<number | null>(null);

    // Format milliseconds to MM:SS or HH:MM:SS
    const formatTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // GUEST SESSION REAPER & TIMER (Hard 2-hour Limit)
    useEffect(() => {
        if (!isAuth) {
            setGuestTimeLeft(null);
            return;
        }

        const user = getStoredUser();
        if (user && user.role === 'GUEST') {
            // guestId format: g_<base36_timestamp>_<random>
            const parts = user.id.split('_');
            const startTime = parseInt(parts[1], 36);
            const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

            if (isNaN(startTime)) return;

            const checkSession = () => {
                const now = Date.now();
                const elapsed = now - startTime;
                const remaining = Math.max(0, TWO_HOURS_MS - elapsed);
                setGuestTimeLeft(remaining);

                // Notifications for imminent portal collapse
                if (remaining <= 60000 && remaining > 50000) {
                    showSystemNotification("SYSTEM_ALERT: Portal destabilizing. 1 minute remaining.\nThe guest session ends in 1 minute, and its demo data is deleted.", "WARNING");
                } else if (remaining <= 300000 && remaining > 290000) {
                    showSystemNotification("SYSTEM_ALERT: Connection failing. 5 minutes remaining.\nThe guest session ends in 5 minutes, and its demo data is deleted.", "WARNING");
                }

                if (remaining <= 0) {
                    performLogout().then(() => {
                        setIsAuth(false);
                        setLibrary([]);
                        showSystemNotification("PROTOCOL_COMPLETE: Trial experience expired. Data purged.\nThe 2-hour guest session has ended and its demo data was deleted. Start a new one any time.", "INFO");
                    });
                }
            };

            checkSession();
            const timer = setInterval(checkSession, 10000); // Check every 10s
            return () => clearInterval(timer);
        }
    }, [isAuth, showSystemNotification]);

    // Guest sandbox cleanup is deliberately NOT tied to page unload.
    //
    // There used to be a `beforeunload` beacon to POST /api/auth/logout. It never
    // actually did anything: sendBeacon cannot set an Authorization header, so the call
    // was rejected. Once the session moved to a cookie the browser started attaching it
    // automatically, which made the beacon work — and `beforeunload` fires on an ordinary
    // refresh, so a visitor reloading the page silently lost their sandbox mid-demo.
    //
    // Sandboxes are reclaimed by explicit logout, by the 2-hour token lifetime, and by
    // the reaper the scheduled workflow drives. A refresh now keeps the guest signed in,
    // which is how the demo behaved before.

    /**
     * Open the detail view. It shows the custom synopsis, which the library list omits, so
     * the full record is fetched alongside; until it lands the view shows the metadata
     * description, as it did for any record without an override.
     */
    const openDetail = (item: Quest) => {
        setSelectedQuest(item);
        setIsDetailOpen(true);
        if (item.synopsis !== undefined) return;
        void fetchFullQuest(item.id).then(full => {
            if (!full) return;
            setSelectedQuest(prev => (prev && prev.id === full.id ? { ...prev, synopsis: full.synopsis } : prev));
            setLibrary(prev => prev.map(q => (q.id === full.id ? { ...q, synopsis: full.synopsis } : q)));
        });
    };

    const handleViewDetails = (id: string) => {
        const item = library.find(q => q.id === id);
        if (item) openDetail(item);
    };

    useEffect(() => {
        if (isAuth) {
            fetchInitialData();
        }
        // Deliberately keyed on isAuth alone. fetchInitialData is redefined every render
        // and closes over activeId, so listing it would re-pull the entire library on each
        // render and again whenever the active quest changed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuth]);

    // Brief RGB-split flash for abrupt, destructive moments: a record purged, a session cut.
    const [glitchActive, setGlitchActive] = useState(false);
    // Stable, so GlitchOverlay's timer effect is not restarted on every render.
    const endGlitch = useCallback(() => setGlitchActive(false), []);

    // Listen for server-side 401s (expired/invalid token) and clean up gracefully
    useEffect(() => {
        const handleSessionExpired = () => {
            setIsAuth(false);
            setLibrary([]);
            setActiveId(null);
            // The session was severed, not ended by the user — mark the drop to the login screen.
            setGlitchActive(true);
        };
        window.addEventListener('akashic:session-expired', handleSessionExpired);
        return () => window.removeEventListener('akashic:session-expired', handleSessionExpired);
    }, []);

    const fetchInitialData = async () => {
        try {
            const res = await systemFetch('/api/boot/initial-data');

            if (!res.ok) throw new Error(`PROTOCOL_ERROR: ${res.status}`);

            const { quests, userState: stats } = await res.json();

            // Prepare all data first for a single batch update
            if (Array.isArray(quests)) {
                const mappedData = quests.map(mapQuest);

                // Determine active ID before setting states
                let newActiveId = activeId;
                if (!activeId && mappedData.length > 0) {
                    const topActive = mappedData
                        .filter(i => i.status === 'ACTIVE')
                        .sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime())[0];
                    newActiveId = topActive ? topActive.id : mappedData[0].id;
                }

                // Batch the updates
                setLibrary(mappedData);
                if (newActiveId !== activeId) setActiveId(newActiveId);
                if (stats) setUserState(stats);
            }
        } catch (e: any) {
            if (!e.message.includes('401')) {
                console.error("BOOT_SYNC_FAILURE:", e.message);
            }
            // Leave the library as it stands. It starts empty, so a failed first load
            // still shows the empty state; but this also runs as a refresh (after an
            // import or a recalibration), and a transient failure there used to wipe a
            // perfectly good library off the screen. A real 401 is handled separately
            // by the session-expired listener, which does clear it.
        } finally {
            setLibraryLoaded(true);
        }
    };

    /**
     * Refresh only the streak / daily-absorbed counters.
     *
     * Logging a chapter advances server-side state that the PUT response does not carry,
     * but the library itself is already up to date from that response — so this hits the
     * small /api/user/state endpoint rather than re-pulling every quest.
     */
    const refreshUserState = useCallback(async () => {
        const res = await systemFetch('/api/user/state');
        if (!res.ok) return;
        const stats = await res.json();
        if (stats) setUserState(stats);
    }, []);

    // Migration / Integrity Check removed since we use MongoDB now

    const activeQuest = useMemo(() => {
        return library.find(q => q.id === activeId) || library[0] || DEFAULT_QUEST;
    }, [library, activeId]);

    const progressPercent = useMemo(() => Math.min(100, Math.round((activeQuest.currentChapter / (activeQuest.totalChapters || 1)) * 100)), [activeQuest]);
    const totalChaptersRead = useMemo(() => library.reduce((acc, item) => acc + (item.currentChapter || 0), 0), [library]);

    // Player rank, plus how far the library is toward the next one — that is what the
    // EXP bar under the rank name shows. It used to be pinned at scaleX(0.6) whatever the
    // library held. (A themed `style` field also lived here; nothing read it, and it
    // compared against 'Sovereign' while every label is upper-case.)
    const playerRank = useMemo(() => {
        const titles = library.length;
        const rawPlayerRank = getPlayerRank(titles);
        const next = USER_RANKS[USER_RANKS.indexOf(rawPlayerRank) + 1] ?? null;
        const progress = next
            ? Math.min(1, Math.max(0, (titles - rawPlayerRank.minTitles) / (next.minTitles - rawPlayerRank.minTitles)))
            : 1;
        return { ...rawPlayerRank, name: rawPlayerRank.label, next, progress, titles };
    }, [library.length]);

    const activeQuests = useMemo(() => {
        return library.filter(item => item.status === 'ACTIVE');
    }, [library]);

    useEffect(() => {
        const sorted = [...activeQuests].sort((a, b) => {
            const indexA = customSortOrder.indexOf(a.id);
            const indexB = customSortOrder.indexOf(b.id);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
        });
        setOrderedActiveQuests(sorted);
    }, [activeQuests, customSortOrder]);

    // Stable identity: this touches only state setters and localStorage, so it never
    // needs rebuilding — and as a fresh function each render it was invalidating the
    // memoised main panel on every single render.
    const handleReorderActiveQuests = useCallback((newOrder: Quest[]) => {
        setOrderedActiveQuests(newOrder); // Optimistic UI update
        const newIds = newOrder.map(q => q.id);
        setCustomSortOrder(newIds);
        localStorage.setItem('activeQuestOrder', JSON.stringify(newIds));
    }, []);
    const spireItems = useMemo(() => {
        return [...library].sort((a, b) => {
            const idA = a.id || '';
            const idB = b.id || '';
            return idA.localeCompare(idB);
        });
    }, [library]);

    const handleActivate = (id: string) => {
        // Find item and set as selected for detail view
        const item = library.find(i => i.id === id);
        if (item) openDetail(item);
    }

    // Stable: reads nothing from render scope beyond setters and module constants.
    const handleLogClick = useCallback(async (id: string) => {
        setActiveId(id);
        const now = new Date().toISOString();
        // OPTIMISTIC UPDATE: Immediate UI Feedback
        setLibrary(prev => prev.map(item => item.id === id ? { ...item, lastUpdated: now } : item));

        try {
            const res = await systemFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ lastUpdated: now })
            });
            // Only a real record replaces the one on screen. An error body used to go
            // straight through mapQuest and swap the quest for an empty, untitled one.
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const mappedUpdated = mapQuest(await res.json());
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            // Only the recency stamp was at stake; the optimistic one is harmless to keep.
            console.error("Update failed", e);
        }
    }, []);

    const handleSetActiveQuest = async (id: string) => {
        const previous = library.find(item => item.id === id);
        setActiveId(id);
        const now = Date.now();
        // OPTIMISTIC UPDATE
        setLibrary(prev => prev.map(item => item.id === id ? { ...item, status: 'ACTIVE', lastUpdated: new Date(now).toISOString() } : item));

        try {
            const res = await systemFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'ACTIVE', lastRead: now })
            });
            if (res.status === 401) return; // the session-expired listener takes over
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const mappedUpdated = mapQuest(await res.json());
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            console.error("Set active failed", e);
            if (previous) setLibrary(prev => prev.map(item => item.id === id ? previous : item));
            showToast({
                tone: 'ERROR',
                message: 'SYNC_FAILED',
                detail: `Couldn't set "${previous?.title ?? 'this record'}" active. Check your connection and try again.`,
                duration: 7000,
            });
        }
    };

    const handleSave = async (data: Partial<Quest>) => {
        const targetId = data.id || (editingItem ? editingItem.id : null);
        const isEditing = !!targetId;
        const url = isEditing ? `${API_URL}/${targetId}` : API_URL;
        const method = isEditing ? 'PUT' : 'POST';

        // 1. CLEAN BODY: Remove internal fields and map to backend schema
        const body: any = {};
        Object.entries(data).forEach(([key, value]) => {
            if (['id', '_id', '__v', 'lastRead', 'lastUpdated', 'cover', 'readLink'].includes(key)) return;
            if (key === 'coverUrl') body.cover = value;
            else if (key === 'link') body.readLink = value;
            else if (['currentChapter', 'totalChapters'].includes(key)) body[key] = Number(value) || 0;
            else body[key] = value;
        });

        // 2. OPTIMISTIC UPDATE — close modal & update UI instantly, sync in background.
        // An edit MERGES into the stored record: the detail view saves partial updates
        // ({ id, status }, { id, synopsis }), and replacing the record with one left it
        // without a title, which crashed the next render.
        const tempId = `optimistic-${Date.now()}`;
        const previous = isEditing ? library.find(q => q.id === targetId) : undefined;
        const optimisticItem: Quest = {
            ...(previous as Quest),
            ...(data as Quest),
            id: isEditing ? targetId! : tempId,
            lastUpdated: new Date().toISOString(),
        };

        if (isEditing) {
            setLibrary(prev => prev.map(q => q.id === targetId ? { ...q, ...optimisticItem } : q));
            if (selectedQuest?.id === targetId) setSelectedQuest({ ...selectedQuest, ...optimisticItem });
        } else {
            setLibrary(prev => [optimisticItem, ...prev]);
            handleActivate(optimisticItem.id);
        }

        // Close modal immediately — no waiting
        setIsModalOpen(false);
        setEditingItem(null);

        // 3. BACKGROUND SYNC to Atlas
        try {
            const res = await systemFetch(url, { method, body: JSON.stringify(body) });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Save failure');
            }
            const saved = await res.json();
            const mappedSaved = mapQuest(saved);

            // Replace optimistic item with real server data
            if (isEditing) {
                setLibrary(prev => prev.map(q => q.id === targetId ? mappedSaved : q));
                if (selectedQuest?.id === targetId) setSelectedQuest(mappedSaved);
            } else {
                setLibrary(prev => prev.map(q => q.id === tempId ? mappedSaved : q));
            }
        } catch (e: any) {
            console.error("Save failure — rolling back:", e);
            // Rollback optimistic update on failure
            if (isEditing) {
                // Back to the record as it was before this save (editingItem is null when
                // the save came from the detail view, which used to leave the edit in place).
                const restore = previous || editingItem;
                setLibrary(prev => prev.map(q => q.id === targetId ? (restore || q) : q));
                if (restore && selectedQuest?.id === targetId) setSelectedQuest(restore);
            } else {
                setLibrary(prev => prev.filter(q => q.id !== tempId));
            }
            // The server's reason (a validation message, a duplicate) is the useful part.
            showSystemNotification(`SYNC_FAILED\nYour changes were not saved: ${e.message}\nNothing else was changed. Check your connection or correct the details, then save again.`, 'ERROR');
        }
    };

    /**
     * CSV import: create what is new, advance what the file has further along, leave the rest.
     *
     * What changed from the old version, and why:
     *  - The merge compared totalChapters. A file exported a week ago carries the same totals
     *    and a LOWER chapter, so it passed and set your reading position back. It now goes by
     *    currentChapter: a row only updates a record it is ahead of (or level with, carrying a
     *    higher total).
     *  - Blank cells no longer wipe stored values: a row without a cover or link keeps yours,
     *    and the total never drops.
     *  - Titles match by the server's own rule (normalizeTitle), so a row the server would
     *    refuse as a duplicate is recognised here instead of being POSTed into a 409.
     *  - It used to run each row through handleSave, which opened a blocking error dialog per
     *    failure and hid the app behind the boot screen. Progress is now a toast; failures are
     *    collected into one report.
     */
    const handleImportQuests = async (rows: Quest[]) => {
        // One row per title. When a file lists a title twice, the row further along wins.
        const byKey = new Map<string, Quest>();
        for (const row of rows) {
            const key = normalizeTitle(row.title);
            if (!key) continue;
            const seen = byKey.get(key);
            if (!seen || row.currentChapter > seen.currentChapter) byKey.set(key, row);
        }
        const existingByKey = new Map(library.map(q => [normalizeTitle(q.title), q] as const));

        type Op = { kind: 'create' | 'update'; title: string; url: string; method: 'POST' | 'PUT'; body: Record<string, unknown> };
        const ops: Op[] = [];
        let unchanged = 0;
        for (const [key, row] of byKey) {
            const existing = existingByKey.get(key);
            if (!existing) {
                ops.push({
                    kind: 'create', title: row.title, url: API_URL, method: 'POST',
                    body: {
                        title: row.title,
                        currentChapter: row.currentChapter,
                        totalChapters: Math.max(row.totalChapters, row.currentChapter),
                        status: row.status || 'ACTIVE',
                        classType: row.classType || 'PLAYER',
                        ...(row.link ? { readLink: row.link } : {}),
                        ...(row.coverUrl ? { cover: row.coverUrl } : {}),
                    },
                });
                continue;
            }
            const ahead = row.currentChapter > existing.currentChapter
                || (row.currentChapter === existing.currentChapter && row.totalChapters > existing.totalChapters);
            if (!ahead) { unchanged++; continue; }
            ops.push({
                // ?import=1: replaying a file is not reading today, so it moves no streak.
                kind: 'update', title: existing.title, url: `${API_URL}/${existing.id}?import=1`, method: 'PUT',
                body: {
                    currentChapter: row.currentChapter,
                    totalChapters: Math.max(row.totalChapters, existing.totalChapters, row.currentChapter),
                    ...(row.status ? { status: row.status } : {}),
                    ...(row.classType ? { classType: row.classType } : {}),
                    ...(row.link ? { readLink: row.link } : {}),
                    ...(row.coverUrl ? { cover: row.coverUrl } : {}),
                },
            });
        }

        if (ops.length === 0) {
            showToast({ tone: 'INFO', message: 'Archive already current', detail: `All ${byKey.size} records in the file match or trail your library.`, duration: 6000 });
            return;
        }

        const toastId = showToast({ tone: 'INFO', message: `Importing · 0 / ${ops.length}`, detail: 'Writing records to the archive…', duration: 0, progress: 0 });
        let created = 0, updated = 0, done = 0;
        const failed: string[] = [];

        // Three at a time: much faster than strictly sequential, gentle on the API.
        let next = 0;
        const worker = async () => {
            while (next < ops.length) {
                const op = ops[next++];
                try {
                    const res = await systemFetch(op.url, { method: op.method, body: JSON.stringify(op.body) });
                    if (res.status === 401) throw new Error('session ended');
                    if (res.status === 409) unchanged++; // the server already holds this title
                    else if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    else if (op.kind === 'create') created++;
                    else updated++;
                } catch (e) {
                    console.error(`[Import] ${op.title}:`, e);
                    failed.push(op.title);
                }
                done++;
                updateToast(toastId, { message: `Importing · ${done} / ${ops.length}`, progress: done / ops.length });
            }
        };
        await Promise.all([worker(), worker(), worker()]);
        await fetchInitialData();

        const parts = [`${created} added`, `${updated} advanced`, `${unchanged} already current`];
        if (failed.length) parts.push(`${failed.length} failed`);
        dismissToast(toastId);
        if (failed.length === 0) {
            showToast({ tone: 'SUCCESS', message: 'Import complete', detail: parts.join(' · '), duration: 7000 });
        } else {
            showSystemNotification(
                `IMPORT FINISHED WITH ERRORS\n${parts.join(' · ')}.\nNot imported: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? ` and ${failed.length - 8} more` : ''}.\nCheck your connection and import the file again; records already written will be left as they are.`,
                'WARNING',
            );
        }
    };

    // ─── CHAPTER PROGRESS ───────────────────────────────────────────────────────
    // Every way of moving a chapter (a tap, a held stepper, a typed number, an arrow key, an
    // Undo) goes through requestChapter. The screen changes at once; the save is batched:
    //
    //   - taps closer than CHAPTER_MERGE_MS merge into one save;
    //   - a held stepper saves once, on release;
    //   - a typed number saves immediately.
    //
    // Saves for a quest are single-flight. While one is in the air, later changes wait and go
    // out together when it lands: two PUTs in flight can reach the server out of order and
    // leave it on the older chapter. Replies that a newer change has overtaken are not applied
    // either, so the number on screen never slips backwards.
    //
    // A failed save returns the quest to the last chapter the server confirmed and says so.
    // (The old updateProgress kept showing the unsaved number until the next reload.)
    const libraryRef = useRef(library);
    libraryRef.current = library;
    const activeQuestRef = useRef(activeQuest);
    activeQuestRef.current = activeQuest;
    const bursts = useRef(new Map<string, ChapterBurst>());
    // announceBurst offers Undo, which is a requestChapter call; the ref breaks the cycle.
    const requestChapterRef = useRef<(questId: string, wanted: number, opts: ChapterRequestOpts) => boolean>(() => false);

    const applyChapter = useCallback((questId: string, pair: ChapterPair) => {
        setLibrary(prev => prev.map(q => q.id === questId ? { ...q, currentChapter: pair.current, totalChapters: pair.total } : q));
    }, []);

    /** After a burst lands: offer Undo for a big move, and mark a climb to a higher floor. */
    const announceBurst = useCallback((b: ChapterBurst, final: ChapterPair) => {
        const quest = libraryRef.current.find(q => q.id === b.questId);
        if (!quest) return;
        if (b.undo) {
            showToast({ tone: 'INFO', message: `Restored · CH ${final.current}`, detail: quest.title, duration: 3000 });
            return;
        }
        const from = b.start;
        const fromFloor = floorIndexForItem({ ...quest, currentChapter: from.current, totalChapters: from.total });
        const toFloor = floorIndexForItem({ ...quest, currentChapter: final.current, totalChapters: final.total });
        const ascended = toFloor > fromFloor;
        const raised = final.total !== from.total;
        const undoable = b.typed || raised || Math.abs(final.current - from.current) >= UNDO_THRESHOLD;
        if (!ascended && !undoable) return;

        const moved = `Chapter ${from.current} → ${final.current}`;
        const totalNote = raised ? `total raised to ${final.total} (was ${from.total})` : '';
        showToast({
            tone: ascended ? 'SUCCESS' : 'INFO',
            message: ascended ? `Ascended → ${FLOOR_DEFS[toFloor].name}` : `CH ${from.current} → ${final.current}`,
            detail: ascended
                ? [moved, totalNote].filter(Boolean).join(' · ')
                : totalNote ? totalNote.charAt(0).toUpperCase() + totalNote.slice(1) : quest.title,
            action: undoable
                ? { label: 'Undo', onAction: () => { requestChapterRef.current(b.questId, from.current, { total: from.total, mode: 'now', undo: true }); } }
                : undefined,
            duration: undoable ? 8000 : 4500,
        });
    }, [showToast]);

    /** Send a quest's pending chapter. Safe to call at any time; it never double-sends. */
    const sendBurst = useCallback(async (questId: string, keepalive = false): Promise<void> => {
        const b = bursts.current.get(questId);
        if (!b) return;
        if (b.timer) { clearTimeout(b.timer); b.timer = null; }
        if (b.inFlight) { b.dirty = true; return; }

        const sent = { ...b.target };
        if (sent.current === b.confirmed.current && sent.total === b.confirmed.total) {
            // Moved and moved back before the save went out: nothing to send.
            bursts.current.delete(questId);
            return;
        }
        b.inFlight = true;
        b.dirty = false;
        const body: Record<string, number> = { currentChapter: sent.current };
        if (sent.total !== b.confirmed.total) body.totalChapters = sent.total;

        try {
            const res = await systemFetch(`${API_URL}/${questId}`, { method: 'PUT', body: JSON.stringify(body), keepalive });
            b.inFlight = false;
            if (bursts.current.get(questId) !== b) return; // signed out meanwhile
            if (res.status === 401) { bursts.current.delete(questId); return; } // session handler takes over
            if (res.status === 404) {
                // Deleted from another tab or device: the record is gone, not unsaved.
                bursts.current.delete(questId);
                setLibrary(prev => prev.filter(q => q.id !== questId));
                showToast({ tone: 'WARNING', message: 'Record not found', detail: 'This series was removed elsewhere, so the chapter was not saved.', duration: 7000 });
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const saved = mapQuest(await res.json());
            b.confirmed = sent;

            if (b.dirty) { void sendBurst(questId); return; }      // more arrived mid-flight
            if (b.target.current !== sent.current || b.target.total !== sent.total) return; // a merge timer will send the rest

            // Settled. Adopt the server's copy (it carries lastRead and the like).
            bursts.current.delete(questId);
            setLibrary(prev => prev.map(q => q.id === questId ? saved : q));
            announceBurst(b, sent);
            // Streak and daily-absorbed are the only other state a chapter changes server-side.
            refreshUserState().catch(() => { /* counters refresh on the next load */ });
        } catch (e) {
            b.inFlight = false;
            console.error('Chapter save failed', e);
            if (bursts.current.get(questId) !== b) return;
            bursts.current.delete(questId);
            applyChapter(questId, b.confirmed);
            showToast({
                tone: 'ERROR',
                message: 'SYNC_FAILED',
                detail: `Couldn't save — back to chapter ${b.confirmed.current}. Check your connection.`,
                duration: 8000,
            });
        }
    }, [announceBurst, applyChapter, refreshUserState, showToast]);

    /**
     * Move a quest to `wanted`. Returns false when that is no change (a held stepper stops on it).
     *
     * Past the known total, a TYPED chapter raises the total to match (you read it, so it
     * exists; Undo restores both), while a stepper stops at the total.
     */
    const requestChapter = useCallback((questId: string, wanted: number, opts: ChapterRequestOpts): boolean => {
        const quest = libraryRef.current.find(q => q.id === questId);
        if (!quest || questId === DEFAULT_QUEST.id || questId.startsWith('optimistic-')) return false;

        let b = bursts.current.get(questId);
        const shown: ChapterPair = b ? { ...b.target } : { current: quest.currentChapter, total: quest.totalChapters };
        let total = Math.max(0, Math.floor(opts.total ?? shown.total));
        let current = Math.max(0, Math.floor(wanted));
        if (total > 0 && current > total) {
            if (opts.typed) total = current;
            else current = total;
        }
        if (current === shown.current && total === shown.total) return false;

        if (!b) {
            const now: ChapterPair = { current: quest.currentChapter, total: quest.totalChapters };
            b = { questId, confirmed: now, start: { ...now }, target: { ...now }, typed: false, undo: false, timer: null, inFlight: false, dirty: false };
            bursts.current.set(questId, b);
        }
        b.target = { current, total };
        if (opts.typed) b.typed = true;
        if (opts.undo) b.undo = true;
        applyChapter(questId, b.target);

        if (b.timer) { clearTimeout(b.timer); b.timer = null; }
        if (opts.mode === 'now') void sendBurst(questId);
        else if (opts.mode === 'merge') b.timer = setTimeout(() => { void sendBurst(questId); }, CHAPTER_MERGE_MS);
        // 'hold': no timer; releasing the stepper commits.
        return true;
    }, [applyChapter, sendBurst]);
    requestChapterRef.current = requestChapter;

    /** One step on the active quest, from wherever its chapter currently shows. */
    const stepChapter = useCallback((delta: number, mode: 'merge' | 'hold'): boolean => {
        const q = activeQuestRef.current;
        if (!q || q.id === DEFAULT_QUEST.id) return false;
        const b = bursts.current.get(q.id);
        return requestChapter(q.id, (b ? b.target.current : q.currentChapter) + delta, { mode });
    }, [requestChapter]);

    /** A typed chapter for the active quest: saved at once, and always offered for Undo. */
    const commitTypedChapter = useCallback((chapter: number) => {
        const q = activeQuestRef.current;
        if (q && q.id !== DEFAULT_QUEST.id) requestChapter(q.id, chapter, { mode: 'now', typed: true });
    }, [requestChapter]);

    /** Stepper released: a hold commits now, a plain tap merges with its neighbours. */
    const releaseStepper = useCallback((repeated: boolean) => {
        const q = activeQuestRef.current;
        const b = q ? bursts.current.get(q.id) : undefined;
        if (!b) return;
        if (repeated) void sendBurst(b.questId);
        else {
            if (b.timer) clearTimeout(b.timer);
            b.timer = setTimeout(() => { void sendBurst(b.questId); }, CHAPTER_MERGE_MS);
        }
    }, [sendBurst]);

    const holdPrev = useHoldRepeat(() => stepChapter(-1, 'hold'), releaseStepper);
    const holdNext = useHoldRepeat(() => stepChapter(1, 'hold'), releaseStepper);

    // Signing out (or a severed session) abandons anything pending; its replies are ignored.
    useEffect(() => {
        if (isAuth) return;
        setLibraryLoaded(false); // the next session's first load starts over
        bursts.current.forEach(b => { if (b.timer) clearTimeout(b.timer); });
        bursts.current.clear();
    }, [isAuth]);

    /** Send everything pending now, e.g. when the page is going away. */
    const flushChapters = useCallback((keepalive = false) => {
        bursts.current.forEach((b, id) => { if (!b.inFlight) void sendBurst(id, keepalive); });
    }, [sendBurst]);

    // A tap merged in the last 600ms would be lost if the tab closed before its timer fired.
    // keepalive lets that final save outlive the page.
    useEffect(() => {
        const onPageHide = () => flushChapters(true);
        const onVisibility = () => { if (document.visibilityState === 'hidden') flushChapters(true); };
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [flushChapters]);

    /** Bring a record back out of the server's Trash: a delete's Undo, or the Trash panel. */
    const restoreQuest = useCallback(async (id: string): Promise<boolean> => {
        try {
            const res = await systemFetch(`${API_URL}/${id}/restore`, { method: 'POST' });
            if (res.status === 401) return false;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }
            const restored = mapQuest(await res.json());
            setLibrary(prev => (prev.some(q => q.id === restored.id) ? prev : [restored, ...prev]));
            showToast({ tone: 'SUCCESS', message: 'Record restored', detail: restored.title, duration: 3500 });
            return true;
        } catch (e: any) {
            showToast({ tone: 'ERROR', message: 'Restore failed', detail: e?.message || 'Check your connection and try again.', duration: 8000 });
            return false;
        }
    }, [showToast]);

    /**
     * Delete, with Undo in place of a confirmation dialog.
     *
     * The server moves the record to its Trash rather than erasing it (soft delete), so the
     * delete can happen at once and the toast can take it back. A confirmation asks before
     * every delete to protect against the rare mistake; Undo costs nothing when you meant it.
     */
    const deleteQuest = async () => {
        const item = editingItem;
        if (!item || item.id.startsWith('optimistic-')) return;

        // Anything still pending for this record is moot now.
        const pending = bursts.current.get(item.id);
        if (pending?.timer) clearTimeout(pending.timer);
        bursts.current.delete(item.id);

        setLibrary(prev => prev.filter(q => q.id !== item.id));
        setIsModalOpen(false);
        setEditingItem(null);
        if (selectedQuest?.id === item.id) setIsDetailOpen(false);
        // The glitch still marks the purge; Undo is the way back.
        setGlitchActive(true);

        try {
            const res = await systemFetch(`${API_URL}/${item.id}`, { method: 'DELETE' });
            if (res.status === 401) return;
            // 404 means it was already gone, which is the outcome we wanted.
            if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error("Deletion failure", e);
            setLibrary(prev => (prev.some(q => q.id === item.id) ? prev : [item, ...prev]));
            showToast({ tone: 'ERROR', message: 'PURGE_PROTOCOL_FAILED', detail: `"${item.title}" was not deleted. Check your connection and try again.`, duration: 8000 });
            return;
        }

        showToast({
            tone: 'WARNING',
            message: 'Record purged',
            detail: `"${item.title}" moved to the Trash.`,
            action: { label: 'Undo', onAction: () => { void restoreQuest(item.id); } },
            duration: 10000,
        });
    };
    // useCallback so the memoised header can list it as a dependency without being
    // rebuilt on every render. Its only input is currentTheme, which the header already
    // depends on, so this changes nothing about when the header recomputes.
    // ─── NEW-CHAPTER CHECK ──────────────────────────────────────────────────────
    // On demand, for whoever is signed in (the hourly workflow already covers the owner's
    // archive). The server checks up to 12 series per call, least recently checked first,
    // so pressing it again walks further through a large library.
    const fetchInitialDataRef = useRef(fetchInitialData);
    fetchInitialDataRef.current = fetchInitialData;
    const [chapterCheckBusy, setChapterCheckBusy] = useState(false);
    const checkNewChapters = useCallback(async () => {
        setChapterCheckBusy(true);
        const pendingId = showToast({ tone: 'INFO', message: 'Scanning for new chapters', detail: 'Checking up to 12 series against MangaDex and AniList…', duration: 0 });
        try {
            const res = await systemFetch('/api/quests/sync-chapters', { method: 'POST' });
            if (res.status === 401) { dismissToast(pendingId); return; }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
            await fetchInitialDataRef.current();
            const found: { title: string; added: number }[] = (data.updated || []).filter((u: { added: number }) => u.added > 0);
            if (found.length > 0) {
                const named = found.slice(0, 3).map(u => `${u.title} +${u.added}`).join(' · ');
                showToast({ tone: 'SUCCESS', message: `New chapters · ${found.length} series`, detail: found.length > 3 ? `${named} · and ${found.length - 3} more` : named, duration: 9000 });
            } else {
                showToast({
                    tone: 'INFO',
                    message: 'No new chapters found',
                    detail: `Checked ${data.checked ?? 0} series. Many licensed manhwa are not listed on MangaDex, so not every series can be tracked.`,
                    duration: 8000,
                });
            }
        } catch (e: any) {
            showToast({ tone: 'ERROR', message: 'Scan failed', detail: e?.message || 'Try again in a while.', duration: 8000 });
        } finally {
            setChapterCheckBusy(false);
        }
    }, [showToast, dismissToast]);

    // ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
    // Dashboard only, and never while typing. Listed by "?" (SHORTCUT_HELP); the steppers'
    // and CREATE_GATE's tooltips name theirs too. Ctrl/Cmd+Z is the exception that works
    // anywhere outside a text field: it takes the Undo on whatever notice is showing.
    const toastRef = useRef(toast);
    toastRef.current = toast;
    const showShortcuts = useCallback(() => { void showSystemNotification(SHORTCUT_HELP, 'INFO'); }, [showSystemNotification]);
    const shortcutsBlocked = !isAuth || booting || isSpireOpen || isModalOpen || isProfileOpen || isDetailOpen || sysNote.isOpen;
    useEffect(() => {
        const isTextEntry = (el: Element | null) =>
            !!el && el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.isComposing) return;
            const focused = document.activeElement;
            if (isTextEntry(focused)) return;

            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
                const t = toastRef.current;
                if (t?.action && t.action.label.toLowerCase() === 'undo') {
                    e.preventDefault();
                    t.action.onAction();
                    dismissToast(t.id);
                }
                return;
            }
            if (shortcutsBlocked || e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowLeft':
                    e.preventDefault();
                    stepChapter(e.key === 'ArrowRight' ? 1 : -1, 'merge');
                    return;
                case 'Enter': {
                    // Only from the page itself: Enter on a focused control belongs to it.
                    if (focused && focused !== document.body) return;
                    const link = activeQuestRef.current.link;
                    if (link) { e.preventDefault(); handleEnterPortal(link); }
                    return;
                }
                case '/':
                    e.preventDefault();
                    setSpireStartInSearch(true);
                    setIsSpireOpen(true);
                    return;
                case 'n':
                case 'N':
                    if (e.repeat) return;
                    e.preventDefault();
                    setEditingItem(null);
                    setIsModalOpen(true);
                    return;
                case '?':
                    e.preventDefault();
                    showShortcuts();
                    return;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [shortcutsBlocked, stepChapter, handleEnterPortal, dismissToast, showShortcuts]);

    // Stable identity so BootScreen's timeline effect is not re-created on every render.
    const finishBooting = useCallback(() => setBooting(false), []);

    const toggleTheme = useCallback(() => {
        const next: ThemeId = currentTheme === 'LIGHT' ? 'DARK' : 'LIGHT';
        const applyTheme = () => {
            setCurrentTheme(next);
            try {
                localStorage.setItem('akashic_theme', next);
            } catch {
                // Non-fatal: the palette still applies for this session.
            }
        };

        // The whole page — background atmosphere, gradients, brackets and the WebGL dais —
        // crossfades as one via the View Transitions API, instead of every layer hard-cutting
        // while only the token colours ease. `flushSync` makes the state change land inside the
        // transition's capture. The `theme-switching` class freezes the per-element colour
        // transitions for the capture, so the "after" frame is the final palette rather than a
        // frame caught mid-fade (which would crossfade old->old). Falls back to the plain swap
        // where the API is absent or motion is reduced; the 700ms token transitions cover that.
        const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<unknown> } };
        const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (doc.startViewTransition && !reduce) {
            const root = document.documentElement;
            root.classList.add('theme-switching');
            const transition = doc.startViewTransition(() => { flushSync(applyTheme); });
            transition.finished.finally(() => root.classList.remove('theme-switching'));
        } else {
            applyTheme();
        }
    }, [currentTheme]);

    const memoizedHeader = useMemo(() => (
        <AnimatePresence>
            {isHeaderVisible && (
                <motion.header
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="fixed top-0 w-full z-40 bg-transparent h-16 px-4 flex items-center justify-between gap-2"
                >
                    {/* A guest's header carries the countdown plus three glyphs, which measured
                        408px of content on a 375px phone and pushed Create off the screen. Phones
                        get a smaller emblem, a smaller wordmark (dropped entirely under 360px)
                        and tighter gaps; Log out moves to the profile panel below sm. */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                            <SystemLogo theme={theme} className="w-full h-full" />
                        </div>
                        <div className="flex flex-col leading-none max-[359px]:hidden">
                            <div className="flex gap-2 items-baseline">
                                <span className={`font-mono text-[10px] tracking-[0.2em] ${theme.headingText} font-bold transition-colors duration-700`}>SYSTEM.ROOT</span>
                            </div>
                            <ScrambleText
                                text="AKASHIC"
                                className="font-orbitron text-base sm:text-lg tracking-[0.3em] font-bold drop-shadow-sm transition-colors duration-700"
                                animatedGradient={true}
                                /* Light used sky-500 -> cyan-500, which measured 2.08:1 on the
                                   page for 18px text. The wordmark is read, so it takes the ink
                                   ramp; the shimmer still travels across it. */
                                gradientColors={theme.isDark ? "from-amber-600 via-yellow-400 to-white" : theme.inkGradient}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {guestTimeLeft !== null && (
                            <div className="flex flex-col items-end leading-none sm:mr-2">
                                {/* A countdown is a warning, so it stays amber even when the theme is
                                    cyan — but amber-500 belongs to the dark theme and measures 1.84:1
                                    on the page. `warningInk` keeps the meaning and drops four steps on
                                    light. The glow goes with it: there is nothing on a pale page for an
                                    8px amber spill to brighten. */}
                                <span className="text-[7px] font-mono tracking-[0.2em] font-black uppercase" style={{ color: theme.warningInk }}>LINK_STABILITY</span>
                                <span
                                    className="text-[14px] font-mono font-black"
                                    style={{ color: theme.warningInk, filter: theme.isDark ? 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' : undefined }}
                                >
                                    {formatTime(guestTimeLeft)}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                            title={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                            className={`w-8 h-8 flex items-center justify-center border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded transition-colors duration-700`}
                        >
                            {currentTheme === 'LIGHT' ? <Sun size={14} className="text-[#7c3aed] transition-colors duration-700" /> : <Moon size={14} className="text-amber-400 transition-colors duration-700" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            aria-label="Log out"
                            title="Log out"
                            className={`hidden sm:flex w-8 h-8 items-center justify-center border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 hover:bg-red-500/80 hover:border-red-500' : 'bg-black/5 hover:bg-red-500 hover:border-red-500'} rounded transition-colors duration-300 group/logout`}
                        >
                            <LogOut size={14} className={`${theme.mutedText} group-hover/logout:text-white transition-colors duration-300`} />
                        </button>
                        {/* Below lg the labelled button would crowd the header, and it used to
                            simply disappear — leaving phones and tablets with no way to add a
                            quest at all. The same action as a compact glyph, beside the toggle. */}
                        <button
                            type="button"
                            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                            aria-label="Create gate"
                            title="Create gate"
                            className={`lg:hidden w-8 h-8 flex items-center justify-center border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded transition-colors duration-700 cursor-pointer`}
                        >
                            <Plus size={14} />
                        </button>
                        <button type="button" onClick={() => { setEditingItem(null); setIsModalOpen(true); }} title="New gate (N)" className={`hidden lg:flex px-4 py-1.5 border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors duration-700 font-mono text-[10px] tracking-widest items-center gap-2 cursor-pointer`}>
                            <Plus size={12} /> CREATE_GATE
                        </button>
                    </div>
                </motion.header>
            )}
        </AnimatePresence>
    ), [theme, currentTheme, isHeaderVisible, guestTimeLeft, toggleTheme, handleLogout]);

    /** True while any full-screen view covers the dashboard. Both the background field
     *  and the hero dais stop their loops on this rather than rendering behind an overlay. */
    const overlayOpen = isModalOpen || isDetailOpen || isProfileOpen || isSpireOpen;
    /** Hold the dashboard's animated layers still: behind an overlay, or in low-power mode. */
    const effectsPaused = overlayOpen || lowPower;

    /**
     * The card's chrome is white/grey, not the accent.
     *
     * The card IS the projection, so its edges belong to the same light as the
     * platform underneath rather than to the HUD around it. Hue-free in both themes;
     * only the value flips, because white on the light page would be invisible.
     */
    const holoEdge = theme.isDark ? '#ffffff' : '#5a6673';
    const holoSoft = theme.isDark ? '#d8d8de' : '#8d95a1';

    /** Text ink for the mobile HUD plates, which stay dark in both themes. See the HUD. */
    const hudInk = 'text-accent-plate';

    /**
     * Sidebar collapse. Desktop only — below `lg` the sidebar stacks under the hero
     * rather than sitting beside it, so there is no width to reclaim there and every
     * class below is `lg:`-prefixed.
     */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try { return localStorage.getItem('akashic_sidebar_collapsed') === '1'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('akashic_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* private mode */ }
    }, [sidebarCollapsed]);

    const memoizedMain = useMemo(() => (
        <main id="content-scroll"
            className="relative mt-16 h-[calc(100dvh-104px)] lg:h-[calc(100dvh-100px)] overflow-y-auto lg:overflow-hidden overflow-x-hidden hide-scrollbar px-4 pb-6 lg:pb-2 z-10 flex flex-col">
            <div className={`w-full max-w-[1400px] flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-8 pt-2 lg:pt-2 pb-0 ${sidebarCollapsed ? 'lg:mx-auto' : 'lg:ml-auto'}`}>
                {/* LEFT COLUMN: HERO CANVAS */}
                <div className="flex-none lg:flex-1 flex flex-col lg:h-full order-1 overflow-visible relative">
                    {/* --hero-w is the phone card width, and it is HEIGHT-driven as well as
                        width-driven. Below md the whole hero stack — card, platform, title,
                        progress, controls — ends 282.6 + 1.583w px down the page (measured),
                        so for the controls to clear the 28px console bar on the first screen
                        w can be at most (100dvh - 320px) * 0.632. 240px floors it on short
                        phones, where the page scrolls instead. The card and the title margin
                        both read this one value, so the two can never be solved separately. */}
                    <div className="relative z-10 w-full h-full flex flex-col px-4 md:px-6 lg:px-8 justify-between gap-4 overflow-visible pt-8 lg:pt-16 [--hero-w:clamp(240px,calc((100dvh_-_320px)_*_0.632),min(85vw,320px))]">

                        {/* CENTER: The 3-Column Display (Enhanced Gaps for Tablets) */}
                        <div className="flex-1 min-h-0 flex justify-center items-center gap-4 md:gap-14 lg:gap-6 xl:gap-12 w-full max-w-[1400px] mx-auto px-4">

                            {/* Left Column: Rank & Class — justify-center+self-stretch centers against cover */}
                            <div className="hidden md:flex flex-col items-end justify-center self-stretch flex-1 basis-0 min-w-0 shrink">
                                <div className="flex flex-col items-end gap-6 xl:gap-8 w-full -mt-[30px]">
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-2 flex items-center justify-end gap-1.5`}>
                                            <Crown size={10} style={{ color: theme.accentInk }} />
                                            <span style={{ marginRight: '-0.3em' }} className={theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}>RANK ASSESSMENT</span>
                                        </div>
                                        <div className={`text-6xl xl:text-[80px] font-black font-orbitron leading-none transition-colors duration-700 text-right [filter:drop-shadow(0_0_25px_var(--accent-glow))] ${theme.isDark ? 'text-[var(--accent-ink)]' : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`}`}>
                                            {calculateQuestRank(activeQuest)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono tracking-[0.3em] uppercase mb-1 text-right w-full ${theme.isDark ? theme.mutedText : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>CLASSIFICATION</div>
                                        <div className={`text-base lg:text-lg xl:text-2xl font-black font-orbitron tracking-wider whitespace-nowrap text-right transition-colors duration-700 ${theme.isDark ? 'text-[var(--accent-ink)]' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.inkGradient}`}`}>{activeQuest.classType || 'UNKNOWN'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* The card opens the editor on double-click/double-tap, and was
                                reachable no other way from here — so it is also a real control:
                                focusable, named, and opened with Enter or Space. With an empty
                                library the placeholder has no record to edit, so the same gesture
                                (a single one) opens CREATE_GATE instead. */}
                            <div
                                role="button"
                                tabIndex={0}
                                aria-label={activeQuest.id === DEFAULT_QUEST.id ? 'Create a new gate' : `Edit ${activeQuest.title}`}
                                onDoubleClick={() => {
                                    if (activeQuest.id === DEFAULT_QUEST.id) return;
                                    setEditingItem(activeQuest); setIsModalOpen(true);
                                }}
                                onClick={() => {
                                    if (activeQuest.id === DEFAULT_QUEST.id) {
                                        setEditingItem(null); setIsModalOpen(true);
                                        return;
                                    }
                                    const now = Date.now();
                                    if (now - lastCoverTap.current < 300) {
                                        setEditingItem(activeQuest);
                                        setIsModalOpen(true);
                                    }
                                    lastCoverTap.current = now;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    setEditingItem(activeQuest.id === DEFAULT_QUEST.id ? null : activeQuest);
                                    setIsModalOpen(true);
                                }}
                                className="relative flex-none h-full min-h-0 min-w-0 w-[var(--hero-w)] md:w-full md:max-w-[45%] lg:w-auto lg:max-h-[48dvh] aspect-[72/103] self-center flex items-center justify-center transition-all duration-700 ease-out transform-gpu hover:-translate-y-2 perspective-[1000px] group cursor-pointer"
                                style={{
                                    // The mat, and the card's two rest states, as variables so the
                                    // hover transition stays a CSS transition — an inline style
                                    // cannot express :hover, and the card must not re-render on it.
                                    //
                                    // The mat is a spread-only shadow rather than a plate behind the
                                    // card: it needs no node, changes no layout, and cannot drift
                                    // out of register with a card whose height is viewport-driven.
                                    // Cover art is dark and saturated, so on the light page it was a
                                    // maximum-contrast rectangle punching a hole in the sheet; the
                                    // mat is deliberately DARKER than the page so the eye steps
                                    // page -> mat -> art instead of falling straight through. On the
                                    // void the problem inverts — the art dissolves into the
                                    // background — so there the mat is a faint light rim instead.
                                    '--card-mat': theme.isDark ? 'rgba(255,255,255,0.07)' : '#c4b3dd',
                                    '--card-rest': `0 0 0 10px var(--card-mat), ${elevation(theme, 2)}`,
                                    '--card-raised': `0 0 0 10px var(--card-mat), ${elevation(theme, 3)}`,
                                } as React.CSSProperties}
                            >

                                {/* CARD-CENTRED RINGS — centred on this card and the platform below it
                                    (composition centre ≈ 54% down this box), not on the viewport, so the
                                    platform sits at the heart of them. First child, so they paint beneath
                                    the cone, dais and card. Each theme keeps its own ring language: the
                                    Void's simple concentric SanctuaryRing, the day theme's summoning sigil. */}
                                {theme.isDark ? (
                                    <SanctuaryRing
                                        theme={theme}
                                        isPaused={effectsPaused}
                                        className="left-1/2 top-[54%] w-[380%] aspect-square -translate-x-1/2 -translate-y-1/2 z-0"
                                    />
                                ) : (
                                    <ArcaneSigil
                                        theme={theme}
                                        paused={effectsPaused}
                                        className="left-1/2 top-[54%] w-[400%] aspect-square -translate-x-1/2 -translate-y-1/2 z-0"
                                    />
                                )}

                                {/* PROJECTION CONE — the light the dais throws upward.
                                    Rebuilt from stacked radial gradients anchored at the emitter
                                    rather than a clip-path trapezoid. The old version had three
                                    straight clip edges and terminated at its brightest point, so it
                                    read as a white plate laid on the platform; these have no edge
                                    anywhere, they simply fall off to nothing. White in both themes
                                    like the platform on dark. On light it composites normally with
                                    a cool blue wash instead: `screen` only lightens so it was a
                                    no-op there, and `multiply` against a near-white page was too
                                    faint to see. A pale page has no headroom above it, so the shaft
                                    has to read slightly DARKER than the background — and it has to
                                    be cool rather than neutral grey, or the same value just reads
                                    as grime instead of light.

                                    The stops matter more than the peak. A peak alpha set at 0%
                                    only exists at the single centre point; the earlier version was
                                    already down to 0.20 by 42% of the radius, which composites to
                                    about RGB(209,221,233) against a ~243 page — a delta of 30,
                                    which disappears against a background that has its own
                                    gradients. These hold 0.40 out to a third of the radius so the
                                    strong part covers real area, not one pixel.

                                    The hue tracks the PLATFORM, never the theme accent — the beam
                                    is the light that platform emits, so on dark it is white like
                                    the dais and on light it is the dais's own neutral (#5a6673,
                                    the same value its tier edges use). A cyan beam was tried and
                                    rejected: it read as a separate accent element rather than as
                                    the platform's light.

                                    A neutral has only VALUE to work with, and the light page is
                                    slate-50 (#f8fafc, ~248), so the alpha has to be high or the
                                    shaft washes out entirely. At 0.52 it composites to about
                                    RGB(160,165,177) — a delta near 90, which is the point it
                                    actually reads.

                                    The small `translate-y` matters: these gradients are anchored at
                                    the element's BOTTOM, and with the platform lowered that bottom
                                    sat 24px above the disc, so the brightest part of the beam was
                                    glowing in the empty gap instead of on the emitter. Below lg the
                                    platform now sits lower (see the dais), and 35% is what keeps this
                                    origin on its emitter there too: the origin lands 2.146w(t - 0.34)
                                    below the container, the emitter ~0.01-0.03w below it. */}
                                <div
                                    className={`absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[35%] [@media(min-width:1024px)_and_(min-height:1000px)]:translate-y-[37%] w-[170%] h-[150%] pointer-events-none z-0 opacity-100 transition-opacity duration-700 ${theme.isDark ? 'mix-blend-screen' : ''}`}
                                    style={{
                                        // Two ellipses sharing the emitter as their origin: a tight
                                        // bright core at the disc, and a wider dimmer spread above it.
                                        //
                                        // HARD RULE: the falloff must complete inside the box on ALL
                                        // FOUR sides, and that includes the side the origin sits on.
                                        // For `ellipse <rx>% <ry>% at 50% <oy>%` ending at stop <s>%:
                                        //   horizontal  rx*s          < 0.50
                                        //   upward      ry*s          < oy
                                        //   downward    ry*s          < 1 - oy
                                        // The origin used to be at `50% 100%` — the element's bottom
                                        // edge — where alpha is at its MAXIMUM with nothing below to
                                        // fade into, so the box was cut off hard right where the glow
                                        // was strongest. Checking only the horizontal term missed it.
                                        // Now: rx*s = 0.64*0.62 = 0.397 < 0.50, ry*s = 0.52*0.62 =
                                        // 0.322 < min(0.66, 0.34). The element is positioned so this
                                        // interior origin lands on the disc.
                                        // The gradients are radial, so they spill as far DOWN from the emitter
                                        // as they reach up, which put glow under the platform and across the
                                        // title. This holds full strength down to the disc (the 66% origin)
                                        // then fades out over the next 8% — soft enough to leave no edge, and
                                        // finished inside the element so the box itself still never shows.
                                        maskImage: 'linear-gradient(to bottom, #000 0%, #000 66%, transparent 74%)',
                                        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 66%, transparent 74%)',
                                        background: theme.isDark
                                            ? 'radial-gradient(ellipse 30% 40% at 50% 66%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.11) 40%, rgba(255,255,255,0) 78%),'
                                              + 'radial-gradient(ellipse 64% 52% at 50% 66%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 62%)'
                                            : 'radial-gradient(ellipse 26% 40% at 50% 66%, rgba(124,58,237,0.55) 0%, rgba(124,58,237,0.30) 38%, rgba(124,58,237,0) 76%),'
                                              + 'radial-gradient(ellipse 58% 52% at 50% 66%, rgba(139,92,246,0.28) 0%, rgba(139,92,246,0.12) 34%, rgba(139,92,246,0) 62%)',
                                    }}
                                />

                                {/* HOLOGRAPHIC DAIS — the card stands on it.
                                    Sits after the frosted panel so that panel's backdrop-blur
                                    never samples it (a blurred canvas under a perspective
                                    ancestor is what softened the rank sigil), and before the
                                    cover wrapper so the card still occludes the dais centre.
                                    Centred on the card's bottom edge: the dais origin projects
                                    to the middle of its own canvas. */}
                                <HoloDais
                                    theme={theme}
                                    paused={effectsPaused}
                                    /* Narrower on a phone: the card is nearly the whole
                                       screen there, so 190% of it overflowed the viewport.

                                       Below lg the card keeps its fixed 20px lift and the
                                       PLATFORM moves instead: lifting the card further would
                                       push its reticles under the fixed header, which they
                                       already clear by only 4px. Solved rather than tuned.
                                       With canvas height h = width/5, the body's back rim
                                       projects at 0.139h below the canvas top and the front
                                       floor ring at 0.848h, so a translate of t puts the back
                                       rim h(t - 0.861) from the container's bottom. The card's
                                       base is at -20px; t = 0.80 (phone, h = 0.236w) and
                                       t = 0.82 (md, h = 0.39w) leave it ~14px above the rim,
                                       where the old 26% / 56% / 68% had it 25px, 15px and 1px
                                       INTO the platform. The title block below makes room for
                                       the front ring that this pushes down; see its margin.
                                       lg+ is unchanged: the card lifts by 7.4vh there. */
                                    className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[80%] w-[118%] aspect-[5/1] z-0 md:translate-y-[82%] md:w-[195%] lg:translate-y-[56%] [@media(min-width:1024px)_and_(min-height:1000px)]:translate-y-[68%]"
                                />

                                {/* Outer wrapper: pulsing glow border around the cover (SHARP + PARALLAX FLOAT).
                                    Card3D adds the pointer-tracked tilt and sheen; it keeps its own
                                    state in refs so this memoized subtree never re-renders on move.

                                    The negative `top` lifts the card clear of the platform so its
                                    base never touches the disc — it hovers over the emitter. It must
                                    be applied HERE and not on the container: the dais anchors to the
                                    container's bottom edge, so moving that moves the platform too.

                                    The lift and `max-h` above are solved together, not guessed. The
                                    disc's back rim projects 0.432 * canvasHeight above the container's
                                    bottom, and the canvas height scales off the card width, so a taller
                                    card needs a bigger lift — which at the old 54vh drove the card's
                                    top under the fixed header. 45vh is the tallest card whose required
                                    lift still leaves the corner reticles below it. */}
                                <Card3D className="relative -top-5 lg:-top-[4.5dvh] w-full h-full card-plate">

                                    {/* Corner Reticles (External Floating Targeting Geometry) */}
                                    <div className="absolute -top-[16px] -left-[16px] w-8 h-8 border-t-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={theme.isDark ? { borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}cc)` } : { borderImage: 'linear-gradient(135deg, #a855f7, #7c3aed 55%, #5b21b6) 1', filter: 'drop-shadow(0 0 6px #7c3aed77)' }} />
                                    <div className="absolute -top-[16px] -right-[16px] w-8 h-8 border-t-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={theme.isDark ? { borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}cc)` } : { borderImage: 'linear-gradient(135deg, #a855f7, #7c3aed 55%, #5b21b6) 1', filter: 'drop-shadow(0 0 6px #7c3aed77)' }} />
                                    <div className="absolute -bottom-[16px] -left-[16px] w-8 h-8 border-b-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={theme.isDark ? { borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}cc)` } : { borderImage: 'linear-gradient(135deg, #a855f7, #7c3aed 55%, #5b21b6) 1', filter: 'drop-shadow(0 0 6px #7c3aed77)' }} />
                                    <div className="absolute -bottom-[16px] -right-[16px] w-8 h-8 border-b-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={theme.isDark ? { borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}cc)` } : { borderImage: 'linear-gradient(135deg, #a855f7, #7c3aed 55%, #5b21b6) 1', filter: 'drop-shadow(0 0 6px #7c3aed77)' }} />

                                    {/* Pulsing border glow (Unified High-Contrast Chrome - Visible on White) */}
                                    <div
                                        className="absolute -inset-[3.5px] animate-[pulse_3s_ease-in-out_infinite] pointer-events-none z-10"
                                        style={{
                                            // An emitted rim rather than a chrome frame: a hard white
                                            // border is the single strongest cue that this is a solid
                                            // printed card rather than light standing in the air.
                                            border: `1px solid ${holoEdge}${theme.isDark ? 'e6' : 'b3'}`,
                                            boxShadow: theme.isDark
                                                ? `0 0 14px ${holoEdge}88, 0 0 44px ${holoEdge}33, inset 0 0 22px ${holoEdge}22`
                                                : `0 0 12px ${holoEdge}66, 0 0 34px ${holoEdge}22, inset 0 0 18px ${holoEdge}1a`
                                        }}
                                    />
                                    {/* Inner cover image container (SHARP + HIGH IMAGE VISIBILITY) */}
                                    <div
                                        className={`w-full h-full overflow-hidden relative transition-all duration-700`}
                                        style={{
                                            border: `1px solid ${holoEdge}${theme.isDark ? '33' : '2a'}`,
                                            boxShadow: `inset 0 0 26px ${holoSoft}${theme.isDark ? '26' : '18'}`,
                                            // Just short of opaque, so the field behind reads faintly
                                            // through the art. This is the last cue that separates
                                            // projected light from a printed card; any lower and the
                                            // cover itself starts to lose definition.
                                            opacity: theme.isDark ? 0.93 : 0.95,
                                            // Dissolve the lower edge into the cone so the card has no
                                            // bottom boundary — it resolves out of the dais light.
                                            maskImage: 'linear-gradient(to top, transparent 0%, rgba(0,0,0,0.5) 2.5%, #000 8%)',
                                            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, rgba(0,0,0,0.5) 2.5%, #000 8%)',
                                        }}
                                    >
                                        {/* The plate (monogram) is always underneath; the cover fades in
                                            over it once loaded. A missing, slow or dead cover, and the
                                            empty-library placeholder, all show the plate, never the
                                            browser's broken-image icon. */}
                                        <CoverArt
                                            key={activeQuest.id}
                                            url={activeQuest.coverUrl}
                                            title={activeQuest.title}
                                            alt={`Cover art for ${activeQuest.title}`}
                                            size="hero"
                                            className="w-full h-full"
                                            imgClassName="transition-transform duration-[10s] group-hover:scale-110"
                                            label={activeQuest.id === DEFAULT_QUEST.id ? (libraryLoaded ? 'Archive empty' : 'Syncing archive') : undefined}
                                            hint={activeQuest.id === DEFAULT_QUEST.id && libraryLoaded ? 'Tap to open a gate' : undefined}
                                            glyph={activeQuest.id === DEFAULT_QUEST.id ? (libraryLoaded ? '+' : '◈') : undefined}
                                        />

                                        {/* THEME-ADAPTIVE TINT OVERLAY (Color Unity) */}
                                        <div
                                            className="absolute inset-0 pointer-events-none transition-colors duration-700"
                                            style={{
                                                backgroundColor: holoSoft,
                                                opacity: theme.isDark ? 0.04 : 0.12,
                                                mixBlendMode: theme.isDark ? 'overlay' : 'soft-light'
                                            }}
                                        />

                                        {/* HOLOGRAPHIC SWEEP (System Scan) */}
                                        <motion.div
                                            className="absolute inset-0 z-20 pointer-events-none"
                                            initial={{ x: '-100%', y: '-100%' }}
                                            animate={{ x: '100%', y: '100%' }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                                            style={{
                                                background: `linear-gradient(135deg, transparent 45%, ${holoEdge}33 50%, transparent 55%)`
                                            }}
                                        />

                                        {/* Hover gradient overlay (Initial opacity-0 for immediate full visibility) */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        {/* SCANLINES — the readout texture that makes this read as a
                                            projection rather than print. Kept faint: strong enough to
                                            see at arm's length, weak enough not to fight the cover art. */}
                                        <div
                                            className="absolute inset-0 z-20 pointer-events-none manhwa-holo-scan"
                                            style={{
                                                background: `repeating-linear-gradient(to bottom, ${holoSoft}${theme.isDark ? '24' : '18'} 0px, ${holoSoft}${theme.isDark ? '24' : '18'} 1px, transparent 1px, transparent 4px)`,
                                            }}
                                        />

                                        {/* Emission line at the base — the edge the projection is
                                            drawn from, so it is accent-coloured rather than white. */}
                                        <div
                                            className="absolute bottom-0 left-0 w-full h-[2px] z-30"
                                            style={{
                                                background: `linear-gradient(90deg, transparent, ${holoEdge}, transparent)`,
                                                boxShadow: `0 0 18px ${holoEdge}, 0 0 38px ${holoEdge}88`,
                                            }}
                                        />
                                    </div>{/* end inner cover */}
                                </Card3D>
                            </div>{/* end outer glow wrapper */}

                            {/* Right Column: Sequence & System Log — justify-center mirrors left */}
                            <div className="hidden md:flex flex-col items-start justify-center gap-4 md:gap-6 xl:gap-10 self-stretch flex-1 basis-0 min-w-0 shrink">
                                <div className="flex flex-col items-start w-max max-w-none">
                                    <div className={`text-[10px] font-mono tracking-[0.3em] uppercase mb-1 ${theme.isDark ? theme.mutedText : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>SEQUENCE DATA</div>
                                    {/* Tap (or Enter) to type a chapter: one save however far
                                        the jump, where the steppers would take a tap per chapter. */}
                                    <ChapterField
                                        value={activeQuest.currentChapter}
                                        pad={3}
                                        disabled={activeQuest.id === DEFAULT_QUEST.id}
                                        label={`Chapter ${activeQuest.currentChapter}${activeQuest.totalChapters > 0 ? ` of ${activeQuest.totalChapters}` : ''}. Set chapter`}
                                        onCommit={commitTypedChapter}
                                        className="text-5xl xl:text-[70px] font-black font-mono tabular-nums leading-none text-left"
                                        displayClassName={`transition-colors duration-700 ${theme.isDark ? 'text-[var(--accent-ink)]' : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`}`}
                                        inkColor={theme.accentInk}
                                    />
                                    <div className={`text-[11px] font-mono tracking-widest mt-2 ${theme.mutedText} flex items-center gap-2`}>
                                        <span>OF <span className={`font-bold`} style={{ color: theme.accentInk }}>{activeQuest.totalChapters}</span> CHAPTERS</span>
                                        {(activeQuest.newChapters ?? 0) > 0 && (
                                            <span className="px-1 border font-bold leading-[16px]" style={{ color: theme.accentInk, borderColor: `${theme.accentColor}80` }}>
                                                +{activeQuest.newChapters} NEW
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full max-w-[220px]">
                                    <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-2 flex items-center gap-1.5 border-b ${theme.borderSubtle} pb-2`}>
                                        <span className={`w-1 h-1 rounded-full animate-ping`} style={{ backgroundColor: theme.accentColor }} /> EVENT_LOG
                                    </div>
                                    {/* Log lines are read, so they take the ink. This was the decorative
                                        accent at 73% alpha — 2.08:1 — and the timestamps then had
                                        `opacity-40` on top of that, which landed them near 1.9:1. The
                                        timestamps are secondary, so they use the muted token rather than
                                        an alpha knocked out of the ink. */}
                                    <div className={`flex flex-col gap-1.5 text-[9px] font-mono leading-relaxed tracking-wider mt-2`} style={{ color: theme.accentInk }}>
                                        <div className="flex gap-2">
                                            <span className={`shrink-0 ${theme.mutedText}`}>[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                                            <span className="whitespace-nowrap">Signal acquired.</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`shrink-0 ${theme.mutedText}`}>[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                                            <span className={`font-bold whitespace-nowrap`} style={{ color: theme.accentInk, textShadow: theme.isDark ? `0 0 10px ${theme.accentColor}` : undefined }}>Awaiting directive.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Below lg the lowered platform's front ring reaches under the
                            container, so the title steps down to clear it: front ring at
                            h(t - 0.152) below the container, plus 12px, minus the gap-4 already
                            there. Phone: 0.236w * 0.648 with w = --hero-w. md: 0.39w * 0.668
                            with w = 45% of (100vw - 112px), the centre row's width. */}
                        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 shrink-0 pointer-events-auto mt-[calc(var(--hero-w)_*_0.153_-_4px)] md:mt-[calc((100vw_-_112px)_*_0.1172_-_4px)] lg:mt-0">
                            {/* Title — overflow-visible to prevent last character clipping */}
                            <div className="text-center flex flex-col items-center justify-end px-6 w-full min-h-[3rem] sm:min-h-[4rem] xl:min-h-[5rem] overflow-visible">
                                {/* Gradient text is read, so on light it runs on the ink ramp: the
                                    decorative cyan measured 1.84:1 here, and long titles drop to
                                    16px where even 3:1 is not enough. Dark keeps its amber sheen
                                    (6.3:1 at the dimmest stop) via the inline image, which wins
                                    over the class gradient. */}
                                <h1
                                    className={`${activeQuest.title.length > 42 ? 'text-base sm:text-lg xl:text-2xl' : activeQuest.title.length > 25 ? 'text-xl sm:text-2xl xl:text-3xl' : 'text-2xl sm:text-3xl xl:text-4xl'} font-black font-orbitron tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${theme.isDark ? '' : theme.inkGradient} uppercase leading-[1.15] line-clamp-2 w-full`}
                                    style={{
                                        backgroundImage: theme.isDark
                                            ? `linear-gradient(90deg, ${theme.accentColor}cc, ${theme.accentColor}, ${theme.accentColor}cc)`
                                            : undefined,
                                        textTransform: 'uppercase',
                                        paddingBottom: '0.1em', // prevents descender clipping
                                    }}
                                >
                                    {activeQuest.title}
                                </h1>
                            </div>

                            {/* Progress */}
                            <div className="space-y-1.5 max-w-3xl w-full mx-auto">
                                <div className={`flex justify-between items-center gap-2 text-[11px] sm:text-xs font-mono font-bold tracking-widest drop-shadow-md`}>
                                    <span className={`flex items-center gap-1.5 ${theme.headingText}`}><Zap size={14} style={{ color: theme.accentInk }} /> COMPLETION_RATE</span>
                                    <span className="flex items-center gap-2.5">
                                        {/* Below md the SEQUENCE DATA column, and with it the chapter
                                            number, is hidden, so phones saw only the percentage. This
                                            is their chapter readout, and it takes a typed chapter too. */}
                                        {activeQuest.id !== DEFAULT_QUEST.id && (
                                            <span className={`md:hidden flex items-center gap-1 ${theme.mutedText}`}>
                                                CH
                                                <ChapterField
                                                    value={activeQuest.currentChapter}
                                                    label={`Chapter ${activeQuest.currentChapter}${activeQuest.totalChapters > 0 ? ` of ${activeQuest.totalChapters}` : ''}. Set chapter`}
                                                    onCommit={commitTypedChapter}
                                                    className="font-mono font-bold tabular-nums text-[11px] sm:text-xs tracking-widest inline-block min-w-[2.75rem] px-1 py-1.5 -my-1.5 text-center"
                                                    displayClassName="text-[var(--accent-ink)]"
                                                    inkColor={theme.accentInk}
                                                    minChars={2}
                                                />
                                                <span>/ {activeQuest.totalChapters || '?'}</span>
                                            </span>
                                        )}
                                        <span style={{ color: theme.accentInk }}>{progressPercent}%</span>
                                    </span>
                                </div>
                                <div className={`h-1.5 ${theme.isDark ? 'bg-gray-900/40' : 'bg-gray-300/40'} w-full relative overflow-hidden backdrop-blur-md rounded-full shadow-inner`}>
                                    {/* animate-gradient-x drifts a highlight along the fill; the gradient
                                        is glow → colour → glow so the sweep reads as moving light. */}
                                    {/* The bloom is the accent GLOW, which is the one thing a pale page
                                        cannot show — a 12px cyan spill over #e9eef5 resolved to nothing.
                                        `emphasis` spends it the way each theme can afford: light out on
                                        the void, a seated shadow plus a saturated edge on the page. */}
                                    <div className="h-full transition-transform duration-700 ease-out origin-left [background:linear-gradient(90deg,var(--accent-glow),var(--accent-color),var(--accent-glow))] animate-gradient-x"
                                        style={{ transform: `scaleX(${progressPercent / 100})`, boxShadow: emphasis(theme, accentRGB(theme), 0.75) }} />
                                </div>
                            </div>

                            {/* Controls */}
                            {/* The two chapter steppers are icon-only, so the glyph IS the label:
                                it draws in the ink (the decorative cyan was 2.36:1, under the 3:1
                                a meaningful graphic needs) and the button carries the name. */}
                            {activeQuest.id === DEFAULT_QUEST.id && libraryLoaded ? (
                                /* Empty library: the steppers and the portal have nothing to act
                                   on (they sat there disabled at 40%), so the controls become the
                                   one thing worth doing here. */
                                <div className="flex gap-2 w-full justify-center mt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.96 }}
                                        type="button"
                                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                                        title="New gate (N)"
                                        className="h-12 flex-1 max-w-[400px] flex items-center justify-center gap-2 font-mono font-bold tracking-widest text-[12px] rounded-sm bg-accent text-accent-on cursor-pointer"
                                        style={{ boxShadow: emphasis(theme, accentRGB(theme)) }}
                                    >
                                        <Plus size={16} aria-hidden="true" /> OPEN YOUR FIRST GATE
                                    </motion.button>
                                </div>
                            ) : (
                            <div className="flex gap-2 w-full justify-center mt-2">
                                {/* Press and hold to repeat, accelerating; one save on release.
                                    A keyboard click (detail 0) never reaches the pointer handlers,
                                    so it steps here and merges with its neighbours like a tap. */}
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    {...holdPrev}
                                    onClick={(e) => { if (e.detail === 0) stepChapter(-1, 'merge'); }}
                                    type="button"
                                    aria-label="Previous chapter"
                                    title="Previous chapter (←) · hold to repeat"
                                    className={`w-14 h-12 flex-none border ${theme.isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm touch-manipulation select-none [-webkit-touch-callout:none]`}
                                    style={{ borderColor: `${theme.accentColor}33` }}
                                >
                                    <CalibratedMinusIcon size={20} color={theme.accentInk} />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEnterPortal(activeQuest.link || '#'); }}
                                    disabled={!activeQuest.link || activeQuest.link === '#'}
                                    title="Open the reading link (Enter)"
                                    /* The label takes `accent-on`, the ink chosen per theme for a solid
                                       accent fill: black on amber (9.8:1), white on violet (5.7:1). It was
                                       a fixed near-black (#241a06), right for the old amber and cyan but
                                       3.01:1 on the amethyst light accent, under AA for 12px text. The
                                       icon follows, as it draws in currentColor. */
                                    className={`h-12 flex-1 max-w-[400px] backdrop-blur-md flex items-center justify-center gap-2 transition-all font-mono font-bold tracking-widest text-[12px] group cursor-pointer rounded-sm text-accent-on disabled:opacity-40 disabled:cursor-not-allowed`}
                                    style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, boxShadow: emphasis(theme, accentRGB(theme)) }}
                                >
                                    <InfinitePortalIcon size={18} className="group-hover:rotate-12 transition-transform" /> ENTER PORTAL
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    {...holdNext}
                                    onClick={(e) => { if (e.detail === 0) stepChapter(1, 'merge'); }}
                                    type="button"
                                    aria-label="Next chapter"
                                    title="Next chapter (→) · hold to repeat"
                                    className={`w-14 h-12 flex-none border ${theme.isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm touch-manipulation select-none [-webkit-touch-callout:none]`}
                                    style={{ borderColor: `${theme.accentColor}33` }}
                                >
                                    <CalibratedPlusIcon size={20} color={theme.accentInk} />
                                </motion.button>

                            </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: SIDEBAR */}
                <div
                    id="system-sidebar"
                    className={`relative w-full flex flex-col gap-1.5 lg:gap-2 lg:min-h-0 lg:h-full order-2 mb-10 lg:mb-0 lg:transition-[width] lg:duration-500 lg:ease-out lg:overflow-visible ${sidebarCollapsed ? 'lg:w-0' : 'lg:w-80 xl:w-96'}`}
                >
                    {/* RETRACT HANDLE — a grip that rides the sidebar's own leading edge.
                        The stacked bracket-cards give the column no continuous edge of its own, so
                        a faint accent RAIL supplies one: a vertical hairline that fades out top and
                        bottom, running down the leading edge. The grip is a thumb seated on that
                        rail — centred on the exact line, same accent, translucent so the rail shows
                        through it — so it reads as part of the sidebar's edge, not a chip in the
                        gutter. The rail retires with the panel when collapsed; the grip then docks
                        flush to the viewport edge to reopen. */}
                    {!sidebarCollapsed && (
                        <div
                            aria-hidden="true"
                            className={`hidden lg:block absolute -left-2 top-12 bottom-12 w-px z-30 pointer-events-none bg-gradient-to-b from-transparent to-transparent via-accent-line`}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setSidebarCollapsed((v) => !v)}
                        aria-expanded={!sidebarCollapsed}
                        aria-controls="system-sidebar"
                        aria-label={sidebarCollapsed ? 'Expand system panel' : 'Collapse system panel'}
                        title={sidebarCollapsed ? 'Expand system panel' : 'Collapse system panel'}
                        /* Collapsed, the grip hides until hovered. A touch screen has no hover,
                           so there (hover:none) it stays faintly visible instead of vanishing
                           with no way to find it. The ::before pad widens the hit area to the
                           LEFT only: rightward it would sit over the quest rows' drag handles. */
                        className={`hidden lg:flex top-1/2 -translate-y-1/2 z-40 w-[22px] h-16 items-center justify-center border transition-[opacity,background-color,border-color,color] duration-300 cursor-pointer before:absolute before:content-[''] before:-inset-y-2 before:-left-3 before:right-0 bg-accent-surface border-accent-edge text-accent hover:bg-accent hover:border-accent hover:text-accent-on ${sidebarCollapsed ? 'fixed right-0 rounded-l-xl opacity-0 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-70' : 'absolute -left-[19px] rounded-full'}`}
                    >
                        {sidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {/* FULL PANEL — always shown below lg, where the sidebar stacks. */}
                    <div className={`contents ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                    {/* PLAYER CARD */}
                    <div className="w-full h-auto">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="px-3 py-2 flex flex-col gap-2">
                                <div className="flex flex-row items-center gap-4">
                                    <div className="relative flex-none">
                                        {/* Technical Scanning Decoration */}
                                        <div className="absolute inset-x-0 top-0 flex justify-between px-1 opacity-30">
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-[#7c3aed]' : 'bg-[#f59e0b]'}`} />
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-[#7c3aed]' : 'bg-[#f59e0b]'}`} />
                                        </div>

                                        <div className="relative p-0.5">
                                            <EntityAvatar theme={theme} size={84} />
                                            {/* accent-on, not fixed black: black on light's violet
                                                measured 3.69:1 at 7px; white on it is 5.7:1. */}
                                            <button
                                                type="button"
                                                onClick={() => setIsProfileOpen(true)}
                                                className="absolute -bottom-1 -right-2 px-1 py-0.5 bg-accent text-accent-on text-[8px] font-black font-mono tracking-tighter uppercase cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 shadow-lg z-20"
                                            >
                                                ACTIVE_PROFILE
                                            </button>
                                        </div>

                                        {/* Vertical Scan Line decoration */}
                                        <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[1px] h-8 ${theme.id === 'LIGHT' ? 'bg-[#7c3aed]' : 'bg-[#f59e0b]'} opacity-20`} />
                                    </div>

                                    <div className="flex flex-col items-start text-left flex-1 min-w-0 sm:-mt-6">
                                        <div className={`text-[10px] font-black font-mono uppercase tracking-[0.2em] mb-1 mt-0.5 opacity-90 transition-colors duration-700 whitespace-nowrap ${theme.isDark ? theme.highlightText : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>ENTITY CLASSIFICATION</div>
                                        <div className="text-3xl sm:text-4xl lg:text-2xl xl:text-4xl font-black font-manifold tracking-tight drop-shadow-sm flex items-baseline leading-normal overflow-hidden h-[1.5em] sm:h-[1.5em] lg:h-[1.8em] xl:h-[1.5em]">
                                            <span className={`inline-block pr-[6px] text-transparent bg-clip-text bg-gradient-to-r ${theme.inkGradient} transition-colors duration-700 truncate`} style={{ lineHeight: '1.2' }}>{playerRank.name}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* EXP readout. The bar is progress toward the NEXT rank — ranks are
                                    earned by titles tracked, so that is the number that moves it —
                                    and the right-hand legend says so. It was a fixed 60% before. */}
                                <div className="mt-3">
                                    <div className={`flex justify-between gap-3 text-[8px] font-mono ${theme.highlightText} mb-0.5 transition-colors duration-700 uppercase`}>
                                        <span className="truncate">EXP ACQUIRED · {totalChaptersRead} PTS</span>
                                        <span className="shrink-0">{playerRank.next ? `NEXT ${playerRank.next.label} ${playerRank.titles}/${playerRank.next.minTitles}` : 'MAX RANK'}</span>
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-label={playerRank.next ? `Progress to ${playerRank.next.label}` : 'Highest rank reached'}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.round(playerRank.progress * 100)}
                                        className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} transition-colors duration-700 overflow-hidden relative`}
                                    >
                                        <div className={`h-full w-full bg-gradient-to-r ${theme.gradient} transition-transform duration-700 origin-left`} style={{ transform: `scaleX(${playerRank.progress})`, boxShadow: emphasis(theme, accentRGB(theme), 0.6) }} />
                                    </div>
                                </div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* QUEST METRICS (Replaces Stat Box Grid) */}
                    <div className="w-full h-auto">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="px-3 py-2 flex flex-col gap-1">
                                <div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[9px] tracking-widest font-bold mb-1`}>
                                    <Activity size={11} /> <span className={theme.isDark ? '' : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}>QUEST_METRICS</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>WISDOM</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.isDark ? theme.highlightText : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`}`}>{activeQuest.currentChapter}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>CH. READ</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>MIGHT</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.isDark ? theme.highlightText : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`}`}>{Math.floor(activeQuest.totalChapters / 10)}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>PWR INDEX</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>SYNC</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.isDark ? theme.highlightText : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`}`}>{progressPercent}%</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>COMPLETION</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>GATE</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${activeQuest.status === 'CONQUERED' ? theme.mutedText : (theme.isDark ? theme.highlightText : `text-transparent bg-clip-text bg-gradient-to-b ${theme.inkGradient}`)}`}>{activeQuest.status === 'CONQUERED' ? 'CLOSED' : 'OPEN'}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>STATUS</div>
                                    </div>
                                </div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* ACTIVE QUESTS LIST - only scrollable region allowed */}
                    <div className="flex-1 flex flex-col min-h-0 gap-1 mt-2 overflow-hidden max-h-[380px] lg:max-h-none">
                        <div className={`flex items-center justify-between gap-2 border-b ${theme.borderSubtle} pb-1 mb-1 shrink-0`}>
                            <span className={`text-[10px] font-mono uppercase tracking-widest transition-colors duration-700 ${theme.isDark ? theme.headingText : `text-transparent bg-clip-text bg-gradient-to-r ${theme.labelGradient}`}`}>ACTIVE QUESTS</span>
                            {/* Search used to be the "/" key alone, so a phone had no way in.
                                Same action: the Spire opens on its search field. */}
                            <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => { setSpireStartInSearch(true); setIsSpireOpen(true); }}
                                title="Search the library (/)"
                                aria-label="Search the library"
                                className={`h-6 w-7 -my-1 flex items-center justify-center ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}
                            >
                                <Search size={12} aria-hidden="true" />
                            </button>
                            {/* Asks the chapter tracker about this library now; the hourly job
                                does the owner's archive anyway. Results land as "+N NEW". */}
                            <button
                                type="button"
                                onClick={checkNewChapters}
                                disabled={chapterCheckBusy || activeQuest.id === DEFAULT_QUEST.id}
                                title="Check for new chapters"
                                className={`h-6 -my-1 px-1.5 flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-widest uppercase ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors disabled:opacity-50 disabled:cursor-wait`}
                            >
                                <RefreshCw size={11} aria-hidden="true" className={chapterCheckBusy ? 'animate-spin' : ''} />
                                New chapters
                            </button>
                            </div>
                        </div>
                        <ActiveQuestList
                            orderedActiveQuests={orderedActiveQuests}
                            handleReorderActiveQuests={handleReorderActiveQuests}
                            theme={theme}
                            activeId={activeId}
                            handleLogClick={handleLogClick}
                            loaded={libraryLoaded && orderedActiveQuests.length === activeQuests.length}
                        />
                    </div>

                    {/* DIVINE SPIRE BUTTON. Light: an opaque pale-sky plate. The 10% sky wash it had
                        composited darker over the bottom of the page gradient and left the ink at 4.37:1. */}
                    <button aria-label="Open Divine Spire" onClick={() => { setIsSpireOpen(true); }} className={`mt-auto hidden lg:flex w-full h-12 ${theme.isDark ? 'bg-white/5' : 'bg-[#ece4f7]/90'} border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-[#f59e0b] hover:text-black' : 'hover:bg-[#5b21b6] hover:text-[#fcfaff]'} font-mono font-bold tracking-widest uppercase transition-all items-center justify-center gap-2 text-[12px] shrink-0 shadow-sm cursor-pointer duration-700`}><LayoutTemplate size={16} /> DIVINE SPIRE</button>
                    </div>{/* end full panel */}
                </div>
            </div>
        </main>
        // currentTheme and userState were listed but never read in this block, so they only
        // forced needless recomputation. (activeQuests is read: the list's empty message
        // waits for the ordered copy to catch up with it.) effectsPaused IS read (the
        // hero rings, sigil and dais hold still on it), and it only changes on an explicit
        // open/close or a low-power toggle, so recomputing then is correct, not wasteful.
    ), [theme, activeQuest, progressPercent, activeId, handleLogClick, orderedActiveQuests, handleReorderActiveQuests, totalChaptersRead, playerRank, stepChapter, commitTypedChapter, holdPrev, holdNext, checkNewChapters, chapterCheckBusy, handleEnterPortal, effectsPaused, libraryLoaded, activeQuests, sidebarCollapsed, holoEdge, holoSoft]);

    if (booting) return <BootScreen onComplete={finishBooting} theme={theme} />;

    if (!isAuth) return (
        <>
            <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} onToggleTheme={toggleTheme} isMobile={isMobile} />
            {/* Rendered here as well: session expiry flips straight to this branch, so the
                flash has to live in whichever tree is on screen when it fires. */}
            <GlitchOverlay isActive={glitchActive} onComplete={endGlitch} />
        </>
    );

    return (
        <div 
            id="main-scroll-area" 
            className={`relative h-[100dvh] overflow-hidden ${theme.appBg} ${theme.baseText} font-sans selection:bg-accent-wash transition-colors duration-700 ease-in-out`}
            /* The accent variables (--accent-color, --accent-ink, …) are set on :root from
               src/core/tokens.ts; see the layout effect near the top of App. Two accents,
               deliberately: --accent-color and its derivatives are decorative (fills, glows),
               --accent-ink is structural, for anything a reader has to read. */
        >
            {/* Paused whenever a full-screen view covers it. It used to pause only for the
                gate modal, so it kept animating behind the Detail, Profile and Spire — and the
                Profile mounts its own particle field, so two canvases ran at once. */}
            <BackgroundController
                theme={theme}
                isPaused={overlayOpen}
                isMobile={isMobile}
                lowPower={lowPower}
            />
            {/* Edge falloff. Neutral black suits the void; on the light page the same 20%
                black dragged every edge to grey, which is both the "grime" the depth system
                warns about and a contrast loss for everything laid near an edge — the sidebar,
                the Spire's HUD wings. Light takes the gentle cool falloff HunterProfile uses. */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={theme.isDark
                    ? { background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.4) 100%)', opacity: 0.5 }
                    : { background: 'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.07) 0%, transparent 42%), radial-gradient(circle, transparent 48%, rgba(40,26,60,0.16) 100%)' }}
            />

            {/* HEADER */}
            {!isSpireOpen && memoizedHeader}

            {/* MAIN GRID */}
            {!isSpireOpen && memoizedMain}

            {/* DASHBOARD CONSOLE */}
            {!isSpireOpen &&
                !isModalOpen &&
                !isProfileOpen &&
                !isDetailOpen && (
                    <SystemConsole theme={theme} onShowShortcuts={showShortcuts} />
                )}

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isProfileOpen && (
                    <HunterProfile
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        theme={theme}
                        items={library}
                        playerRank={playerRank}
                        onImport={handleImportQuests}
                        onRefresh={fetchInitialData}
                        onLogout={handleLogout}
                        showNotification={showSystemNotification}
                        onRestoreQuest={restoreQuest}
                        lowPower={lowPower}
                        onToggleLowPower={toggleLowPower}
                        onSelectManhwa={(id) => {
                            detailOpenedFromProfile.current = true;
                            setIsProfileOpen(false);
                            handleViewDetails(id);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isDetailOpen && (
                    <ManhwaDetail
                        isOpen={isDetailOpen}
                        onClose={() => {
                            setIsDetailOpen(false);
                            if (detailOpenedFromProfile.current) {
                                detailOpenedFromProfile.current = false;
                                setIsProfileOpen(true);
                            }
                        }}
                        quest={selectedQuest}
                        theme={theme}
                        allQuests={library}
                        onSetActive={handleSetActiveQuest}
                        onUpdate={async (id, data) => handleSave({ id, ...data })}
                        onEdit={(q) => {
                            setEditingItem(q);
                            setIsModalOpen(true);
                            // Keep detail open to maintain context
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={<HeavyLoader theme={theme} />}>
                {isSpireOpen && (
                    <div className="fixed inset-0 z-[200]">
                        <DivineSpire
                            isOpen={isSpireOpen}
                            onClose={() => { setIsSpireOpen(false); setSpireStartInSearch(false); }}
                            startInSearch={spireStartInSearch}
                            theme={theme}
                            items={spireItems}
                            onActivate={handleActivate}
                            itemsPerFloor={ITEMS_PER_FLOOR}
                            playerRank={playerRank}
                            streak={userState.streak}
                            dailyAbsorbed={userState.dailyAbsorbed}
                        />
                    </div>
                )}
            </Suspense>


            <Suspense fallback={null}>
                <AnimatePresence>
                    {isModalOpen && (
                        <SystemGateModal
                            isOpen={isModalOpen}
                            onClose={() => setIsModalOpen(false)}
                            onSave={handleSave}
                            onDelete={deleteQuest}
                            initialData={editingItem}
                            theme={theme}
                            existingQuests={library}
                        />
                    )}
                </AnimatePresence>
            </Suspense>


            {/* HUD / SYSTEM OVERLAYS (HOLOGRAPHIC) */}
            {!isSpireOpen &&
                !isModalOpen &&
                !isProfileOpen &&
                !isDetailOpen && (
                    <AnimatePresence>
                        {isHUDVisible && (
                            <div className="lg:hidden fixed bottom-6 left-0 w-full px-5 z-[80] pointer-events-none pb-[env(safe-area-inset-bottom)] flex justify-end">
                                {!isMobileHudExpanded ? (
                                    <motion.button
                                        key="fab-button"
                                        type="button"
                                        aria-label="Open system menu"
                                        aria-expanded={false}
                                        layoutId="mobile-hud-wrapper"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                                        style={{ originX: 1, originY: 1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsMobileHudExpanded(true)}
                                        className="relative pointer-events-auto w-20 h-20 flex items-center justify-center"
                                    >
                                        <SystemCompass theme={theme} />
                                    </motion.button>
                                ) : (
                                    <motion.div
                                        key="hud-grid"
                                        layoutId="mobile-hud-wrapper"
                                        initial={{ scale: 0.6, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.6, opacity: 0 }}
                                        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                                        style={{ originX: 1, originY: 1 }}
                                        className="pointer-events-auto w-full isolate flex items-end gap-2"
                                    >
                                        {/* These plates are dark in BOTH themes — a HUD terminal, like
                                            the compass face — so on light their text cannot take the
                                            page ink (#155e75 on this near-black teal is ~2:1). Fixed
                                            pale cyan there instead; dark keeps its amber. */}
                                        {/* ── DIVINE SPIRE ── */}
                                        <motion.button
                                            type="button"
                                            aria-label="Open Divine Spire"
                                            onClick={() => { setIsSpireOpen(true); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.96 }}
                                            className="relative flex-1 h-16 overflow-hidden backdrop-blur-md"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(16,8,26,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(168,85,247,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 20px rgba(245,158,11,0.12), inset 0 0 30px rgba(245,158,11,0.04)'
                                                    : '0 0 20px rgba(168,85,247,0.12), inset 0 0 30px rgba(168,85,247,0.04)',
                                            }}
                                        >
                                            {/* Bracket corners — four tiny fixed SVGs, no calc() needed */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(168,85,247,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(168,85,247,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'} strokeWidth="1.5" /></svg>
                                            {/* Scanline overlay */}
                                            <div className="absolute inset-0 pointer-events-none opacity-40"
                                                style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(168,85,247,0.04)'} 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(168,85,247,0.04)'} 4px)` }}
                                            />
                                            {/* Sweep line animation */}
                                            <motion.div
                                                className="absolute left-0 right-0 h-[1px] pointer-events-none bg-[var(--accent-glow)]"
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            />
                                            {/* Content */}
                                            <div className="relative z-10 h-full flex items-center gap-3 px-4">
                                                <LayoutTemplate size={20} className={`shrink-0 ${hudInk} drop-shadow-[0_0_8px_currentColor]`} />
                                                <div className="flex flex-col items-start leading-none min-w-0">
                                                    <span className={`font-mono text-[8px] tracking-[0.25em] uppercase ${hudInk} opacity-80 mb-1`}>TERMINAL.EXECUTE</span>
                                                    <span className={`font-orbitron font-black text-[11px] tracking-[0.2em] uppercase ${hudInk} drop-shadow-[0_0_6px_currentColor]`}>DIVINE_SPIRE</span>
                                                </div>
                                            </div>
                                        </motion.button>

                                        {/* ── ENTER PORTAL ── */}
                                        <motion.button
                                            type="button"
                                            aria-label="Enter portal"
                                            disabled={!activeQuest.link || activeQuest.link === '#'}
                                            onClick={() => { handleEnterPortal(activeQuest.link || '#'); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.94 }}
                                            className="relative w-16 h-16 overflow-hidden backdrop-blur-md flex flex-col items-center justify-center gap-1 disabled:opacity-40"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(16,8,26,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(168,85,247,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 16px rgba(245,158,11,0.15)'
                                                    : '0 0 16px rgba(168,85,247,0.15)',
                                            }}
                                        >
                                            {/* Bracket corners */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(168,85,247,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(168,85,247,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'} strokeWidth="1.5" /></svg>
                                            <ExternalLink size={20} strokeWidth={2} className={`${hudInk} drop-shadow-[0_0_8px_currentColor]`} aria-hidden="true" />
                                            <span className={`font-mono text-[6px] tracking-[0.15em] ${hudInk} uppercase`} aria-hidden="true">PORTAL</span>
                                        </motion.button>

                                        {/* ── CLOSE / COLLAPSE ── */}
                                        <motion.button
                                            type="button"
                                            aria-label="Close system menu"
                                            onClick={() => setIsMobileHudExpanded(false)}
                                            whileTap={{ scale: 0.94 }}
                                            className="relative w-16 h-16 overflow-hidden backdrop-blur-md flex flex-col items-center justify-center gap-1"
                                            style={{
                                                background: 'rgba(10,2,2,0.88)',
                                                border: '1px solid rgba(239,68,68,0.45)',
                                                boxShadow: '0 0 16px rgba(239,68,68,0.12)',
                                            }}
                                        >
                                            {/* Bracket corners — red tint */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="1.5" /></svg>
                                            <X size={20} strokeWidth={2} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" aria-hidden="true" />
                                            {/* red-400 at full strength: red-500 at 70% was 3.0:1 on this plate. */}
                                            <span className="font-mono text-[6px] tracking-[0.15em] text-red-400 uppercase" aria-hidden="true">CLOSE</span>
                                        </motion.button>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </AnimatePresence>
                )}





            <SystemNotification
                isOpen={sysNote.isOpen}
                message={sysNote.message}
                type={sysNote.type}
                confirm={sysNote.confirm}
                onClose={handleSysNoteClose}
                theme={theme}
            />

            <SystemToast toast={toast} onDismiss={dismissToast} theme={theme} />

            <GlitchOverlay isActive={glitchActive} onComplete={endGlitch} />
        </div>
    );
};

export default App;
