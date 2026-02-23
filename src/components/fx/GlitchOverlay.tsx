import React, { useEffect, useState } from 'react';

interface GlitchOverlayProps {
    isActive: boolean;
    duration?: number;
    onComplete?: () => void;
}

const GlitchOverlay: React.FC<GlitchOverlayProps> = ({ isActive, duration = 300, onComplete }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isActive) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                onComplete?.();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isActive, duration, onComplete]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden bg-white/5">
            <div className="absolute inset-0 animate-glitch mix-blend-overlay opacity-30 bg-[#00ffff]" />
            <div className="absolute inset-0 animate-glitch mix-blend-overlay opacity-30 bg-[#ff00ff] [animation-delay:-0.1s]" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]" />
        </div>
    );
};

export default GlitchOverlay;
