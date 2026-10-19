import React from 'react';
import { Terminal, XCircle, RotateCw, X } from 'lucide-react';
import { Theme } from '../../core/types';
import { THEMES } from '../../core/constants';
import { accentVars } from '../../core/tokens';
import SystemFrame from './SystemFrame';
import SystemLogo from './SystemLogo';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** What failed, for the message ("the Divine Spire"). Omitted at the root. */
    scope?: string;
    /** Overlay boundaries: closes the view that failed and returns to the dashboard. */
    onDismiss?: () => void;
    /** The live theme. The root boundary sits outside App, so it reads the saved theme instead. */
    theme?: Theme;
}

/** The theme App would start in: the saved choice, else the Void (App's own rule). */
const savedTheme = (): Theme => {
    try {
        return THEMES[localStorage.getItem('akashic_theme') === 'LIGHT' ? 'LIGHT' : 'DARK'];
    } catch {
        return THEMES.DARK;
    }
};

interface FaultScreenProps {
    error: Error;
    theme: Theme;
    scope?: string;
    onDismiss?: () => void;
}

/**
 * The fault screen, in the app's own language: a SystemFrame panel laid out like a System
 * Notification (terminal header, icon chip, Orbitron headline, mono body, the same buttons),
 * over the theme's ground. The accent variables are set on its own wrapper, so the accent-*
 * utilities resolve even when the app failed before setting them on :root.
 */
