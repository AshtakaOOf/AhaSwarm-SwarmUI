export type SwipeDir = 'left' | 'right' | 'up' | 'down';

const IGNORE = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), .ed, .ui-modal, .ui-slider, [role=slider], [data-no-swipe]';
const AXIS = 12;
const THRESHOLD = 56;

export type SwipeOptions = {
    onswipe?: (dir: SwipeDir) => void;
    enabled?: boolean;
};

function closestScrollable(el: HTMLElement | null, axis: 'x' | 'y'): HTMLElement | null {
    let n: HTMLElement | null = el;
    while (n && n !== document.body) {
        const st = getComputedStyle(n);
        const overflow = axis === 'y' ? st.overflowY : st.overflowX;
        if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay')) {
            if (axis === 'y' && n.scrollHeight > n.clientHeight + 1) {
                return n;
            }
            if (axis === 'x' && n.scrollWidth > n.clientWidth + 1) {
                return n;
            }
        }
        n = n.parentElement;
    }
    return null;
}

function canScroll(el: HTMLElement, dir: SwipeDir): boolean {
    if (dir === 'up') {
        return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    }
    if (dir === 'down') {
        return el.scrollTop > 0;
    }
    if (dir === 'left') {
        return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    }
    return el.scrollLeft > 0;
}

function dirOf(dx: number, dy: number): SwipeDir {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// horizontal / vertical swipes, ignored on inputs, editors, and matching scroll
export function swipe(node: HTMLElement, opts: SwipeOptions = {}) {
    let current = opts;
    let pid = -1;
    let x0 = 0;
    let y0 = 0;
    let start: HTMLElement | null = null;
    let captured = false;
    let done = false;

    function reset() {
        if (pid !== -1 && captured) {
            try { node.releasePointerCapture(pid); } catch { /* already released */ }
        }
        pid = -1;
        start = null;
        captured = false;
        done = false;
    }

    function down(e: PointerEvent) {
        if (current.enabled === false || (e.pointerType !== 'touch' && e.pointerType !== 'pen') || pid !== -1) {
            return;
        }
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(IGNORE)) {
            return;
        }
        pid = e.pointerId;
        x0 = e.clientX;
        y0 = e.clientY;
        start = t;
        captured = false;
        done = false;
    }

    function move(e: PointerEvent) {
        if (e.pointerId !== pid || done) {
            return;
        }
        const dx = e.clientX - x0;
        const dy = e.clientY - y0;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (!captured) {
            if (adx < AXIS && ady < AXIS) {
                return;
            }
            const dir = dirOf(dx, dy);
            const axis = adx > ady ? 'x' : 'y';
            const sc = closestScrollable(start, axis);
            if (sc && canScroll(sc, dir)) {
                reset();
                return;
            }
            captured = true;
            try { node.setPointerCapture(e.pointerId); } catch { /* not yet attached */ }
            if (axis === 'x') {
                e.preventDefault();
            }
        }
        if (Math.max(adx, ady) >= THRESHOLD) {
            done = true;
            current.onswipe?.(dirOf(dx, dy));
        }
    }

    function up(e: PointerEvent) {
        if (e.pointerId === pid) {
            reset();
        }
    }

    const listen = { capture: true } as const;
    node.addEventListener('pointerdown', down, listen);
    node.addEventListener('pointermove', move, listen);
    node.addEventListener('pointerup', up, listen);
    node.addEventListener('pointercancel', up, listen);

    return {
        update(o: SwipeOptions) {
            current = o;
        },
        destroy() {
            node.removeEventListener('pointerdown', down, listen);
            node.removeEventListener('pointermove', move, listen);
            node.removeEventListener('pointerup', up, listen);
            node.removeEventListener('pointercancel', up, listen);
            reset();
        },
    };
}
