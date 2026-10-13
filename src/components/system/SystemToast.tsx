import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';

export type ToastTone = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface ToastSpec {
    /** Unique per toast; a new id restarts the timer even when the text is unchanged. */
    id: number;
    /** Headline, in the System's voice. */
    message: string;
    /** Plain-language second line: what happened, or what to do. */
    detail?: string;
    tone?: ToastTone;
    /** One inline action, e.g. UNDO. Taking it dismisses the toast. */
    action?: { label: string; onAction: () => void };
    /** Milliseconds before it dismisses itself. 0 keeps it until replaced or dismissed. */
    duration?: number;
    /** 0..1 for a determinate task (CSV import). Replaces the countdown bar. */
    progress?: number;
}

interface SystemToastProps {
    toast: ToastSpec | null;
    onDismiss: (id: number) => void;
    theme: Theme;
}

/**
 * Non-blocking notice with an optional action — the home of Undo.
 *
 * SystemNotification is a modal dialog, right for a question but wrong for "done, and here is
 * how to take it back": that must not steal focus or stop the next tap. This is a live region
 * instead, so a screen reader hears it without focus moving, and the action is one Tab away.
 *
 * The dismissal timer pauses while the pointer is over the toast or focus is inside it (WCAG
 * 2.2.1), and it is timed in JS rather than off the countdown bar's animation: the global
 * reduced-motion reset collapses every CSS animation to 0.01ms, which would otherwise dismiss
 * a toast the moment it appeared.
 */
const SystemToast: React.FC<SystemToastProps> = ({ toast, onDismiss, theme }) => {
    const [paused, setPaused] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const remaining = useRef(0);
    const startedAt = useRef(0);

    const id = toast?.id;
    const duration = toast?.duration ?? 0;

    // A new toast starts a fresh countdown.
    useEffect(() => {
        remaining.current = duration;
        setPaused(false);
    }, [id, duration]);

    useEffect(() => {
        if (id === undefined || duration <= 0 || paused) return;
        startedAt.current = Date.now();
        timer.current = setTimeout(() => onDismiss(id), remaining.current);
        return () => {
            if (timer.current) clearTimeout(timer.current);
            remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
        };
    }, [id, duration, paused, onDismiss]);

    const tone = toast?.tone ?? 'INFO';
    const icon = (() => {
        const accentIcon = 'text-accent-icon';
        switch (tone) {
            case 'SUCCESS': return <CheckCircle size={18} className={accentIcon} />;
            case 'WARNING': return <AlertTriangle size={18} style={{ color: theme.warningInk }} />;
            case 'ERROR': return <XCircle size={18} className={theme.isDark ? 'text-red-500' : 'text-red-600'} />;
            default: return <Info size={18} className={accentIcon} />;
        }
    })();

    return (
        // The live region is always mounted: content inserted into a region that already
        // exists is announced reliably; a region created together with its content often isn't.
        // Phones and tablets keep the toast above the HUD compass (bottom-6, 80px tall); from
        // lg it docks bottom-right, clear of the console bar and of the hero's chapter controls.
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="fixed z-[1100] left-4 right-4 bottom-[7.5rem] sm:left-auto sm:right-6 sm:w-[23rem] lg:bottom-12 pointer-events-none"
        >
            {/* popLayout: a replaced toast leaves the flow at once and fades where it was,
                instead of stacking with its successor and shoving it up for the exit. */}
            <AnimatePresence mode="popLayout">
                {toast && (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="pointer-events-auto"
                        onPointerEnter={() => setPaused(true)}
                        onPointerLeave={() => setPaused(false)}
                        onFocus={() => setPaused(true)}
                        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}
                    >
                        <SystemFrame theme={theme} level={3}>
                            <div className="flex items-center gap-3 pl-3.5 pr-2 py-3">
                                <span aria-hidden="true" className="shrink-0">{icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-orbitron font-bold text-[11px] tracking-[0.14em] uppercase leading-snug ${theme.headingText}`}>
                                        {toast.message}
                                    </p>
                                    {toast.detail && (
                                        // Two lines, not one: the second half is often the part
                                        // that matters ("total raised to 182 (was 175)").
                                        <p className={`font-mono text-[11px] leading-snug mt-0.5 ${theme.mutedText} line-clamp-2`} title={toast.detail}>
                                            {toast.detail}
                                        </p>
                                    )}
                                </div>
                                {toast.action && (
                                    <button
                                        type="button"
                                        onClick={() => { toast.action!.onAction(); onDismiss(toast.id); }}
                                        className={`shrink-0 h-8 px-3 border ${theme.border} bg-accent-soft hover:bg-accent-soft-strong font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors`}
                                        style={{ color: theme.accentInk }}
                                    >
                                        {toast.action.label}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onDismiss(toast.id)}
                                    aria-label="Dismiss notice"
                                    title="Dismiss"
                                    className={`shrink-0 w-8 h-8 flex items-center justify-center ${theme.mutedText} ${theme.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} transition-colors`}
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            </div>
                            {/* Countdown, or determinate progress for a long task. */}
                            {(toast.progress !== undefined || duration > 0) && (
                                <div className={`h-[2px] w-full ${theme.isDark ? 'bg-white/5' : 'bg-black/5'}`} aria-hidden="true">
                                    <div
                                        key={toast.id}
                                        className="h-full origin-left"
                                        style={toast.progress !== undefined
                                            ? { backgroundColor: theme.accentColor, transform: `scaleX(${Math.min(1, Math.max(0, toast.progress))})`, transition: 'transform 300ms ease-out' }
                                            : { backgroundColor: theme.accentColor, animation: `toast-countdown ${duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                                    />
                                </div>
                            )}
                        </SystemFrame>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default React.memo(SystemToast);
