import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Share2, X } from 'lucide-react';
import { Theme } from '../../core/types';
import { useDialogFocus } from '../../utils/useDialogFocus';
import { CARD_H, CARD_W, HunterCardData, renderHunterCard } from './hunterCard';

interface HunterCardDialogProps {
    theme: Theme;
    data: HunterCardData;
    onClose: () => void;
}

/**
 * HUNTER CARD: the profile as one image (rank, title, EXP, stats, top series) to post or
 * send. Painted in the browser on a canvas at link-preview size; nothing is uploaded. Share
 * hands the PNG to the device's share sheet where it takes files (phones, mostly); Download
 * works everywhere.
 */
const HunterCardDialog: React.FC<HunterCardDialogProps> = ({ theme, data, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [png, setPng] = useState<{ blob: Blob; url: string } | null>(null);
    const [failed, setFailed] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    useDialogFocus(ref, true, onClose);

    // Painted once per open; the dialog is mounted afresh each time, with that moment's data.
    const dataRef = useRef(data);
    useEffect(() => {
        let alive = true;
        let url: string | null = null;
        renderHunterCard(dataRef.current, { accent: theme.accentColor, plateInk: theme.accentPlateInk })
            .then(blob => {
                if (!alive) return;
                url = URL.createObjectURL(blob);
                setPng({ blob, url });
            })
            .catch(() => { if (alive) setFailed(true); });
        return () => {
            alive = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [theme.accentColor, theme.accentPlateInk]);

    const fileName = `hunter-card-${data.username.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'hunter'}.png`;
    const file = png ? new File([png.blob], fileName, { type: 'image/png' }) : null;
    const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    const download = () => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = png.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNote('Saved to your downloads.');
    };
    const share = async () => {
        if (!file) return;
        try {
            await navigator.share({ files: [file], title: 'Hunter Card', text: `${data.rank} of The Akashic Records` });
        } catch (e) {
            // Closing the share sheet is a choice, not a failure.
            if ((e as DOMException)?.name !== 'AbortError') setNote('Sharing failed. Download the card instead.');
        }
    };

    const actionClass = 'hud hud-btn hud-accent h-9 px-3 flex items-center gap-2 font-mono text-[10px] font-bold tracking-widest uppercase disabled:opacity-50 disabled:cursor-wait text-accent-ink';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hunter-card-title"
            tabIndex={-1}
            className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 outline-none"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`hud hud-shell w-full max-w-3xl ${theme.isDark ? 'bg-[#0a0a0a]' : 'bg-white'} overflow-hidden`}
            >
                <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${theme.borderSubtle}`}>
                    <h3 id="hunter-card-title" className={`font-orbitron text-sm font-bold tracking-[0.2em] uppercase ${theme.headingText}`}>Hunter Card</h3>
                    <button type="button" onClick={onClose} aria-label="Close" title="Close" className={`hud hud-tool hud-ghost w-8 h-8 flex items-center justify-center ${theme.mutedText}`}>
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
                <div className="p-4 flex flex-col gap-3">
                    {/* Held at the card's own proportions so nothing jumps when it lands. */}
                    <div className={`relative w-full overflow-hidden border ${theme.borderSubtle}`} style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
                        {png ? (
                            <img src={png.url} alt={`Hunter Card: ${data.rank}${data.title ? `, ${data.title}` : ''}, ${data.exp.toLocaleString()} EXP, ${data.series} series.`} className="absolute inset-0 w-full h-full" />
                        ) : (
                            <div className={`absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-widest uppercase ${theme.mutedText} ${failed ? '' : 'animate-pulse'}`} role="status">
                                {failed ? 'The card could not be drawn in this browser.' : 'Forging card…'}
                            </div>
                        )}
                    </div>
                    <p className={`font-mono text-[11px] leading-relaxed ${theme.mutedText}`}>
                        Drawn on this device from your profile. Nothing is uploaded until you share it.
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {note && <span role="status" className={`mr-auto font-mono text-[11px] ${theme.mutedText}`}>{note}</span>}
                        {canShare && (
                            <button type="button" onClick={() => { void share(); }} className={actionClass}>
                                <Share2 size={13} aria-hidden="true" /> Share
                            </button>
                        )}
                        <button type="button" onClick={download} disabled={!png} className={actionClass}>
                            <Download size={13} aria-hidden="true" /> Download PNG
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default HunterCardDialog;
