export type SwipeDir = 'left' | 'right' | 'up' | 'down';

const IGNORE = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), .ed, .ui-modal, .ui-slider, [role=slider], [data-no-swipe]';
const AXIS = 12;
const THRESHOLD = 56;

export type SwipeOptions = {
    onswipe?: (dir: SwipeDir) => void;
    enabled?: boolean;
    // only claim this axis, so a parent swipe does not take the other one
    only?: 'x' | 'y';
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
    const slack = 4;
    if (dir === 'up') {
        return el.scrollTop + el.clientHeight < el.scrollHeight - slack;
    }
    if (dir === 'down') {
        return el.scrollTop > slack;
    }
    if (dir === 'left') {
        return el.scrollLeft + el.clientWidth < el.scrollWidth - slack;
    }
    return el.scrollLeft > slack;
}

function dirOf(dx: number, dy: number): SwipeDir {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

const EDGE = 32;

// horizontal / vertical swipes, ignored on inputs, editors, and matching scroll
export function swipe(node: HTMLElement, opts: SwipeOptions = {}) {
    let current = opts;
    let pid = -1;
    let x0 = 0;
    let y0 = 0;
    let start: HTMLElement | null = null;
    let captured = false;
    let done = false;
    let fromEdge = false;
    let axis: 'x' | 'y' | null = null;

    function reset() {
        if (pid !== -1 && captured) {
            try { node.releasePointerCapture(pid); } catch { /* already released */ }
        }
        pid = -1;
        start = null;
        captured = false;
        done = false;
        fromEdge = false;
        axis = null;
    }

    function begin(id: number, x: number, y: number, target: EventTarget | null) {
        if (current.enabled === false || pid !== -1) {
            return false;
        }
        const t = target instanceof HTMLElement ? target : null;
        if (t?.closest?.(IGNORE)) {
            return false;
        }
        pid = id;
        x0 = x;
        y0 = y;
        start = t;
        captured = false;
        done = false;
        fromEdge = x <= EDGE || x >= window.innerWidth - EDGE;
        axis = null;
        return true;
    }

    function track(x: number, y: number, ev?: { preventDefault(): void; cancelable?: boolean }, pointerId?: number) {
        if (pid === -1 || done) {
            return;
        }
        if (fromEdge && ev?.cancelable) {
            ev.preventDefault();
        }
        const dx = x - x0;
        const dy = y - y0;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (!captured) {
            if (adx < AXIS && ady < AXIS) {
                return;
            }
            const dir = dirOf(dx, dy);
            axis = adx > ady ? 'x' : 'y';
            if (current.only && current.only !== axis) {
                reset();
                return;
            }
            const sc = closestScrollable(start, axis);
            if (sc && canScroll(sc, dir)) {
                reset();
                return;
            }
            captured = true;
            if (pointerId !== undefined) {
                try { node.setPointerCapture(pointerId); } catch { /* not yet attached */ }
            }
        }
        if (ev?.cancelable) {
            ev.preventDefault();
        }
        if (Math.max(adx, ady) >= THRESHOLD) {
            done = true;
            current.onswipe?.(dirOf(dx, dy));
        }
    }

    function down(e: PointerEvent) {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
            return;
        }
        begin(e.pointerId, e.clientX, e.clientY, e.target);
    }

    function move(e: PointerEvent) {
        if (e.pointerId !== pid) {
            return;
        }
        track(e.clientX, e.clientY, e, e.pointerId);
    }

    function up(e: PointerEvent) {
        if (e.pointerId === pid) {
            reset();
        }
    }

    function touchStart(e: TouchEvent) {
        const t = e.changedTouches[0];
        if (!t) {
            return;
        }
        begin(t.identifier, t.clientX, t.clientY, e.target);
    }

    function touchMove(e: TouchEvent) {
        if (pid === -1) {
            return;
        }
        const t = [...e.touches].find((n) => n.identifier === pid) ?? e.touches[0];
        if (!t) {
            return;
        }
        track(t.clientX, t.clientY, e);
    }

    function touchEnd(e: TouchEvent) {
        if (pid === -1) {
            return;
        }
        if (![...e.changedTouches].some((n) => n.identifier === pid)) {
            return;
        }
        reset();
    }

    const listen = { capture: true } as const;
    const touchMoveListen = { capture: true, passive: false } as const;
    node.setAttribute('data-swipe', '');
    node.addEventListener('pointerdown', down, listen);
    node.addEventListener('pointermove', move, listen);
    node.addEventListener('pointerup', up, listen);
    node.addEventListener('pointercancel', up, listen);
    node.addEventListener('touchstart', touchStart, listen);
    node.addEventListener('touchmove', touchMove, touchMoveListen);
    node.addEventListener('touchend', touchEnd, listen);
    node.addEventListener('touchcancel', touchEnd, listen);

    return {
        update(o: SwipeOptions) {
            current = o;
        },
        destroy() {
            node.removeAttribute('data-swipe');
            node.removeEventListener('pointerdown', down, listen);
            node.removeEventListener('pointermove', move, listen);
            node.removeEventListener('pointerup', up, listen);
            node.removeEventListener('pointercancel', up, listen);
            node.removeEventListener('touchstart', touchStart, listen);
            node.removeEventListener('touchmove', touchMove, touchMoveListen);
            node.removeEventListener('touchend', touchEnd, listen);
            node.removeEventListener('touchcancel', touchEnd, listen);
            reset();
        },
    };
}
