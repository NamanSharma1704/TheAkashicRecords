import React, { useState, useEffect, useMemo, Suspense, lazy, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Quest } from './types';
import SystemFrame from '../components/system/SystemFrame';
import SystemLogo from '../components/system/SystemLogo';
import ScrambleText from '../components/system/ScrambleText';
import { Activity, ExternalLink, Sun, Moon, Plus, Zap, Crown, X, LayoutTemplate, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPlayerRank, getThemedRankStyle, calculateQuestRank } from '../utils/ranks';
import { THEMES, ITEMS_PER_FLOOR, ThemeId } from './constants';

import SystemConsole from '../components/system/SystemConsole';
import BootScreen from '../components/system/BootScreen';
import BackgroundController from '../components/fx/BackgroundController';
import EntityAvatar from '../components/system/EntityAvatar';
import SystemNotification from '../components/system/SystemNotification';
import SystemCompass from '../components/system/SystemCompass';
// Statically imported on purpose: the wrapper is tiny and defers its own `three`
// import to idle, so a lazy boundary here would only put a Suspense hole over the hero.
import HoloDais from '../components/dais/HoloDais';
import Card3D from '../components/quest/Card3D';
import { accentRGB, elevation, emphasis } from './depth';
import { InfinitePortalIcon, CalibratedPlusIcon, CalibratedMinusIcon } from '../components/system/CustomIcons';

import { getProxiedImageUrl, unproxyImageUrl } from '../utils/api';
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
    synopsis: q.synopsis || "",
    currentChapter: Number(q.currentChapter) || 0,
    totalChapters: Number(q.totalChapters) || 0,
    status: (q.status || 'ACTIVE').toUpperCase(),
    classType: q.classType || "PLAYER",
    lastUpdated: q.lastRead || q.lastUpdated || Date.now()
});

