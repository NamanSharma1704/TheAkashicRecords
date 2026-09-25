import { RefObject, useEffect, useRef } from 'react';

/**
 * Dialog keyboard behaviour: move focus into the dialog when it opens, keep Tab inside
 * it, close on Escape, and hand focus back to whatever held it before.
 *
 * Dialogs here nest — ManhwaDetail opens the gate editor, whose purge button raises a
 * confirmation on top of both — and every one of them listens on `document`. Without
 * coordination a single Escape reached all three and closed the whole stack, and Tab was
 * trapped by whichever registered first. So open dialogs form a stack, and only the
 * topmost one acts on a key.
 */
const stack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const useDialogFocus = (
    ref: RefObject<HTMLElement>,
    active: boolean,
    onClose: () => void,
    /** Element to focus on open. Defaults to the dialog container itself. */
    initialFocus?: RefObject<HTMLElement>,
) => {
    // Read through a ref so a parent passing a fresh arrow each render does not tear the
    // dialog down and re-run the focus handoff on every render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        if (!active) return;
        const token = Symbol('dialog');
        stack.push(token);
        const node = ref.current;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        (initialFocus?.current ?? node)?.focus({ preventScroll: true });

        const handleKey = (e: KeyboardEvent) => {
            if (stack[stack.length - 1] !== token) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !node) return;
            // "Rendered" means it has layout boxes. offsetParent would also be null for any
            // position:fixed control, which would silently drop it out of the trap.
            const focusables = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
                .filter(el => el.getClientRects().length > 0 || el === document.activeElement);
            if (focusables.length === 0) { e.preventDefault(); return; }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const inside = node.contains(document.activeElement);
            if (e.shiftKey && (document.activeElement === first || !inside)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('keydown', handleKey);
            const i = stack.indexOf(token);
            if (i !== -1) stack.splice(i, 1);
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
        // `initialFocus` is a ref object and stable; only opening/closing re-runs this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, ref]);
};
