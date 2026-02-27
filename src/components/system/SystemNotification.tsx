import React from 'react';
import { Theme } from '../../core/types';
import SystemFrame from './SystemFrame';
import { AlertTriangle, CheckCircle, Info, XCircle, Terminal } from 'lucide-react';

interface SystemNotificationProps {
    isOpen: boolean;
    message: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    confirm?: boolean;
    onClose: (result: boolean) => void;
    theme: Theme;
}

const SystemNotification: React.FC<SystemNotificationProps> = ({
    isOpen,
    message,
    type = 'INFO',
    confirm = false,
    onClose,
    theme
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle className={theme.id === 'LIGHT' ? 'text-sky-500' : 'text-amber-500'} size={24} />;
            case 'WARNING': return <AlertTriangle className="text-amber-500" size={24} />;
            case 'ERROR': return <XCircle className="text-red-500" size={24} />;
            default: return <Info className="text-sky-500" size={24} />;
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-md ${theme.id === 'LIGHT' ? 'shadow-2xl' : 'shadow-[0_0_30px_rgba(0,0,0,0.5)]'}`}>
                <SystemFrame theme={theme} variant="full">
                    <div className="p-6">
                        {/* Header Decoration */}
                        <div className="flex items-center justify-between mb-6 opacity-60">
                            <div className="flex items-center gap-2">
                                <Terminal size={12} className={theme.highlightText} />
                                <span className="font-mono text-[9px] tracking-[0.3em] font-bold uppercase">System Notification</span>
                            </div>
                            <div className={`h-[1px] flex-1 mx-4 ${theme.borderSubtle} opacity-30`} />
                            <div className="flex gap-1">
                                <div className={`w-1 h-1 rounded-full ${theme.highlightText}`} />
                                <div className={`w-1 h-1 rounded-full ${theme.highlightText} opacity-50`} />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex items-start gap-4 mb-8">
                            <div className={`p-3 rounded-full ${theme.isDark ? 'bg-white/5' : 'bg-black/5'} border ${theme.borderSubtle}`}>
                                {getIcon()}
                            </div>
                            <div className="flex-1 pt-1">
                                <p className={`font-orbitron font-bold text-sm tracking-wide ${theme.headingText} leading-relaxed`}>
                                    {message}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 mt-4">
                            {confirm && (
                                <button
                                    onClick={() => onClose(false)}
                                    className={`px-6 py-2 border ${theme.borderSubtle} ${theme.mutedText} hover:${theme.headingText} hover:bg-white/5 transition-all font-mono text-[10px] tracking-widest uppercase font-bold`}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={() => onClose(true)}
                                className={`px-8 py-2 border ${theme.border} ${theme.isDark ? 'bg-amber-500/10' : 'bg-sky-500/10'} ${theme.highlightText} hover:bg-white/5 transition-all font-mono text-[10px] tracking-widest uppercase font-bold border-l-4`}
                            >
                                {confirm ? 'Execute' : 'Acknowledged'}
                            </button>
                        </div>
                    </div>
                </SystemFrame>
            </div>
        </div>
    );
};

export default React.memo(SystemNotification);