const FaultScreen: React.FC<FaultScreenProps> = ({ error, theme, scope, onDismiss }) => {
    const where = scope ? scope.replace(/^the /i, '') : null;
    return (
        <div
            role="alert"
            className={`fixed inset-0 z-[900] overflow-y-auto ${theme.appBg}`}
            style={accentVars(theme) as React.CSSProperties}
        >
            {/* Ground: a soft accent bloom and the HUD's scanline texture, both static. */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0"
                style={{ background: `radial-gradient(ellipse 70% 55% at 50% 42%, rgba(${theme.accentFillRGB}, ${theme.isDark ? 0.1 : 0.16}), transparent 70%)` }}
            />
            <div aria-hidden="true" className={`pointer-events-none fixed inset-0 ${theme.isDark ? 'opacity-[0.04]' : 'opacity-[0.05]'} bg-[repeating-linear-gradient(0deg,currentColor_0px,currentColor_1px,transparent_1px,transparent_4px)] ${theme.headingText}`} />

            <div className="relative min-h-full flex flex-col items-center justify-center p-4 py-10">
                {/* Wordmark, as in the app header */}
                <div className="flex items-center gap-3 mb-6">
                    <SystemLogo theme={theme} className="w-10 h-10" />
                    <div className="flex flex-col leading-none">
                        <span className={`font-mono text-[10px] tracking-[0.2em] font-bold ${theme.headingText}`}>SYSTEM.ROOT</span>
                        <span className="font-orbitron text-lg tracking-[0.3em] font-bold text-accent-ink">AKASHIC</span>
                    </div>
                </div>

                <div className={`w-full max-w-md ${theme.isDark ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)]' : 'shadow-2xl'}`}>
                    <SystemFrame theme={theme} variant="full" level={2}>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Terminal size={12} aria-hidden="true" className={theme.highlightText} />
                                    <span className={`font-mono text-[9px] tracking-[0.3em] font-bold uppercase ${theme.mutedText}`}>System Fault</span>
                                </div>
                                <div className={`h-[1px] flex-1 mx-4 ${theme.isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                                <div className="flex gap-1" aria-hidden="true">
                                    <div className="w-1 h-1 rounded-full bg-red-500" />
                                    <div className="w-1 h-1 rounded-full bg-red-500 opacity-50" />
                                </div>
                            </div>

                            <div className="flex items-start gap-4 mb-8">
                                <div className={`p-3 rounded-full ${theme.isDark ? 'bg-white/5' : 'bg-black/5'} border ${theme.borderSubtle}`} aria-hidden="true">
                                    <XCircle className={theme.isDark ? 'text-red-500' : 'text-red-600'} size={24} />
                                </div>
                                <div className="flex-1 pt-1 space-y-2.5">
                                    <h1 className={`font-orbitron font-bold text-xs sm:text-sm tracking-widest uppercase leading-relaxed ${theme.headingText}`}>
                                        Protocol failure{where ? ` · ${where}` : ''}
                                    </h1>
                                    <p className={`font-mono text-[10px] sm:text-xs tracking-wide leading-loose ${theme.mutedText}`}>
                                        Something broke{scope ? ` in ${scope}` : ''}. Your library lives on the server, so nothing that was saved is lost.
                                    </p>
                                    <p className={`font-mono text-[10px] sm:text-xs tracking-wide leading-loose ${theme.mutedText}`}>
                                        {onDismiss ? 'Close this view to carry on, or reload the app.' : 'Reload to bring the app back.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3">
                                {onDismiss && (
                                    <button
                                        type="button"
                                        onClick={() => window.location.reload()}
                                        className={`px-6 py-2 border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-all font-mono text-[10px] tracking-widest uppercase font-bold inline-flex items-center gap-2`}
                                    >
                                        <RotateCw size={12} aria-hidden="true" /> Reload
                                    </button>
                                )}
                                <button
                                    type="button"
                                    autoFocus
                                    onClick={onDismiss ?? (() => window.location.reload())}
                                    className={`px-8 py-2 border ${theme.border} bg-accent-soft ${theme.highlightText} ${theme.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-all font-mono text-[10px] tracking-widest uppercase font-bold border-l-4 inline-flex items-center gap-2`}
                                >
                                    {onDismiss ? <><X size={12} aria-hidden="true" /> Close {where}</> : <><RotateCw size={12} aria-hidden="true" /> Reload</>}
                                </button>
                            </div>

                            <details className={`mt-6 pt-4 border-t ${theme.isDark ? 'border-white/10' : 'border-black/10'}`}>
                                <summary className={`font-mono text-[9px] tracking-[0.3em] font-bold uppercase cursor-pointer ${theme.mutedText}`}>Fault details</summary>
                                <pre className={`mt-2 font-mono text-[11px] whitespace-pre-wrap break-words ${theme.mutedText}`}>{error.message || String(error)}</pre>
                            </details>
                        </div>
                    </SystemFrame>
                </div>
            </div>
        </div>
    );
};

/**
 * Last resort for the fault screen itself: if it throws (it shares SystemFrame and the logo
 * with the app), this plain screen still gets the reader a Reload.
 */
class FaultScreenGuard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="fixed inset-0 z-[900] flex flex-col items-center justify-center gap-4 p-6 bg-black text-gray-200 font-mono text-sm text-center">
                <p>Something broke. Your library is saved on the server.</p>
                <button type="button" onClick={() => window.location.reload()} className="px-6 py-2 border border-gray-500 uppercase tracking-widest text-xs">Reload</button>
            </div>
        );
    }
}

/**
 * Catches a render error and shows a recoverable screen instead of a blank page.
 *
 * Without one, any exception during render unmounted the whole tree: the app went blank
 * with no way back but a manual reload (see the handleSave crash fixed in c3cb58d). The root
 * boundary covers the app; each heavy overlay (profile, detail, Spire, editor) has its own,
 * so a fault there closes that view and leaves the dashboard running. A lazy chunk that fails
 * to load (an old tab after a deploy) lands here too, where Reload is the fix.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, { error: Error | null }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[SYSTEM FAULT]${this.props.scope ? ` in ${this.props.scope}` : ''}:`, error, info.componentStack);
    }

    private dismiss = () => {
        // Both updates land in one render, so the failed view is gone before it could
        // render (and throw) again.
        this.setState({ error: null });
        this.props.onDismiss?.();
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <FaultScreenGuard>
                <FaultScreen
                    error={error}
                    theme={this.props.theme ?? savedTheme()}
                    scope={this.props.scope}
                    onDismiss={this.props.onDismiss ? this.dismiss : undefined}
                />
            </FaultScreenGuard>
        );
    }
}

export default ErrorBoundary;
