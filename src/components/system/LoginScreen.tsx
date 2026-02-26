import React, { useState } from 'react';
import { Theme, User } from '../../core/types';
import ScrambleText from './ScrambleText';
import OmniscientField from '../fx/OmniscientField';
import { Shield, Terminal, Key, Cpu, Zap, Fingerprint } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: (user: User, token: string) => void;
    theme: Theme;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, theme }) => {
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
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                onLoginSuccess(data.user, data.token);
            } else {
                setError(data.message || 'AUTHENTICATION_PROTOCOL_FAILURE');
            }
        } catch (err) {
            setError('COMMUNICATION_LINK_SEVERED');
        } finally {
            setLoading(false);
        }
    };

    const handleGuestAccess = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/guest', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                onLoginSuccess(data.user, data.token);
            } else {
                setError(data.message || 'GUEST_PROTO_FAILURE');
            }
        } catch (err) {
            setError('GUEST_LINK_SEVERED');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#020202] font-mono overflow-y-auto hide-scrollbar selection:bg-amber-500/30">
            {/* Cinematic Background */}
            <OmniscientField forceAmber={true} />

            {/* Ambient System Glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.1)_0%,transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.05)_0%,transparent_50%)] pointer-events-none" />

            <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 py-12 relative z-10 scanline-effect">
                <div className="w-full max-w-md relative group">

                    {/* HOLOGRAPHIC PANEL (Main Container) */}
                    <div className="holographic-panel p-8 md:p-10 relative overflow-hidden bracket-glow">

                        {/* Internal Scanline & Grid texture */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-50" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent animate-scanning pointer-events-none mix-blend-overlay" />

                        <div className="relative z-10 space-y-10">

                            {/* HEADER */}
                            <div className="text-center space-y-3">
                                <div className="flex justify-center mb-6">
                                    <div className="relative p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-[0_0_30px_rgba(245,158,11,0.1)] group-hover:shadow-[0_0_50px_rgba(245,158,11,0.2)] transition-shadow duration-700">
                                        <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 animate-pulse mix-blend-screen" />
                                        <Fingerprint size={48} strokeWidth={1} className="text-amber-500 relative z-10" />
                                    </div>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-[0.2em] md:tracking-[0.3em] text-amber-500 uppercase overflow-hidden textShadow-glow drop-shadow-lg">
                                    <ScrambleText text="AKASHIC.SYS" speed={60} revealSpeed={0.5} />
                                </h1>
                                <div className="flex items-center justify-center gap-2 text-[9px] text-amber-400/60 tracking-[0.3em] uppercase">
                                    <div className="w-2 h-2 bg-amber-500/40 rounded-full animate-ping" />
                                    <span>Identity Verification Required</span>
                                    <div className="w-2 h-2 bg-amber-500/40 rounded-full animate-ping" />
                                </div>
                            </div>

                            {/* TERMINAL FORM */}
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="space-y-6">
                                    {/* USERNAME INPUT */}
                                    <div className="space-y-2 relative group/input cursor-text">
                                        <label className="text-[10px] text-amber-500/80 tracking-widest flex items-center gap-2 font-bold group-focus-within/input:text-amber-400 transition-colors">
                                            <Terminal size={12} /> {'>'} HUNTER_ID
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full bg-black/40 border-b-2 border-amber-500/20 px-3 py-3 text-amber-400 outline-none focus:border-amber-500 focus:bg-amber-500/5 transition-all uppercase tracking-[0.2em] text-sm peer placeholder-amber-500/20 backdrop-blur-sm shadow-inner"
                                                placeholder="UUID..."
                                                required
                                                disabled={loading}
                                                autoComplete="username"
                                            />
                                            {/* Input focus brackets */}
                                            <div className="absolute left-0 bottom-0 w-1 h-3 border-l-2 border-b-2 border-amber-500 opacity-0 peer-focus:opacity-100 transition-opacity" />
                                            <div className="absolute right-0 bottom-0 w-1 h-3 border-r-2 border-b-2 border-amber-500 opacity-0 peer-focus:opacity-100 transition-opacity" />
                                        </div>
                                    </div>

                                    {/* PASSWORD INPUT */}
                                    <div className="space-y-2 relative group/input cursor-text">
                                        <label className="text-[10px] text-amber-500/80 tracking-widest flex items-center gap-2 font-bold group-focus-within/input:text-amber-400 transition-colors">
                                            <Key size={12} /> {'>'} ACCESS_KEY
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-black/40 border-b-2 border-amber-500/20 px-3 py-3 text-amber-400 outline-none focus:border-amber-500 focus:bg-amber-500/5 transition-all tracking-[0.5em] text-lg peer placeholder-amber-500/20 backdrop-blur-sm shadow-inner"
                                                placeholder="••••••••"
                                                required
                                                disabled={loading}
                                                autoComplete="current-password"
                                            />
                                            {/* Input focus brackets */}
                                            <div className="absolute left-0 bottom-0 w-1 h-3 border-l-2 border-b-2 border-amber-500 opacity-0 peer-focus:opacity-100 transition-opacity" />
                                            <div className="absolute right-0 bottom-0 w-1 h-3 border-r-2 border-b-2 border-amber-500 opacity-0 peer-focus:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                </div>

                                {/* ERROR DISPLAY */}
                                {error && (
                                    <div className="p-3 border-l-2 border-red-500 bg-red-950/20 text-red-500 text-[9px] tracking-[0.1em] md:tracking-[0.2em] font-bold uppercase animate-shake shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                        [!] SYS_ERR: {error}
                                    </div>
                                )}

                                {/* ACTION BUTTONS */}
                                <div className="space-y-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full py-4 bg-amber-500/10 hover:bg-amber-500 border border-amber-500/50 hover:border-amber-500 font-black tracking-[0.3em] uppercase text-sm md:text-base text-amber-500 hover:text-black hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all duration-300 relative group overflow-hidden ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} skew-x-[-2deg]`}
                                    >
                                        <div className="relative z-10 flex items-center justify-center gap-3 skew-x-[2deg]">
                                            {loading ? (
                                                <>
                                                    <Cpu size={18} className="animate-spin" />
                                                    SYNCHRONIZING...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={18} className="group-hover:animate-bounce" />
                                                    INITIATE_LOGIN
                                                </>
                                            )}
                                        </div>
                                        {!loading && (
                                            <div className="absolute inset-0 bg-white/20 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 skew-x-12" />
                                        )}
                                    </button>

                                    <div className="flex items-center gap-4 py-2 opacity-50">
                                        <div className="h-[1px] flex-1 bg-amber-500/20" />
                                        <span className="text-[8px] text-amber-500 uppercase tracking-widest font-bold">ALT_PROTOCOL</span>
                                        <div className="h-[1px] flex-1 bg-amber-500/20" />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleGuestAccess}
                                        disabled={loading}
                                        className={`w-full py-3 bg-black/60 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5 font-bold tracking-[0.2em] uppercase text-[10px] text-amber-500/60 hover:text-amber-400 transition-all duration-300 relative group overflow-hidden ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} flex items-center justify-center gap-2`}
                                    >
                                        <Shield size={14} className="group-hover:text-amber-400 transition-colors" />
                                        BYPASS_AUTHENTICATION (GUEST)
                                    </button>
                                </div>
                            </form>

                            {/* FOOTER METADATA */}
                            <div className="pt-6 border-t border-amber-500/10 flex flex-wrap gap-2 justify-between items-center text-[7px] md:text-[8px] text-amber-500/40 tracking-[0.2em] uppercase font-bold">
                                <span>Ver_1.08 [ALPHA]</span>
                                <span className="hidden sm:inline">Encrypted_Channel</span>
                                <div>NODE_<span className="text-amber-500/80 animate-pulse">ONLINE</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Borders / Tactical HUD Accents */}
            <div className="fixed top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none z-[100]" />
            <div className="fixed bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none z-[100]" />
        </div>
    );
};

export default LoginScreen;

