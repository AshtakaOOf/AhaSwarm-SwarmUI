import { MOBILE_MQ } from '../state/ui.svelte';

const EDGE = 32;
const AXIS = 12;
const EDIT = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .ed';

function canScrollX(start: EventTarget | null, dx: number): boolean {
    let n = start instanceof HTMLElement ? start : null;
    while (n && n !== document.body) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll' || ox === 'overlay') && n.scrollWidth > n.clientWidth + 1) {
            if (dx < 0 && n.scrollLeft + n.clientWidth < n.scrollWidth - 1) {
                return true;
            }
            if (dx > 0 && n.scrollLeft > 0) {
                return true;
            }
        }
        n = n.parentElement;
    }
    return false;
}

// block browser back/forward shortcuts and edge-swipe navigation
export function installNavGuard(): () => void {
    const mq = typeof matchMedia === 'function' ? matchMedia(MOBILE_MQ) : null;
    let x0 = 0;
    let y0 = 0;
    let edge = false;

    function onKey(e: KeyboardEvent) {
        if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
        }
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(EDIT)) {
            return;
        }
        e.preventDefault();
    }

    function onMouse(e: MouseEvent) {
        if (e.button === 3 || e.button === 4) {
            e.preventDefault();
        }
    }

    function onTouchStart(e: TouchEvent) {
        if (!mq?.matches) {
            edge = false;
            return;
        }
        const t = e.touches[0];
        const el = e.target instanceof HTMLElement ? e.target : null;
        if (!t || e.touches.length !== 1 || el?.closest?.('[data-swipe]')) {
            edge = false;
            return;
        }
        x0 = t.clientX;
        y0 = t.clientY;
        edge = x0 <= EDGE || x0 >= window.innerWidth - EDGE;
    }

    function onTouchMove(e: TouchEvent) {
        const el = e.target instanceof HTMLElement ? e.target : null;
        if (el?.closest?.('[data-swipe]')) {
            edge = false;
            return;
        }
        if (!edge || !e.cancelable || e.touches.length !== 1) {
            return;
        }
        const t = e.touches[0];
        const dx = t.clientX - x0;
        const dy = t.clientY - y0;
        if (Math.abs(dx) < AXIS && Math.abs(dy) < AXIS) {
            return;
        }
        if (Math.abs(dx) > Math.abs(dy) && !canScrollX(e.target, dx)) {
            e.preventDefault();
        }
        else {
            edge = false;
        }
    }

    const touchMove = { capture: true, passive: false } as const;
    const capture = { capture: true } as const;
    window.addEventListener('keydown', onKey, capture);
    window.addEventListener('mouseup', onMouse, capture);
    window.addEventListener('auxclick', onMouse, capture);
    window.addEventListener('touchstart', onTouchStart, capture);
    window.addEventListener('touchmove', onTouchMove, touchMove);
    return () => {
        window.removeEventListener('keydown', onKey, capture);
        window.removeEventListener('mouseup', onMouse, capture);
        window.removeEventListener('auxclick', onMouse, capture);
        window.removeEventListener('touchstart', onTouchStart, capture);
        window.removeEventListener('touchmove', onTouchMove, touchMove);
    };
}