// SUB-COMPONENT: QuestListItem to handle individual drag controls and touch scrolling
const QuestListItem = ({ item, theme, activeId, handleLogClick, onDragStateChange }: any) => {
    const dragControls = useDragControls();
    const isHighlighted = activeId === item.id;
    const [thumbError, setThumbError] = React.useState(false);

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
            onClick={() => handleLogClick(item.id)}
            className={`relative group cursor-pointer border py-1.5 px-3 transition-colors duration-200 ${isHighlighted ? `${theme.border} ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/5'}` : `border-transparent hover:${theme.borderSubtle} bg-transparent`}`}
        >
            <div className="flex justify-between items-center h-full">
                <div className="flex items-center gap-2 max-w-[85%] min-w-0">
                    {/* Drag Handle — always visible on touch (mobile/tablet), hover-only on desktop */}
                    <div
                        className={`cursor-grab active:cursor-grabbing flex-none touch-none select-none ${theme.baseText}
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

                    {item.coverUrl && (
                        <div className={`w-8 h-[45px] xl:w-10 xl:h-[56px] flex-none rounded-sm border ${theme.isDark ? 'border-gray-800' : 'border-gray-300'} bg-black overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity shadow-sm shrink-0`}>
                            {!thumbError ? (
                                <img
                                    key={item.coverUrl}
                                    src={getProxiedImageUrl(item.coverUrl)}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                    loading="eager"
                                    onError={() => setThumbError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                    <span className="text-[6px] text-gray-600 font-mono uppercase">N/A</span>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className={`font-bold font-mono text-[11px] leading-tight ${isHighlighted ? theme.highlightText : `${theme.mutedText} group-hover:${theme.headingText}`} transition-colors duration-700 uppercase line-clamp-2`}>{item.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-1 h-1 rounded-full flex-none ${item.status === 'ACTIVE' ? (theme.isDark ? 'bg-amber-400' : 'bg-cyan-500') : 'bg-gray-400'}`} />
                            <span className={`text-[9px] ${theme.mutedText} uppercase font-mono tracking-widest transition-colors duration-700 truncate`}>{item.status}</span>
                        </div>
                    </div>
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
const ActiveQuestList = ({ orderedActiveQuests, handleReorderActiveQuests, theme, activeId, handleLogClick }: any) => {
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragStateChange = React.useCallback((dragging: boolean) => {
        setIsDragging(dragging);
    }, []);

    return (
        <div
            className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar overscroll-contain ${isDragging ? 'touch-none' : 'touch-pan-y'}`}
        >
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
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className={`w-16 h-16 border-2 border-dashed ${theme.id === 'LIGHT' ? 'border-sky-500' : 'border-amber-500'} rounded-full animate-spin`} />
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
    // impression, not a toll booth on every reload. (This is also reused as a full-screen
    // loader during CSV import via setBooting(true); that path is unaffected.)
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

    const [library, setLibrary] = useState<Quest[]>([]);
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
                win.document.write(buildPortalLoader(target.href, theme.accentColor, theme.isDark ? '#fbbf24' : '#67e8f9'));
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

    const showSystemNotification = (message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', confirm: boolean = false): Promise<boolean> => {
        return new Promise((resolve) => {
            setSysNote({ isOpen: true, message, type, confirm, resolve });
        });
    };

    const handleSysNoteClose = (result: boolean) => {
        if (sysNote.resolve) sysNote.resolve(result);
        setSysNote(prev => ({ ...prev, isOpen: false }));
    };

    const handleLoginSuccess = (auth: AuthResponse) => {
        // The session cookie is already set by the server; this only records display state.
        saveAuthData(auth);
        setIsAuth(true);
        // Data fetching will be triggered by useEffect
    };

    const handleLogout = async () => {
        const confirmed = await showSystemNotification("TERMINATE_SESSION: Are you sure?", "WARNING", true);
        if (confirmed) {
            await performLogout();
            setIsAuth(false);
            setLibrary([]);
        }
    };

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
                    showSystemNotification("SYSTEM_ALERT: Portal destabilizing. 1 minute remaining.", "WARNING");
                } else if (remaining <= 300000 && remaining > 290000) {
                    showSystemNotification("SYSTEM_ALERT: Connection failing. 5 minutes remaining.", "WARNING");
                }

                if (remaining <= 0) {
                    performLogout().then(() => {
                        setIsAuth(false);
                        setLibrary([]);
                        showSystemNotification("PROTOCOL_COMPLETE: Trial experience expired. Data purged.", "INFO");
                    });
                }
            };

            checkSession();
            const timer = setInterval(checkSession, 10000); // Check every 10s
            return () => clearInterval(timer);
        }
    }, [isAuth]);

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

    const handleViewDetails = (id: string) => {
        const item = library.find(q => q.id === id);
        if (item) {
            setSelectedQuest(item);
            setIsDetailOpen(true);
        }
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
            // Fallback to empty state to prevent UI crash
            setLibrary([]);
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

    // Separate Rank Logic for User
    const playerRank = useMemo(() => {
        const rawPlayerRank = getPlayerRank(library.length);
        const rankStyle = getThemedRankStyle(currentTheme, rawPlayerRank.label === 'Sovereign' || rawPlayerRank.label === 'Eclipse' || rawPlayerRank.label === 'Monarch');
        return { ...rawPlayerRank, name: rawPlayerRank.label, style: rankStyle };
    }, [library.length, currentTheme]);

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
        if (item) {
            setSelectedQuest(item);
            setIsDetailOpen(true);
        }
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
            const updated = await res.json();
            const mappedUpdated = mapQuest(updated);
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            console.error("Update failed", e);
        }
    }, []);

    const handleSetActiveQuest = async (id: string) => {
        setActiveId(id);
        const now = Date.now();
        // OPTIMISTIC UPDATE
        setLibrary(prev => prev.map(item => item.id === id ? { ...item, status: 'ACTIVE', lastUpdated: new Date(now).toISOString() } : item));

        try {
            const res = await systemFetch(`${API_URL}/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'ACTIVE', lastRead: now })
            });
            const updated = await res.json();
            const mappedUpdated = mapQuest(updated);
            setLibrary(prev => prev.map(item => item.id === id ? mappedUpdated : item));
        } catch (e) {
            console.error("Set active failed", e);
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

        // 2. OPTIMISTIC UPDATE — close modal & update UI instantly, sync in background
        const tempId = `optimistic-${Date.now()}`;
        const optimisticItem: Quest = {
            ...(data as Quest),
            id: isEditing ? targetId! : tempId,
            lastUpdated: new Date().toISOString(),
        };

        if (isEditing) {
            setLibrary(prev => prev.map(q => q.id === targetId ? optimisticItem : q));
            if (selectedQuest?.id === targetId) setSelectedQuest(optimisticItem);
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
                setLibrary(prev => prev.map(q => q.id === targetId ? (editingItem || q) : q));
            } else {
                setLibrary(prev => prev.filter(q => q.id !== tempId));
            }
            showSystemNotification(`SYNC_FAILED: ${e.message}`, 'ERROR');
        }
    };

    const handleImportQuests = async (newItems: Quest[]) => {
        setBooting(true);
        let count = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const item of newItems) {
            try {
                const existing = library.find(q => q.title.toLowerCase().trim() === item.title.toLowerCase().trim());

                if (existing) {
                    // SMART MERGE: Only update if the CSV progress is ahead or equal
                    const shouldUpdate = item.totalChapters >= existing.totalChapters;

                    if (shouldUpdate) {
                        const { id: _, ...data } = item;
                        await handleSave({ ...data, id: existing.id });
                        updatedCount++;
                    } else {
                        skippedCount++;
                        console.log(`[Import] Skipping outdated record: ${item.title} (CSV: ${item.totalChapters} < Library: ${existing.totalChapters})`);
                    }
                } else {
                    const { id: _, ...data } = item;
                    await handleSave(data);
                    count++;
                }
            } catch (e) {
                console.error(`[Import] Failed to process: ${item.title}`, e);
            }
        }
        await fetchInitialData();
        setBooting(false);
        showSystemNotification(`Archive Reputed. ${count} New Origins Formed. ${updatedCount} Records Enhanced. ${skippedCount} Outdated Clusters Ignored.`, 'SUCCESS');
    };

    const updateProgress = useCallback(async (amt: number) => {
        if (!activeQuest.id) return;
        const next = activeQuest.totalChapters > 0
            ? Math.min(Math.max(0, activeQuest.currentChapter + amt), activeQuest.totalChapters)
            : Math.max(0, activeQuest.currentChapter + amt);

        // OPTIMISTIC UPDATE: Zero-Latency
        setLibrary(prev => prev.map(q => q.id === activeId ? { ...q, currentChapter: next } : q));

        try {
            const res = await systemFetch(`${API_URL}/${activeId}`, {
                method: 'PUT',
                body: JSON.stringify({ currentChapter: next, lastUpdated: new Date().toISOString() })
            });
            const updated = await res.json();
            setLibrary(prev => prev.map(q => q.id === activeId ? mapQuest(updated) : q));

            // The PUT response is the authoritative updated quest and has already been
            // merged above, so there is nothing left to reconcile. This used to schedule
            // a full fetchInitialData() 500ms after every increment, re-pulling the whole
            // library on each chapter click. Streak and daily-absorbed counters are the
            // only other state the server touches here, so refresh just those.
            refreshUserState().catch(console.error);
        } catch (e) {
            console.error("Progress update failed", e);
        }
    }, [activeQuest, activeId, refreshUserState]);

    const deleteQuest = async () => {
        if (editingItem) {
            const confirmed = await showSystemNotification(`PURGE ARTIFACT "${editingItem.title}"?`, 'WARNING', true);
            if (!confirmed) return;

            try {
                await systemFetch(`${API_URL}/${editingItem.id}`, { method: 'DELETE' });
                setLibrary(prev => prev.filter(i => i.id !== editingItem.id));
                setIsModalOpen(false);
                // A purge is irreversible; the glitch marks it as such.
                setGlitchActive(true);
            } catch (e) {
                console.error("Deletion failure", e);
                showSystemNotification("PURGE_PROTOCOL_FAILED. ARCHIVE CORE STABLE.", "ERROR");
            }
        }
    };
    // useCallback so the memoised header can list it as a dependency without being
    // rebuilt on every render. Its only input is currentTheme, which the header already
    // depends on, so this changes nothing about when the header recomputes.
    // Stable identity so BootScreen's timeline effect is not re-created on every render.
    const finishBooting = useCallback(() => setBooting(false), []);

    const toggleTheme = useCallback(() => {
        const next: ThemeId = currentTheme === 'LIGHT' ? 'DARK' : 'LIGHT';
        setCurrentTheme(next);
        try {
            localStorage.setItem('akashic_theme', next);
        } catch {
            // Non-fatal: the palette still applies for this session.
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
                    className="fixed top-0 w-full z-40 bg-transparent h-16 px-4 flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <SystemLogo theme={theme} className="w-full h-full" />
                        </div>
                        <div className="flex flex-col leading-none">
                            <div className="flex gap-2 items-baseline">
                                <span className={`font-mono text-[10px] tracking-[0.2em] ${theme.headingText} font-bold transition-colors duration-700`}>SYSTEM.ROOT</span>
                            </div>
                            <ScrambleText
                                text="AKASHIC"
                                className="font-orbitron text-lg tracking-[0.3em] font-bold drop-shadow-sm transition-colors duration-700"
                                animatedGradient={true}
                                gradientColors={currentTheme === 'LIGHT' ? "from-sky-500 to-cyan-500" : "from-amber-600 via-yellow-400 to-white"}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {guestTimeLeft !== null && (
                            <div className="flex flex-col items-end leading-none mr-2">
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
                        <button onClick={toggleTheme} className={`w-8 h-8 flex items-center justify-center border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded transition-colors duration-700`}>
                            {currentTheme === 'LIGHT' ? <Sun size={14} className="text-sky-600 transition-colors duration-700" /> : <Moon size={14} className="text-amber-400 transition-colors duration-700" />}
                        </button>
                        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className={`hidden lg:flex px-4 py-1.5 border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors duration-700 font-mono text-[10px] tracking-widest items-center gap-2 cursor-pointer`}>
                            <Plus size={12} /> CREATE_GATE
                        </button>
                    </div>
                </motion.header>
            )}
        </AnimatePresence>
    ), [theme, currentTheme, isHeaderVisible, guestTimeLeft, toggleTheme]);

    // Track hero cover image error state — reset whenever the active quest changes
    const [coverImgError, setCoverImgError] = React.useState(false);

    /** True while any full-screen view covers the dashboard. Both the background field
     *  and the hero dais stop their loops on this rather than rendering behind an overlay. */
    const overlayOpen = isModalOpen || isDetailOpen || isProfileOpen || isSpireOpen;

    /**
     * The card's chrome is white/grey, not the accent.
     *
     * The card IS the projection, so its edges belong to the same light as the
     * platform underneath rather than to the HUD around it. Hue-free in both themes;
     * only the value flips, because white on the light page would be invisible.
     */
    const holoEdge = theme.isDark ? '#ffffff' : '#5a6673';
    const holoSoft = theme.isDark ? '#d8d8de' : '#8d95a1';

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
    useEffect(() => { setCoverImgError(false); }, [activeId]);

    const memoizedMain = useMemo(() => (
        <main id="content-scroll"
            className="relative mt-16 h-[calc(100dvh-104px)] lg:h-[calc(100dvh-100px)] overflow-y-auto lg:overflow-hidden overflow-x-hidden hide-scrollbar px-4 pb-6 lg:pb-2 z-10 flex flex-col">
            <div className={`w-full max-w-[1400px] flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 pt-2 lg:pt-2 pb-0 ${sidebarCollapsed ? 'lg:mx-auto' : 'lg:ml-auto'}`}>
                {/* LEFT COLUMN: HERO CANVAS */}
                <div className="flex-none lg:flex-1 flex flex-col lg:h-full order-1 overflow-visible relative">
                    <div className="relative z-10 w-full h-full flex flex-col px-4 md:px-6 lg:px-8 justify-between gap-4 overflow-visible pt-8">

                        {/* CENTER: The 3-Column Display (Enhanced Gaps for Tablets) */}
                        <div className="flex-1 min-h-0 flex justify-center items-center gap-4 md:gap-14 lg:gap-6 xl:gap-12 w-full max-w-[1400px] mx-auto px-4">

                            {/* Left Column: Rank & Class — justify-center+self-stretch centers against cover */}
                            <div className="hidden md:flex flex-col items-end justify-center self-stretch flex-1 basis-0 min-w-0 shrink">
                                <div className="flex flex-col items-end gap-6 xl:gap-8 w-full -mt-[30px]">
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-2 flex items-center justify-end gap-1.5`}>
                                            <Crown size={10} style={{ color: theme.accentInk }} />
                                            <span style={{ marginRight: '-0.3em' }}>RANK ASSESSMENT</span>
                                        </div>
                                        <div className="text-6xl xl:text-[80px] font-black font-orbitron leading-none transition-colors duration-700 text-right text-[var(--accent-ink)] [filter:drop-shadow(0_0_25px_var(--accent-glow))]">
                                            {calculateQuestRank(activeQuest)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end w-max max-w-none">
                                        <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-1 text-right w-full`}>CLASSIFICATION</div>
                                        <div className={`text-base lg:text-lg xl:text-2xl font-black font-orbitron tracking-wider whitespace-nowrap text-right transition-colors duration-700 text-[var(--accent-ink)]`}>{activeQuest.classType || 'UNKNOWN'}</div>
                                    </div>
                                </div>
                            </div>

                            <div
                                onDoubleClick={() => { setEditingItem(activeQuest); setIsModalOpen(true); }}
                                onClick={() => {
                                    const now = Date.now();
                                    if (now - lastCoverTap.current < 300) {
                                        setEditingItem(activeQuest);
                                        setIsModalOpen(true);
                                    }
                                    lastCoverTap.current = now;
                                }}
                                className="relative flex-none h-full min-h-0 min-w-0 w-[min(85vw,320px)] md:w-full md:max-w-[45%] lg:w-auto lg:max-h-[49vh] aspect-[72/103] self-center flex items-center justify-center transition-all duration-700 ease-out transform-gpu hover:-translate-y-2 perspective-[1000px] group cursor-pointer"
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
                                    '--card-mat': theme.isDark ? 'rgba(255,255,255,0.07)' : '#c6d0de',
                                    '--card-rest': `0 0 0 10px var(--card-mat), ${elevation(theme, 2)}`,
                                    '--card-raised': `0 0 0 10px var(--card-mat), ${elevation(theme, 3)}`,
                                } as React.CSSProperties}
                            >

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
                                    glowing in the empty gap instead of on the emitter. */}
                                <div
                                    className={`absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[30%] md:translate-y-[35%] [@media(min-width:768px)_and_(min-height:1000px)]:translate-y-[37%] w-[170%] h-[150%] pointer-events-none z-0 opacity-100 transition-opacity duration-700 ${theme.isDark ? 'mix-blend-screen' : ''}`}
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
                                            : 'radial-gradient(ellipse 30% 40% at 50% 66%, rgba(45,58,78,0.72) 0%, rgba(45,58,78,0.50) 40%, rgba(45,58,78,0) 78%),'
                                              + 'radial-gradient(ellipse 64% 52% at 50% 66%, rgba(45,58,78,0.42) 0%, rgba(45,58,78,0.20) 34%, rgba(45,58,78,0) 62%)',
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
                                    paused={overlayOpen}
                                    /* Narrower on a phone: the card is nearly the whole
                                       screen there, so 190% of it overflowed the viewport. */
                                    className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[26%] w-[118%] aspect-[5/1] z-0 md:translate-y-[56%] md:w-[195%] [@media(min-width:768px)_and_(min-height:1000px)]:translate-y-[68%]"
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
                                <Card3D className="relative -top-5 lg:-top-[7.4vh] w-full h-full card-plate">

                                    {/* Corner Reticles (External Floating Targeting Geometry) */}
                                    <div className="absolute -top-[16px] -left-[16px] w-8 h-8 border-t-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}${theme.isDark ? 'cc' : '88'})` }} />
                                    <div className="absolute -top-[16px] -right-[16px] w-8 h-8 border-t-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}${theme.isDark ? 'cc' : '88'})` }} />
                                    <div className="absolute -bottom-[16px] -left-[16px] w-8 h-8 border-b-[2px] border-l-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}${theme.isDark ? 'cc' : '88'})` }} />
                                    <div className="absolute -bottom-[16px] -right-[16px] w-8 h-8 border-b-[2px] border-r-[2px] z-30 pointer-events-none opacity-80 transition-colors duration-700" style={{ borderColor: holoEdge, filter: `drop-shadow(0 0 5px ${holoEdge}${theme.isDark ? 'cc' : '88'})` }} />

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
                                        {/* key=activeQuest.id forces a fresh <img> DOM node on quest change,
                                            clearing any stale onError state from the previous entry. */}
                                        {!coverImgError ? (
                                            <img
                                                key={activeQuest.id}
                                                src={getProxiedImageUrl(activeQuest.coverUrl)}
                                                alt={activeQuest.title}
                                                className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110"
                                                referrerPolicy="no-referrer"
                                                loading="eager"

                                                onError={() => setCoverImgError(true)}
                                            />
                                        ) : (
                                            /* Fallback placeholder — shown when proxy/CDN fails */
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-900 to-black">
                                                <span className="text-2xl opacity-20">📖</span>
                                                <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Cover Unavailable</span>
                                            </div>
                                        )}

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
                                    <div className={`text-[10px] font-mono ${theme.mutedText} tracking-[0.3em] uppercase mb-1`}>SEQUENCE DATA</div>
                                    <div className={`text-5xl xl:text-[70px] font-black font-mono tabular-nums leading-none text-left transition-colors duration-700 text-[var(--accent-ink)]`}>
                                        {String(activeQuest.currentChapter).padStart(3, '0')}
                                    </div>
                                    <div className={`text-[11px] font-mono tracking-widest mt-2 ${theme.mutedText}`}>
                                        OF <span className={`font-bold`} style={{ color: theme.accentInk }}>{activeQuest.totalChapters}</span> CHAPTERS
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

                        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 shrink-0 pointer-events-auto">
                            {/* Title — overflow-visible to prevent last character clipping */}
                            <div className="text-center flex flex-col items-center justify-end px-6 w-full min-h-[3rem] sm:min-h-[4rem] xl:min-h-[5rem] overflow-visible">
                                <h1
                                    className={`${activeQuest.title.length > 42 ? 'text-base sm:text-lg xl:text-2xl' : activeQuest.title.length > 25 ? 'text-xl sm:text-2xl xl:text-3xl' : 'text-2xl sm:text-3xl xl:text-4xl'} font-black font-orbitron tracking-tighter text-transparent bg-clip-text uppercase leading-[1.15] line-clamp-2 w-full`}
                                    style={{
                                        backgroundImage: `linear-gradient(90deg, ${theme.accentColor}cc, ${theme.accentColor}, ${theme.accentColor}cc)`,
                                        textTransform: 'uppercase',
                                        paddingBottom: '0.1em', // prevents descender clipping
                                    }}
                                >
                                    {activeQuest.title}
                                </h1>
                            </div>

                            {/* Progress */}
                            <div className="space-y-1.5 max-w-3xl w-full mx-auto">
                                <div className={`flex justify-between text-[11px] sm:text-xs font-mono font-bold tracking-widest drop-shadow-md`}>
                                    <span className={`flex items-center gap-1.5 ${theme.headingText}`}><Zap size={14} style={{ color: theme.accentInk }} /> COMPLETION_RATE</span>
                                    <span style={{ color: theme.accentInk }}>{progressPercent}%</span>
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
                            <div className="flex gap-2 w-full justify-center mt-2">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateProgress(-1)}
                                    className={`w-14 h-12 flex-none border ${theme.isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm`}
                                    style={{ borderColor: `${theme.accentColor}33` }}
                                >
                                    <CalibratedMinusIcon size={20} color={theme.accentColor} />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEnterPortal(activeQuest.link || '#'); }}
                                    disabled={!activeQuest.link || activeQuest.link === '#'}
                                    /* Near-black on the fill, not white. Both accents are mid-luminance
                                       brights — white measured 2.43:1 on the cyan and 2.15:1 on the
                                       amber, so the primary CTA failed in BOTH themes. Slate-900 reads
                                       8.29:1 on amber and 7.33:1 on cyan, and the icon follows because
                                       it draws in currentColor. `drop-shadow-md` went with the white:
                                       a dark shadow under dark text only muddies it. */
                                    className={`h-12 flex-1 max-w-[400px] backdrop-blur-md flex items-center justify-center gap-2 transition-all font-mono font-bold tracking-widest text-[12px] group cursor-pointer rounded-sm text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed`}
                                    style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, boxShadow: emphasis(theme, accentRGB(theme)) }}
                                >
                                    <InfinitePortalIcon size={18} className="group-hover:rotate-12 transition-transform" /> ENTER PORTAL
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => updateProgress(1)}
                                    className={`w-14 h-12 flex-none border ${theme.isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'} flex items-center justify-center transition-colors cursor-pointer rounded-sm`}
                                    style={{ borderColor: `${theme.accentColor}33` }}
                                >
                                    <CalibratedPlusIcon size={20} color={theme.accentColor} />
                                </motion.button>

                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: SIDEBAR */}
                <div
                    id="system-sidebar"
                    className={`relative w-full flex flex-col gap-1.5 lg:gap-2 lg:min-h-0 lg:h-full order-2 mb-10 lg:mb-0 lg:transition-[width] lg:duration-500 lg:ease-out lg:overflow-visible ${sidebarCollapsed ? 'lg:w-0' : 'lg:w-80 xl:w-96'}`}
                >
                    {/* RETRACT HANDLE — a bare glyph at the panel's leading edge, no frame
                        and no plate. A bordered button here competed with the HUD's own
                        bracket language instead of sitting inside it. Sits low-contrast
                        until pointed at. Hidden below lg with the rest of the collapse.

                        Collapsed it goes `fixed` against the viewport edge: the content
                        row centres itself when the panel is away, so an offset from the
                        zero-width panel would strand the glyph mid-gutter. */}
                    <button
                        type="button"
                        onClick={() => setSidebarCollapsed((v) => !v)}
                        aria-expanded={!sidebarCollapsed}
                        aria-controls="system-sidebar"
                        aria-label={sidebarCollapsed ? 'Expand system panel' : 'Collapse system panel'}
                        title={sidebarCollapsed ? 'Expand system panel' : 'Collapse system panel'}
                        className={`hidden lg:flex top-1/2 -translate-y-1/2 z-30 w-5 h-20 items-center justify-center bg-transparent border-0 opacity-40 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 cursor-pointer outline-none ${sidebarCollapsed ? 'fixed right-1' : 'absolute -left-5'}`}
                        style={{ color: theme.accentInk }}
                    >
                        {sidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
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
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'}`} />
                                            <div className={`w-4 h-[1px] ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'}`} />
                                        </div>

                                        <div className="relative p-0.5">
                                            <EntityAvatar theme={theme} size={84} />
                                            <button
                                                onClick={() => setIsProfileOpen(true)}
                                                className={`absolute -bottom-1 -right-2 px-1 py-0.5 ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'} text-black text-[7px] font-black font-mono tracking-tighter uppercase cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 shadow-lg z-20`}
                                            >
                                                ACTIVE_PROFILE
                                            </button>
                                        </div>

                                        {/* Vertical Scan Line decoration */}
                                        <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[1px] h-8 ${theme.id === 'LIGHT' ? 'bg-cyan-500' : 'bg-[#f59e0b]'} opacity-20`} />
                                    </div>

                                    <div className="flex flex-col items-start text-left flex-1 min-w-0 sm:-mt-6">
                                        <div className={`text-[10px] ${theme.highlightText} font-black font-mono uppercase tracking-[0.2em] mb-1 mt-0.5 opacity-90 transition-colors duration-700 whitespace-nowrap`}>ENTITY CLASSIFICATION</div>
                                        <div className="text-3xl sm:text-4xl lg:text-2xl xl:text-4xl font-black font-manifold tracking-tight drop-shadow-sm flex items-baseline leading-normal overflow-hidden h-[1.5em] sm:h-[1.5em] lg:h-[1.8em] xl:h-[1.5em]">
                                            <span className={`inline-block pr-[6px] text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} transition-colors duration-700 truncate`} style={{ lineHeight: '1.2' }}>{playerRank.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3"><div className={`flex justify-between text-[8px] font-mono ${theme.highlightText} mb-0.5 transition-colors duration-700 uppercase`}><span>EXP ACQUIRED</span><span>{totalChaptersRead} PTS</span></div><div className={`h-1 w-full ${theme.isDark ? 'bg-gray-800' : 'bg-gray-200'} transition-colors duration-700 overflow-hidden relative`}><div className={`h-full w-full bg-gradient-to-r ${theme.gradient} transition-transform duration-700 origin-left`} style={{ transform: `scaleX(0.6)`, boxShadow: emphasis(theme, accentRGB(theme), 0.6) }} /></div></div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* QUEST METRICS (Replaces Stat Box Grid) */}
                    <div className="w-full h-auto">
                        <SystemFrame variant="brackets" theme={theme}>
                            <div className="px-3 py-2 flex flex-col gap-1">
                                <div className={`flex items-center gap-2 ${theme.highlightText} font-mono text-[9px] tracking-widest font-bold mb-1`}>
                                    <Activity size={11} /> QUEST_METRICS
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>WISDOM</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{activeQuest.currentChapter}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>CH. READ</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>MIGHT</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{Math.floor(activeQuest.totalChapters / 10)}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>PWR INDEX</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>SYNC</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${theme.highlightText}`}>{progressPercent}%</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>COMPLETION</div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className={`text-[8px] ${theme.mutedText} font-mono uppercase tracking-widest`}>GATE</div>
                                        <div className={`text-xl font-bold font-mono tabular-nums leading-tight ${activeQuest.status === 'CONQUERED' ? 'text-gray-400' : theme.highlightText}`}>{activeQuest.status === 'CONQUERED' ? 'CLOSED' : 'OPEN'}</div>
                                        <div className={`text-[7px] ${theme.mutedText} font-mono uppercase`}>STATUS</div>
                                    </div>
                                </div>
                            </div>
                        </SystemFrame>
                    </div>

                    {/* ACTIVE QUESTS LIST - only scrollable region allowed */}
                    <div className="flex-1 flex flex-col min-h-0 gap-1 mt-2 overflow-hidden max-h-[380px] lg:max-h-none">
                        <div className={`text-[10px] font-mono ${theme.headingText} uppercase tracking-widest border-b ${theme.borderSubtle} pb-1.5 mb-1 transition-colors duration-700 shrink-0`}>ACTIVE QUESTS</div>
                        <ActiveQuestList
                            orderedActiveQuests={orderedActiveQuests}
                            handleReorderActiveQuests={handleReorderActiveQuests}
                            theme={theme}
                            activeId={activeId}
                            handleLogClick={handleLogClick}
                        />
                    </div>

                    {/* DIVINE SPIRE BUTTON */}
                    <button aria-label="Open Divine Spire" onClick={() => { setIsSpireOpen(true); }} className={`mt-auto hidden lg:flex w-full h-12 ${theme.isDark ? 'bg-white/5' : 'bg-sky-500/10'} border ${theme.borderSubtle} ${theme.highlightText} ${theme.isDark ? 'hover:bg-[#f59e0b] hover:text-black' : 'hover:bg-[#155e75] hover:text-white'} font-mono font-bold tracking-widest uppercase transition-all items-center justify-center gap-2 text-[12px] shrink-0 shadow-sm cursor-pointer duration-700`}><LayoutTemplate size={16} /> DIVINE SPIRE</button>
                    </div>{/* end full panel */}
                </div>
            </div>
        </main>
        // activeQuests, currentTheme and userState were listed but never read in this
        // block, so they only forced needless recomputation. overlayOpen IS read — the
        // hero dais pauses on it — and the four flags behind it only change on an
        // explicit open/close, so recomputing then is correct rather than wasteful.
    ), [theme, activeQuest, progressPercent, activeId, handleLogClick, orderedActiveQuests, handleReorderActiveQuests, totalChaptersRead, playerRank, updateProgress, coverImgError, handleEnterPortal, overlayOpen, sidebarCollapsed, holoEdge, holoSoft]);

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
            className={`relative h-[100dvh] overflow-hidden ${theme.appBg} ${theme.baseText} font-sans selection:bg-amber-500/30 transition-colors duration-700 ease-in-out`}
            style={{
                // Two accents, deliberately. `--accent-color` and its two derivatives are
                // decorative — fills, glows and washes, where chroma is the whole point and
                // nothing has to stay legible on top of them. `--accent-ink` is structural:
                // anything a reader has to actually read. On the light theme the decorative
                // cyan measures 2.08:1 against the page, which fails even the 3:1 large-text
                // floor, so display type reads in the ink and the fills keep the chroma.
                '--accent-color': theme.accentColor,
                '--accent-glow': `${theme.accentColor}88`,
                '--accent-faint': `${theme.accentColor}22`,
                '--accent-ink': theme.accentInk
            } as React.CSSProperties}
        >
            {/* Paused whenever a full-screen view covers it. It used to pause only for the
                gate modal, so it kept animating behind the Detail, Profile and Spire — and the
                Profile mounts its own particle field, so two canvases ran at once. */}
            <BackgroundController
                theme={theme}
                isPaused={overlayOpen}
                isMobile={isMobile}
            />
            {/* BACKGROUND GRADIENT FIX */}
            <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_100%)] opacity-50" />

            {/* HEADER */}
            {!isSpireOpen && memoizedHeader}

            {/* MAIN GRID */}
            {!isSpireOpen && memoizedMain}

            {/* DASHBOARD CONSOLE */}
            {!isSpireOpen &&
                !isModalOpen &&
                !isProfileOpen &&
                !isDetailOpen && (
                    <SystemConsole theme={theme} />
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
                            onClose={() => setIsSpireOpen(false)}
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
                                        {/* ── DIVINE SPIRE ── */}
                                        <motion.button
                                            aria-label="Open Divine Spire"
                                            onClick={() => { setIsSpireOpen(true); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.96 }}
                                            className="relative flex-1 h-16 overflow-hidden backdrop-blur-md"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(0,18,24,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(6,182,212,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 20px rgba(245,158,11,0.12), inset 0 0 30px rgba(245,158,11,0.04)'
                                                    : '0 0 20px rgba(6,182,212,0.12), inset 0 0 30px rgba(6,182,212,0.04)',
                                            }}
                                        >
                                            {/* Bracket corners — four tiny fixed SVGs, no calc() needed */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            {/* Scanline overlay */}
                                            <div className="absolute inset-0 pointer-events-none opacity-40"
                                                style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(6,182,212,0.04)'} 3px, ${theme.isDark ? 'rgba(245,158,11,0.04)' : 'rgba(6,182,212,0.04)'} 4px)` }}
                                            />
                                            {/* Sweep line animation */}
                                            <motion.div
                                                className="absolute left-0 right-0 h-[1px] pointer-events-none bg-[var(--accent-glow)]"
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            />
                                            {/* Content */}
                                            <div className="relative z-10 h-full flex items-center gap-3 px-4">
                                                <LayoutTemplate size={20} className={`shrink-0 ${theme.highlightText} drop-shadow-[0_0_8px_currentColor]`} />
                                                <div className="flex flex-col items-start leading-none min-w-0">
                                                    <span className={`font-mono text-[8px] tracking-[0.25em] uppercase ${theme.highlightText} opacity-60 mb-1`}>TERMINAL.EXECUTE</span>
                                                    <span className={`font-orbitron font-black text-[11px] tracking-[0.2em] uppercase ${theme.highlightText} drop-shadow-[0_0_6px_currentColor]`}>DIVINE_SPIRE</span>
                                                </div>
                                            </div>
                                        </motion.button>

                                        {/* ── CREATE GATE ── */}
                                        <motion.button
                                            onClick={() => { handleEnterPortal(activeQuest.link || '#'); setIsMobileHudExpanded(false); }}
                                            whileTap={{ scale: 0.94 }}
                                            className="relative w-16 h-16 overflow-hidden backdrop-blur-md flex flex-col items-center justify-center gap-1"
                                            style={{
                                                background: theme.isDark ? 'rgba(10,8,2,0.88)' : 'rgba(0,18,24,0.88)',
                                                border: `1px solid ${theme.isDark ? 'rgba(245,158,11,0.55)' : 'rgba(6,182,212,0.55)'}`,
                                                boxShadow: theme.isDark
                                                    ? '0 0 16px rgba(245,158,11,0.15)'
                                                    : '0 0 16px rgba(6,182,212,0.15)',
                                            }}
                                        >
                                            {/* Bracket corners */}
                                            <svg className="absolute top-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,9 0,0 9,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute top-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,9 9,0 0,0" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 left-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="0,0 0,9 9,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <svg className="absolute bottom-0 right-0 pointer-events-none" width="9" height="9" viewBox="0 0 9 9"><polyline points="9,0 9,9 0,9" fill="none" stroke={theme.isDark ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.3)'} strokeWidth="1.5" /></svg>
                                            <ExternalLink size={20} strokeWidth={2} className={`${theme.highlightText} drop-shadow-[0_0_8px_currentColor]`} />
                                            <span className={`font-mono text-[6px] tracking-[0.15em] ${theme.highlightText} opacity-70 uppercase`}>PORTAL</span>
                                        </motion.button>

                                        {/* ── CLOSE / COLLAPSE ── */}
                                        <motion.button
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
                                            <X size={20} strokeWidth={2} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                            <span className="font-mono text-[6px] tracking-[0.15em] text-red-500/70 uppercase">CLOSE</span>
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

            <GlitchOverlay isActive={glitchActive} onComplete={endGlitch} />
        </div>
    );
};

export default App;
