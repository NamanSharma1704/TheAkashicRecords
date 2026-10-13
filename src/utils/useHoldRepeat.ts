import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';

/** Delay before a held press starts repeating. */
const HOLD_DELAY_MS = 380;

/** Repeat interval by how long the press has been held: it speeds up the longer you hold. */
const repeatInterval = (heldMs: number) => (heldMs > 2200 ? 45 : heldMs > 1100 ? 80 : 130);

export interface HoldRepeatHandlers {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Press-and-hold repetition for a stepper button.
 *
 * `step` performs one increment and returns false when it can go no further (a bound was
 * reached), which stops the repeat. `release` is called once per press with whether the
 * press turned into a repeating hold, so the caller can commit immediately after a hold but
 * merge an ordinary tap with the taps around it.
 *
 * Mouse and pen step on press, which feels immediate. Touch steps on RELEASE (or when the
 * hold delay elapses): a finger that lands on the button only to start scrolling the page
 * ends in pointercancel, and must not have logged a chapter on the way.
 *
 * Keyboard activation does not reach this hook (pointer events only). The caller handles a
 * keyboard click, recognisable by `event.detail === 0`.
 *
 * The returned handlers keep one identity for the component's lifetime (they work through
 * refs), so they can be spread into memoised JSX without invalidating it.
 */
export function useHoldRepeat(step: () => boolean, release: (repeated: boolean) => void): HoldRepeatHandlers {
    const stepRef = useRef(step);
    const releaseRef = useRef(release);
    stepRef.current = step;
    releaseRef.current = release;

    const timers = useRef<{ delay: ReturnType<typeof setTimeout> | null; tick: ReturnType<typeof setTimeout> | null }>({ delay: null, tick: null });
    const press = useRef({ active: false, repeated: false, stepped: false, touch: false, startedAt: 0 });

    const handlers = useMemo<HoldRepeatHandlers>(() => {
        const clearTimers = () => {
            if (timers.current.delay) clearTimeout(timers.current.delay);
            if (timers.current.tick) clearTimeout(timers.current.tick);
            timers.current = { delay: null, tick: null };
        };

        const doStep = () => {
            const moved = stepRef.current();
            if (moved) {
                press.current.stepped = true;
                // A short tick under the finger; Android only (iOS Safari has no Vibration API).
                if (press.current.touch && typeof navigator.vibrate === 'function') navigator.vibrate(6);
            }
            return moved;
        };

        const scheduleTick = () => {
            const held = Date.now() - press.current.startedAt;
            timers.current.tick = setTimeout(() => {
                if (!press.current.active) return;
                press.current.repeated = true;
                if (!doStep()) return; // hit a bound: keep holding, but stop stepping
                scheduleTick();
            }, repeatInterval(held));
        };

        const end = (commit: boolean) => {
            const p = press.current;
            if (!p.active) return;
            p.active = false;
            clearTimers();
            // A touch tap that never reached the hold delay steps now, on release.
            if (commit && p.touch && !p.repeated && !p.stepped) doStep();
            if (p.stepped) releaseRef.current(p.repeated);
        };

        return {
            onPointerDown: (e) => {
                // An empty pointerType is not a pointer. motion's whileTap re-dispatches Enter
                // as a synthetic pointerdown (motion-dom firePointerEvent) with no type, and
                // the keyboard click has already stepped, so honouring it stepped twice per
                // key press. Real mouse, pen and touch events always carry a type.
                if (e.button !== 0 || !e.pointerType) return;
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* element detached */ }
                const touch = e.pointerType === 'touch';
                press.current = { active: true, repeated: false, stepped: false, touch, startedAt: Date.now() };
                if (!touch) doStep();
                timers.current.delay = setTimeout(() => {
                    if (!press.current.active) return;
                    press.current.repeated = true;
                    if (touch && !doStep()) return;
                    scheduleTick();
                }, HOLD_DELAY_MS);
            },
            onPointerUp: () => end(true),
            // Cancelled because the page took the gesture as a scroll: a mouse press already
            // stepped and is still committed; a touch press that never stepped commits nothing.
            onPointerCancel: () => end(false),
            onLostPointerCapture: () => end(true),
            // Long-press would otherwise raise the context menu / iOS callout mid-hold.
            onContextMenu: (e) => e.preventDefault(),
        };
    }, []);

    useEffect(() => () => {
        if (timers.current.delay) clearTimeout(timers.current.delay);
        if (timers.current.tick) clearTimeout(timers.current.tick);
    }, []);

    return handlers;
}
