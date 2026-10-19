import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** What failed, for the message ("the Divine Spire"). Omitted at the root. */
    scope?: string;
    /** Overlay boundaries: closes the view that failed and returns to the dashboard. */
    onDismiss?: () => void;
    /** The theme. The root boundary sits outside App, so it reads the saved theme instead. */
    dark?: boolean;
}

interface ErrorBoundaryState {
    error: Error | null;
}

// Fixed colours, not the accent-* utilities: the root boundary can render before App has
// set the accent CSS variables (a crash on the first render), and a fault screen must never
// depend on the code that just failed. Same values as the themes' tokens.
// theme-color-ok: the fallback cannot rely on the CSS variables App sets
const PALETTES = {
    dark: { bg: '#020202', panel: '#0a0a0c', border: 'rgba(255,255,255,0.1)', ink: '#f3f4f6', muted: '#9ca3af', accent: '#f59e0b', onAccent: '#000000' },
    light: { bg: '#e9e2f6', panel: '#fbf9ff', border: '#d3cae8', ink: '#241a33', muted: '#655a80', accent: '#5b21b6', onAccent: '#ffffff' },
};

const savedThemeIsDark = () => {
    try {
        return localStorage.getItem('akashic_theme') !== 'LIGHT';
    } catch {
        return true;
    }
};

/**
 * Catches a render error and shows a recoverable screen instead of a blank page.
 *
 * Without one, any exception during render unmounted the whole tree: the app went blank
 * with no way back but a manual reload (see the handleSave crash fixed in c3cb58d). The root
 * boundary covers the app; each heavy overlay (profile, detail, Spire, editor) has its own,
 * so a fault there closes that view and leaves the dashboard running. A lazy chunk that fails
 * to load (an old tab after a deploy) lands here too, where Reload is the fix.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
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

        const { scope, onDismiss } = this.props;
        const p = (this.props.dark ?? savedThemeIsDark()) ? PALETTES.dark : PALETTES.light;
        const button = 'px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.2em] uppercase rounded-sm cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

        return (
            <div
                role="alert"
                className="fixed inset-0 z-[900] flex items-center justify-center p-4"
                style={{ background: p.bg, color: p.ink }}
            >
                <div className="w-full max-w-md p-6 sm:p-8 border rounded-sm" style={{ background: p.panel, borderColor: p.border }}>
                    <div className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: p.accent }}>
                        System fault
                    </div>
                    <h1 className="font-orbitron text-lg sm:text-xl font-bold tracking-wide mb-3">
                        Something broke{scope ? ` in ${scope}` : ''}.
                    </h1>
                    <p className="font-mono text-[12px] leading-relaxed mb-6" style={{ color: p.muted }}>
                        Your library lives on the server, so nothing that was saved is lost.
                        {onDismiss ? ' Close this view to carry on, or reload the app.' : ' Reload to bring the app back.'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {onDismiss && (
                            <button type="button" onClick={this.dismiss} className={button} style={{ background: p.accent, color: p.onAccent, outlineColor: p.accent }}>
                                Close {scope ?? 'view'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className={`${button} border`}
                            style={onDismiss
                                ? { borderColor: p.border, color: p.ink, outlineColor: p.accent }
                                : { background: p.accent, color: p.onAccent, borderColor: p.accent, outlineColor: p.accent }}
                        >
                            Reload
                        </button>
                    </div>
                    <details className="mt-6">
                        <summary className="font-mono text-[10px] tracking-widest uppercase cursor-pointer" style={{ color: p.muted }}>
                            Details
                        </summary>
                        <pre className="mt-2 font-mono text-[11px] whitespace-pre-wrap break-words" style={{ color: p.muted }}>
                            {error.message || String(error)}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
