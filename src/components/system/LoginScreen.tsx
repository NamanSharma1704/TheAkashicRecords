import React, { useState } from 'react';
import { Theme, User } from '../../core/types';
import SystemFrame from './SystemFrame';
import ScrambleText from './ScrambleText';
import OmniscientField from '../fx/OmniscientField';
import { Shield, Terminal, Key, Cpu, Zap } from 'lucide-react';

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
        <div className="fixed inset-0 z-[200] bg-[#020202] flex items-center justify-center font-mono overflow-hidden">
            <OmniscientField forceAmber={true} />

            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent pointer-events-none animate-pulse" />

            <div className="w-full max-w-md p-6 relative z-10">
                <SystemFrame variant="full" theme={theme}>
                    <div className="p-8 space-y-8">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 animate-pulse" />
                                    <Shield size={48} className="text-amber-500 relative z-10" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-black tracking-[0.2em] text-amber-500 uppercase overflow-hidden">
                                <ScrambleText text="System Synchronize" speed={60} revealSpeed={0.5} />
                            </h2>
                            <p className="text-[10px] text-amber-500/60 tracking-widest uppercase">
                                Identity Verification Required
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-amber-500/80 tracking-widest flex items-center gap-2">
                                        <Terminal size={12} /> HUNTER_ID
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-black/50 border border-amber-500/30 p-3 text-amber-500 focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-widest text-sm"
                                        placeholder="INPUT_ID..."
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-amber-500/80 tracking-widest flex items-center gap-2">
                                        <Key size={12} /> ACCESS_KEY
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/50 border border-amber-500/30 p-3 text-amber-500 focus:outline-none focus:border-amber-500 transition-colors tracking-[0.5em] text-sm"
                                        placeholder="••••••••"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 border border-red-500/50 bg-red-950/20 text-red-500 text-[10px] tracking-widest uppercase animate-shake">
                                    [!] CRITICAL_ERROR: {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 border border-amber-500 font-black tracking-[0.3em] uppercase text-sm relative group overflow-hidden transition-all ${loading ? 'opacity-50 cursor-wait' : 'hover:bg-amber-500 hover:text-black cursor-pointer'}`}
                            >
                                <div className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? (
                                        <>
                                            <Cpu size={16} className="animate-spin" />
                                            LINKING...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={16} className="group-hover:animate-bounce" />
                                            INITIATE_LOGIN
                                        </>
                                    )}
                                </div>
                                {!loading && (
                                    <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500 skew-x-12" />
                                )}
                            </button>

                            <div className="flex items-center gap-4 py-2">
                                <div className="h-[1px] flex-1 bg-amber-500/20" />
                                <span className="text-[8px] text-amber-500/40 uppercase tracking-widest">or</span>
                                <div className="h-[1px] flex-1 bg-amber-500/20" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGuestAccess}
                                disabled={loading}
                                className={`w-full py-3 border border-amber-500/30 font-bold tracking-[0.2em] uppercase text-[10px] relative group overflow-hidden transition-all ${loading ? 'opacity-50 cursor-wait' : 'hover:border-amber-500/60 hover:text-amber-500/80 cursor-pointer'}`}
                            >
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    <Cpu size={12} className={loading ? 'animate-spin' : ''} />
                                    ENTER_AS_GUEST
                                </div>
                            </button>
                        </form>

                        {/* Footer Decoration */}
                        <div className="pt-4 border-t border-amber-500/20 flex justify-between items-center text-[8px] text-amber-500/40 tracking-[0.2em] uppercase">
                            <span>Proto_v1.08</span>
                            <span>Secure_Link_Established</span>
                            <span>Region_01</span>
                        </div>
                    </div>
                </SystemFrame>
            </div>

            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-10 left-10 w-20 h-[1px] bg-amber-500" />
                <div className="absolute top-10 left-10 w-[1px] h-20 bg-amber-500" />
                <div className="absolute bottom-10 right-10 w-20 h-[1px] bg-amber-500" />
                <div className="absolute bottom-10 right-10 w-[1px] h-20 bg-amber-500" />
            </div>
        </div>
    );
};

export default LoginScreen;
