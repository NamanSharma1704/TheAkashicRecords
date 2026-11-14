import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Theme } from '../../core/types';
import SystemFrame from '../system/SystemFrame';
import { TerminalGlyph } from '../system/SystemGlyphs';
import { classColor } from './classColor';
import { useDialogFocus } from '../../utils/useDialogFocus';

/**
 * RE-CALIBRATE's progress: the System re-reading every record's class, with a live log (moved
 * out of HunterProfile.tsx, 2026-11-13). The profile runs the scan and owns its state; this
 * shows it. Escape dismisses it once it is done, never while it runs: stopping a scan is
 * ABORT_PROTOCOL's job, not a stray key's.
 */

export type CalibrationEntry = { processed: number; total: number; title: string; cls: string; changed: boolean };
export type CalibrationState = {
    phase: 'running' | 'done' | 'error';
    processed: number;
    total: number;
    updated: number;
    currentTitle: string;
    log: CalibrationEntry[];
    errorMsg: string;
};

const CalibrationOverlay: React.FC<{
    theme: Theme;
    calibration: CalibrationState | null;
    onAbort: () => void;
    onDismiss: () => void;
}> = ({ theme, calibration, onAbort, onDismiss }) => {
    const ref = useRef<HTMLDivElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    useDialogFocus(ref, !!calibration, () => {
        if (calibration?.phase !== 'running') onDismiss();
    });

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [calibration?.log.length]);

    return (
        <AnimatePresence>
        {calibration && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby="calibration-title"
                tabIndex={-1}
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
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
                            className={`absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${theme.id === 'LIGHT' ? 'via-violet-500/50' : 'via-amber-500/50'} to-transparent z-40 pointer-events-none`}
                        />
                    )}
                    {/* Every plate in here was a black wash (bg-black/40-70) in BOTH themes, over a
                        SystemFrame that is white on light — so light rendered mid-grey
                        panels carrying the page's own ink, 2.1:1 at worst. The void
                        keeps its washes; light gets pale slate plates instead. */}
                    <div className={`flex flex-col h-[75vh] max-h-[700px] ${theme.isDark ? 'bg-black/50' : 'bg-white/70'} overflow-hidden`}>

                        {/* ── HEADER ── */}
                        <div className={`flex justify-between items-center px-5 py-3.5 border-b ${theme.borderSubtle} shrink-0 ${theme.isDark ? 'bg-black/40' : 'bg-violet-50/70'}`}>
                            <span id="calibration-title" className={`${theme.highlightText} font-mono tracking-widest text-[11px] sm:text-sm flex items-center gap-2.5 uppercase`}>
                                <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full bg-accent-solid ${calibration.phase === 'running' ? 'animate-ping' : ''}`} />
                                <TerminalGlyph size={14} className={calibration.phase === 'running' ? 'animate-pulse' : ''} />
                                SYS_CALIBRATION_PROTOCOL
                            </span>
                            {calibration.phase === 'running' ? (
                                <button onClick={() => onAbort()}
                                    className={`hud hud-btn [--hud-c:5px] flex items-center justify-center ${theme.headingText} text-[10px] sm:text-xs font-orbitron px-3 py-1.5 font-bold tracking-wider group`}>
                                    <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-all" />
                                    <span className="relative z-10">ABORT_PROTOCOL</span>
                                </button>
                            ) : (
                                <button type="button" onClick={() => onDismiss()} aria-label="Close" title="Close"
                                    className={`hud hud-tool [--hud-c:5px] w-7 h-7 flex items-center justify-center ${theme.mutedText} hover:${theme.headingText}`}>
                                    <X size={14} aria-hidden="true" />
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
                                        {/* The failure reason was stored but never shown; an
                                            error now says what went wrong, as an alert. */}
                                        <div
                                            role={calibration.phase === 'error' ? 'alert' : undefined}
                                            className={`text-[8px] font-mono ${calibration.phase === 'error' ? (theme.isDark ? 'text-red-400' : 'text-red-700') : theme.highlightText} truncate max-w-[300px] uppercase`}
                                            title={calibration.phase === 'error' ? calibration.errorMsg : undefined}
                                        >
                                            {calibration.phase === 'running'
                                                ? `> SCANNING: ${calibration.currentTitle}`
                                                : calibration.phase === 'error'
                                                    ? `> ${calibration.errorMsg || 'UNKNOWN_FAULT'}`
                                                    : '> SYSTEM READY.'}
                                        </div>
                                        <div className={`text-[9px] font-orbitron ${theme.highlightText} font-bold`}>
                                            {calibration.total > 0 ? Math.round((calibration.processed / calibration.total) * 100) : 0}%
                                        </div>
                                    </div>
                                    <div role="progressbar" aria-label="Calibration progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={calibration.total > 0 ? Math.round((calibration.processed / calibration.total) * 100) : 0} className={`relative h-[2px] w-full ${theme.isDark ? 'bg-black/60' : 'bg-stone-200'} overflow-hidden`}>
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
                            <div className={`flex flex-col flex-1 min-h-0 border ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-white/80'} relative`}>
                                <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${theme.border} opacity-50`} />
                                <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${theme.border} opacity-50`} />
                                
                                <div className={`px-4 py-2 border-b ${theme.borderSubtle} flex justify-between items-center ${theme.isDark ? 'bg-white/[0.02]' : 'bg-stone-100/70'} shrink-0`}>
                                    <span className={`text-[7px] font-orbitron ${theme.mutedText} tracking-[0.2em] uppercase`}>Diagnostic_Feed</span>
                                    <span className={`text-[7px] font-orbitron ${theme.mutedText} tracking-widest uppercase`}>{calibration.log.length}_ENTRIES</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar hide-scrollbar space-y-[2px]">
                                    {calibration.log.length === 0 ? (
                                        <div className={`text-[9px] font-mono ${theme.mutedText} uppercase tracking-widest p-2 ${calibration.phase === 'running' ? 'animate-pulse' : ''}`}>
                                            {calibration.phase === 'running' ? '> AWAITING_DATA_STREAM...' : '> NO ENTRIES RECORDED.'}
                                        </div>
                                    ) : (
                                        calibration.log.map((entry, i) => (
                                            <div key={i} className={`flex items-start gap-4 text-[10px] font-mono leading-relaxed px-2 py-1.5 transition-colors ${entry.changed ? (theme.id === 'LIGHT' ? 'bg-violet-500/10' : 'bg-amber-500/10') : (theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}>
                                                <span className={`${theme.mutedText} shrink-0`}>[{String(entry.processed).padStart(2, '0')}/{entry.total}]</span>
                                                <span className={`flex-1 truncate uppercase tracking-widest ${entry.changed ? theme.headingText : theme.baseText}`}>
                                                    {entry.title}
                                                </span>
                                                <div className="shrink-0 flex items-center justify-end w-[130px] gap-2">
                                                    <span className={`${classColor(entry.cls, theme.isDark)} tracking-wider font-bold`}>{entry.cls}</span>
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
                            <div className={`px-5 py-3.5 ${theme.isDark ? 'bg-black/70' : 'bg-white/80'} backdrop-blur-md border-t ${theme.borderSubtle} shrink-0 relative overflow-hidden flex`}>
                                <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent ${theme.id === 'LIGHT' ? 'via-violet-500/40' : 'via-amber-500/40'} to-transparent`} />
                                
                                <button
                                    type="button"
                                    onClick={() => onDismiss()}
                                    className={`hud hud-btn hud-accent hud-ticks flex-1 ${theme.highlightText} font-orbitron font-black uppercase tracking-[0.25em] text-[11px] sm:text-xs py-3.5 group/ack`}
                                >
                                    {calibration.phase === 'done' ? 'ACKNOWLEDGE_UPDATE' : 'DISMISS_CRITICAL_ERROR'}
                                </button>
                            </div>
                        )}
                    </div>
                </SystemFrame>
            </motion.div>
        )}
    </AnimatePresence>
    );
};

export default CalibrationOverlay;
