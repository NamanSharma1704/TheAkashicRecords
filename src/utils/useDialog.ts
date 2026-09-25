import { RefObject, useEffect, useRef } from 'react';

/**
 * Keyboard behaviour for a modal surface: focus moves in when it opens, Tab is trapped
 * inside it, Escape closes it, and focus returns to wherever it was when it closes.
 *
 * Dialogs stack here — the Detail view opens the Gate editor over itself, and the Profile
 * raises confirmations — so only the TOPMOST open dialog answers the keyboard. Before
 * this, each overlay listened on `document` independently, and one Escape closed every
 * layer at once.
 *
 * `onClose` is read through a ref. Callers pass inline arrows, and depending on one
 * re-ran the effect on every parent render; the Detail view did exactly that, and because
 * the effect moves focus on entry, a keyboard user's focus was pulled back to the dialog
 * shell every time the guest countdown ticked.
 */
const stack: symbol[] = [];

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export const useDialog = (
    ref: RefObject<HTMLElement>,
    open: boolean,
    onClose: () => void,
    initialFocus?: RefObject<HTMLElement>,
) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const id = Symbol('dialog');
        stack.push(id);
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const node = ref.current;
        (initialFocus?.current ?? node)?.focus({ preventScroll: true });

        const onKey = (e: KeyboardEvent) => {
            if (stack[stack.length - 1] !== id || !node) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            // Rendered focusables only. getClientRects is empty inside a display:none
            // subtree; offsetParent would also be null for a position:fixed control.
            const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
                .filter(el => el.getClientRects().length > 0 || el === document.activeElement);
            if (items.length === 0) { e.preventDefault(); return; }
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === node)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !node.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            const at = stack.indexOf(id);
            if (at !== -1) stack.splice(at, 1);
            // Only hand focus back if it is still inside this dialog (or lost to <body>);
            // a dialog opened on top may already own it.
            const current = document.activeElement;
            if (!current || current === document.body || (node && node.contains(current))) {
                previouslyFocused?.focus?.({ preventScroll: true });
            }
        };
        // ref and initialFocus are stable refs; onClose is read through onCloseRef.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
};
