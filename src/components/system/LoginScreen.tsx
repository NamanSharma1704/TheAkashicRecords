import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Theme, AuthResponse } from '../../core/types';
import ScrambleText from './ScrambleText';
import SystemFrame from './SystemFrame';
import EntityAvatar from './EntityAvatar';
import BackgroundController from '../fx/BackgroundController';
import { Shield, Terminal, Key, Cpu, Zap, Sun, Moon } from 'lucide-react';

interface LoginScreenProps {
    /** The session itself arrives as an httpOnly cookie; this carries only display state. */
    onLoginSuccess: (auth: AuthResponse) => void;
    theme: Theme;
    /** Mirrors the in-app header toggle so the entry screen is not locked to one palette. */
    onToggleTheme?: () => void;
    /** Drops the two heaviest ambient layers on small screens, as the dashboard does. */
    isMobile?: boolean;
}

/**
 * Section label: the app's standard "◇ LABEL_TEXT" divider, used on every panel in the
 * dashboard, profile and Spire. Reproduced here so the entry screen reads as the same
 * system rather than as a separate product.
 */
const SectionLabel: React.FC<{ theme: Theme; children: React.ReactNode }> = ({ theme, children }) => (
    <div className="flex items-center gap-2">
        <div className="w-1 h-1 rotate-45" style={{ backgroundColor: theme.accentColor }} />
        <span className={`text-[9px] font-mono tracking-[0.3em] uppercase ${theme.mutedText}`}>{children}</span>
        <div className={`flex-1 h-[1px] ${theme.isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
    </div>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, theme, onToggleTheme, isMobile = false }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Required so the browser stores the session cookie the server sets.
                credentials: 'same-origin',
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                onLoginSuccess(data);
            } else {
                setError(data.message || 'AUTHENTICATION_PROTOCOL_FAILURE');
            }
        } catch {
            setError('COMMUNICATION_LINK_SEVERED');
        } finally {
            setLoading(false);
        }
    };

    const handleGuestAccess = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/guest', {
                method: 'POST',
                credentials: 'same-origin'
            });
            const data = await res.json();

            if (res.ok) {
                onLoginSuccess(data);
            } else {
                setError(data.message || 'GUEST_PROTO_FAILURE');
            }
        } catch {
            setError('GUEST_LINK_SEVERED');
        } finally {
            setLoading(false);
        }
    };

    // Field styling shared by both inputs, so they stay identical.
    const fieldClass = `w-full ${theme.inputBg} border ${theme.borderSubtle} px-3 py-2.5 outline-none
        focus:border-current transition-colors duration-700 font-mono text-sm peer
        ${theme.isDark ? 'text-white placeholder-white/20' : 'text-slate-900 placeholder-slate-400'}`;

    return (
        <div className={`fixed inset-0 z-[200] ${theme.appBg} font-mono overflow-y-auto hide-scrollbar transition-colors duration-700`}>
            {/* Same ambient stack the dashboard uses, rather than a one-off field. isMobile is
                passed through so phones skip the ring and ripple layers here too. */}
            <BackgroundController theme={theme} isMobile={isMobile} />

            {/* Theme toggle, positioned like the in-app header control. */}
            {onToggleTheme && (
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                    <button
                        onClick={onToggleTheme}
                        aria-label="Toggle theme"
                        className={`w-8 h-8 flex items-center justify-center border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded transition-colors duration-700`}
                    >
                        {theme.isDark
                            ? <Moon size={14} className="transition-colors duration-700" style={{ color: theme.accentInk }} />
                            : <Sun size={14} className="text-sky-600 transition-colors duration-700" />}
                    </button>
                </div>
            )}

            <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 py-12 relative z-10">
                <div className="w-full max-w-md">

                    {/* Glass panel: the ambient starfield reads through the surface, with the
                        frame's backdrop blur keeping the form legible on top of it. */}
                    <SystemFrame
                        theme={theme}
                        variant="full"
                        surfaceClass={theme.isDark ? 'bg-black/20' : 'bg-white/50'}
                    >
                        {/* animate-scanning: a faint band that sweeps down the glass. This effect
                            was on the original login panel; the colour is inline so it resolves
                            (the old one used an interpolated class that was never emitted). */}
                        <div
                            className="absolute inset-0 pointer-events-none animate-scanning"
                            style={{ background: `linear-gradient(to bottom, transparent, ${theme.accentColor}14, transparent)` }}
                        />
                        <div className="p-8 md:p-10 space-y-8">

                            {/* ── IDENTITY MARK ── */}
                            <div className="text-center space-y-4">
                                {/* The Apostle from the dashboard entity card and profile, rather than a
                                    generic icon — the same figure greets you before sign-in and after. */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        {/* animate-aura: a slow breathing bloom behind the figure,
                                            where this was previously a static blur. */}
                                        <div
                                            className="absolute -inset-3 rounded-full pointer-events-none animate-aura"
                                            style={{ backgroundColor: theme.accentColor }}
                                        />
                                        <EntityAvatar theme={theme} size={96} className="relative z-10 drop-shadow-2xl" />
                                    </div>
                                </div>

                                <h1 className={`font-orbitron text-2xl md:text-3xl font-black tracking-[0.2em] md:tracking-[0.3em] uppercase ${theme.headingText}`}>
                                    <ScrambleText text="AKASHIC.SYS" speed={60} revealSpeed={0.5} />
                                </h1>

                                <div className={`flex items-center justify-center gap-2 text-[9px] tracking-[0.3em] uppercase ${theme.mutedText}`}>
                                    <span
                                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ backgroundColor: theme.accentColor }}
                                    />
                                    <span>Identity Verification Required</span>
                                    <span
                                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ backgroundColor: theme.accentColor }}
                                    />
                                </div>
                            </div>

                            {/* ── CREDENTIALS ── */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <SectionLabel theme={theme}>Credentials</SectionLabel>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="login-username"
                                            className="text-[10px] tracking-[0.3em] uppercase flex items-center gap-2 font-bold"
                                            style={{ color: theme.accentInk }}
                                        >
                                            <Terminal size={11} aria-hidden="true" /> Hunter_ID
                                        </label>
                                        <input
                                            id="login-username"
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className={fieldClass}
                                            style={{ caretColor: theme.accentColor }}
                                            placeholder="UUID..."
                                            required
                                            disabled={loading}
                                            autoComplete="username"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label
                                            htmlFor="login-password"
                                            className="text-[10px] tracking-[0.3em] uppercase flex items-center gap-2 font-bold"
                                            style={{ color: theme.accentInk }}
                                        >
                                            <Key size={11} aria-hidden="true" /> Access_Key
                                        </label>
                                        <input
                                            id="login-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`${fieldClass} tracking-[0.3em]`}
                                            style={{ caretColor: theme.accentColor }}
                                            placeholder="••••••••"
                                            required
                                            disabled={loading}
                                            autoComplete="current-password"
                                        />
                                    </div>
                                </div>

                                {/* Error. The old markup used an `animate-shake` class that was never
                                    defined in any stylesheet, so the shake never happened; it is a real
                                    motion animation now. */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 0 }}
                                        animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                        role="alert"
                                        className={`p-3 border-l-2 border-red-500 text-red-500 text-[10px] tracking-[0.2em] font-bold uppercase ${theme.isDark ? 'bg-red-950/30' : 'bg-red-50'}`}
                                    >
                                        [!] SYS_ERR: {error}
                                    </motion.div>
                                )}

                                {/* ── ACTIONS ── */}
                                <div className="space-y-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full py-3.5 border font-black tracking-[0.3em] uppercase text-sm transition-all duration-700 relative group overflow-hidden flex items-center justify-center gap-3 ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                        /* Dark is a ghost button — accent text on a 10% accent wash — so it
                                           reads fine. Light fills solid with the accent, and white on that
                                           measured 2.43:1: the same failure ENTER PORTAL had. The fill
                                           carries the weight a primary action wants, so the label goes
                                           near-black (7.33:1) rather than the button going ghost too. */
                                        style={{
                                            color: theme.isDark ? theme.accentColor : '#0f172a',
                                            borderColor: theme.accentColor,
                                            backgroundColor: theme.isDark ? `${theme.accentColor}1a` : theme.accentColor
                                        }}
                                    >
                                        {loading
                                            ? <><Cpu size={16} className="animate-spin" /> Synchronizing...</>
                                            : <><Zap size={16} /> Initiate_Login</>}
                                    </button>

                                    <SectionLabel theme={theme}>Alt_Protocol</SectionLabel>

                                    {/* Hover colour is written as two complete literals rather than
                                        `hover:${theme.headingText}` — an interpolated variant is
                                        assembled at runtime and Tailwind's scanner never emits it. */}
                                    <button
                                        type="button"
                                        onClick={handleGuestAccess}
                                        disabled={loading}
                                        className={`w-full py-3 border ${theme.borderSubtle} ${theme.isDark
                                            ? 'bg-black/40 hover:bg-white/5 text-gray-300 hover:text-white'
                                            : 'bg-white/60 hover:bg-black/5 text-slate-600 hover:text-slate-900'} font-bold tracking-[0.2em] uppercase text-[10px] transition-colors duration-700 flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                    >
                                        <Shield size={13} /> Bypass_Authentication (Guest)
                                    </button>
                                </div>
                            </form>

                            {/* ── FOOTER TELEMETRY ── */}
                            <div className={`pt-5 border-t ${theme.borderSubtle} flex flex-wrap gap-2 justify-between items-center text-[8px] tracking-[0.2em] uppercase font-bold ${theme.mutedText}`}>
                                <span>Ver_1.08 [Alpha]</span>
                                <span className="hidden sm:inline">Encrypted_Channel</span>
                                {/* The pulse lives on a status dot. On the word itself it faded the
                                    text to half strength every second, which put it under AA at
                                    the bottom of each beat (2.6:1 light, 3.1:1 dark). */}
                                <span className="inline-flex items-center gap-1.5">
                                    <span aria-hidden="true" className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
                                    Node_<span style={{ color: theme.accentInk }}>Online</span>
                                </span>
                            </div>
                        </div>
                    </SystemFrame>
                </div>
            </div>

            {/* Edge accents, matching the hairlines the dashboard uses top and bottom. */}
            <div
                className="fixed top-0 left-0 w-full h-[2px] pointer-events-none z-[100]"
                style={{ background: `linear-gradient(90deg, transparent, ${theme.accentColor}4d, transparent)` }}
            />
            <div
                className="fixed bottom-0 left-0 w-full h-[2px] pointer-events-none z-[100]"
                style={{ background: `linear-gradient(90deg, transparent, ${theme.accentColor}4d, transparent)` }}
            />
        </div>
    );
};

export default LoginScreen;
