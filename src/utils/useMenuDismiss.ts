import React, { useEffect } from 'react';

/**
 * A toolbar dropdown's dismissal. While it is open, a press outside it closes it, and Escape
 * closes the menu alone, handing focus back to its button: Escape is caught on window in the
 * capture phase, ahead of the profile's own document listener, wherever focus happens to be.
 */
export const useMenuDismiss = (open: boolean, setOpen: (open: boolean) => void, ref: React.RefObject<HTMLDivElement>) => {
    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
            ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        };
        document.addEventListener('pointerdown', close);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('pointerdown', close);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open, setOpen, ref]);
};
