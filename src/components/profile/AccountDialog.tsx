import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, KeyRound, User2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Theme } from '../../core/types';
import { systemFetch, saveAuthData } from '../../utils/auth';
import { useDialogFocus } from '../../utils/useDialogFocus';

/**
 * Edit Profile: a new username, a new password, or both, against the current password (moved
 * out of HunterProfile.tsx, 2026-11-13). It owns its form; the profile only opens it and hears
 * about the new user record.
 */
const AccountDialog: React.FC<{
    theme: Theme;
    open: boolean;
    onClose: () => void;
    /** The signed-in username, shown as "Current". */
    username?: string;
    /** The updated user, once the server has saved it. */
    onUpdated: (user: ReturnType<typeof JSON.parse>) => void;
}> = ({ theme, open, onClose, username, onUpdated }) => {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(ref, open, onClose);
    const [accountForm, setAccountForm] = useState({ newUsername: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [accountStatus, setAccountStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
    const [accountLoading, setAccountLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountStatus(null);
        if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
            setAccountStatus({ type: 'error', msg: 'New passwords do not match.' });
            return;
        }
        if (!accountForm.newUsername.trim() && !accountForm.newPassword) {
            setAccountStatus({ type: 'error', msg: 'Provide a new username or new password to update.' });
            return;
        }
        setAccountLoading(true);
        try {
            const res = await systemFetch('/api/auth/update', {
                method: 'PUT',
                body: JSON.stringify({
                    newUsername: accountForm.newUsername.trim() || undefined,
                    currentPassword: accountForm.currentPassword,
                    newPassword: accountForm.newPassword || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAccountStatus({ type: 'error', msg: data.message || 'Update failed.' });
            } else {
                // Persist new token + user to localStorage
                saveAuthData(data);
                // Immediately update the displayed username in the UI
                onUpdated(data.user);
                setAccountStatus({ type: 'success', msg: 'Credentials updated. Changes saved to database.' });
                setAccountForm({ newUsername: '', currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch {
            setAccountStatus({ type: 'error', msg: 'Network error. Try again.' });
        } finally {
            setAccountLoading(false);
        }
    };

    // Each opening starts without the last one's message.
    useEffect(() => { if (open) setAccountStatus(null); }, [open]);

    return (
        <AnimatePresence>
        {open && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-modal-title"
                tabIndex={-1}
                className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className={`hud hud-shell w-full max-w-md ${theme.isDark ? 'bg-[#0a0a0a]' : 'bg-white'} overflow-hidden`}
                >
                    {/* Modal Header */}
                    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${theme.borderSubtle} ${theme.isDark ? 'bg-black/40' : 'bg-violet-50/70'}`}>
                        <div id="account-modal-title" className={`flex items-center gap-2.5 ${theme.highlightText} font-mono text-[11px] tracking-widest uppercase font-bold`}>
                            <KeyRound size={13} aria-hidden="true" />
                            HUNTER_CREDENTIALS
                        </div>
                        <button type="button" onClick={() => onClose()} aria-label="Close" title="Close" className={`hud hud-tool [--hud-c:5px] w-7 h-7 flex items-center justify-center ${theme.mutedText} hover:${theme.highlightText}`}>
                            <X size={13} aria-hidden="true" />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <form onSubmit={submit} className="p-5 flex flex-col gap-4">
                        {/* Current username display */}
                        <div className={`flex items-center gap-2 px-3 py-2 border ${theme.borderSubtle} rounded-sm ${theme.isDark ? 'bg-white/[0.03]' : 'bg-violet-50/70'}`}>
                            <User2 size={12} className={theme.mutedText} />
                            <span className={`text-[10px] font-mono ${theme.mutedText} uppercase tracking-widest`}>Current:</span>
                            <span className={`text-[11px] font-mono font-bold ${theme.highlightText}`}>{username || '—'}</span>
                        </div>

                        {/* New username */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="account-new-username" className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>New Username <span className="font-normal">(leave blank to keep)</span></label>
                            <input
                                id="account-new-username"
                                autoComplete="username"
                                type="text"
                                value={accountForm.newUsername}
                                onChange={e => setAccountForm(f => ({ ...f, newUsername: e.target.value }))}
                                placeholder={username || ''}
                                className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-violet-50 text-stone-900 placeholder:text-stone-600'} rounded-sm outline-none focus:${theme.border} transition-colors`}
                            />
                        </div>

                        {/* Current password */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="account-current-password" className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>Current Password <span className={theme.isDark ? 'text-red-400' : 'text-red-700'} aria-hidden="true">*</span></label>
                            <input
                                id="account-current-password"
                                autoComplete="current-password"
                                type="password"
                                required
                                value={accountForm.currentPassword}
                                onChange={e => setAccountForm(f => ({ ...f, currentPassword: e.target.value }))}
                                placeholder="••••••••"
                                className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-violet-50 text-stone-900 placeholder:text-stone-600'} rounded-sm outline-none focus:${theme.border} transition-colors`}
                            />
                        </div>

                        {/* New password */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="account-new-password" className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>New Password <span className="font-normal">(leave blank to keep)</span></label>
                            <input
                                id="account-new-password"
                                autoComplete="new-password"
                                type="password"
                                value={accountForm.newPassword}
                                onChange={e => setAccountForm(f => ({ ...f, newPassword: e.target.value }))}
                                placeholder="••••••••"
                                className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-violet-50 text-stone-900 placeholder:text-stone-600'} rounded-sm outline-none focus:${theme.border} transition-colors`}
                            />
                        </div>

                        {/* Confirm new password */}
                        {accountForm.newPassword && (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="account-confirm-password" className={`text-[9px] font-mono font-bold uppercase tracking-widest ${theme.mutedText}`}>Confirm New Password</label>
                                <input
                                    id="account-confirm-password"
                                    autoComplete="new-password"
                                    type="password"
                                    value={accountForm.confirmPassword}
                                    onChange={e => setAccountForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                    placeholder="••••••••"
                                    className={`w-full px-3 py-2 text-[11px] font-mono border ${theme.borderSubtle} ${theme.isDark ? 'bg-white/5 text-white placeholder:text-white/20' : 'bg-violet-50 text-stone-900 placeholder:text-stone-600'} rounded-sm outline-none focus:${theme.border} transition-colors`}
                                />
                            </div>
                        )}

                        {/* Status message */}
                        {accountStatus && (
                            // -400 status text is tuned for the void and sits near 2.5:1 on
                            // this white panel; light takes the -700 rungs (5.9 / 5.5:1).
                            <div role={accountStatus.type === 'error' ? 'alert' : 'status'} className={`flex items-center gap-2 px-3 py-2 rounded-sm text-[10px] font-mono font-bold ${
                                accountStatus.type === 'error'
                                    ? `bg-red-500/10 border border-red-500/30 ${theme.isDark ? 'text-red-400' : 'text-red-700'}`
                                    : `bg-emerald-500/10 border border-emerald-500/30 ${theme.isDark ? 'text-emerald-400' : 'text-emerald-700'}`
                            }`}>
                                {accountStatus.type === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                                {accountStatus.msg}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={accountLoading}
                            className="hud hud-cmd hud-hash w-full py-2.5 font-mono font-black text-[11px] uppercase tracking-[0.25em] disabled:opacity-40 group/submit"
                        >
                            {accountLoading ? 'SYNCHRONIZING...' : 'UPDATE_CREDENTIALS'}
                        </button>
                    </form>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
    );
};

export default AccountDialog;
