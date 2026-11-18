export type SwipeDir = 'left' | 'right' | 'up' | 'down';

export type SwipeInfo = {
    dir: SwipeDir;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
};

const IGNORE = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), .ed, .ui-modal, .ui-slider, [role=slider], [data-no-swipe]';
const AXIS = 12;
const THRESHOLD = 56;
const VEL_MS = 80;
const FLICK = 0.15;

export type SwipeOptions = {
    onswipe?: (dir: SwipeDir) => void;
    onmove?: (info: SwipeInfo) => void;
    onend?: (info: SwipeInfo) => void;
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

function dirOf(dx: number, dy: number, axis?: 'x' | 'y' | null): SwipeDir {
    if (axis === 'x') {
        return dx >= 0 ? 'right' : 'left';
    }
    if (axis === 'y') {
        return dy >= 0 ? 'down' : 'up';
    }
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

const EDGE = 32;

// horizontal / vertical swipes, ignored on inputs, editors, and matching scroll
export function swipe(node: HTMLElement, opts: SwipeOptions = {}) {
    let current = opts;
    let pid = -1;
    let x0 = 0;
    let y0 = 0;
    let x1 = 0;
    let y1 = 0;
    let start: HTMLElement | null = null;
    let captured = false;
    let done = false;
    let fromEdge = false;
    let axis: 'x' | 'y' | null = null;
    let samples: { t: number; x: number; y: number }[] = [];
    let t0 = 0;
    let listening = false;

    function velocity() {
        const now = performance.now();
        const overallDt = Math.max(1, now - t0);
        const overall = { vx: (x1 - x0) / overallDt, vy: (y1 - y0) / overallDt };
        if (samples.length < 2) {
            return overall;
        }
        const a = samples[0], b = samples[samples.length - 1];
        const dt = b.t - a.t;
        if (dt < 16) {
            return overall;
        }
        const recent = { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
        // a short flick that ended still should count, even if the last samples barely moved
        if (Math.hypot(recent.vx, recent.vy) < FLICK && overallDt < 320) {
            return overall;
        }
        return recent;
    }

    function sample(x: number, y: number) {
        const t = performance.now();
        samples.push({ t, x, y });
        const cut = t - VEL_MS;
        while (samples.length > 1 && samples[0].t < cut) {
            samples.shift();
        }
    }

    function info(): SwipeInfo {
        const dx = x1 - x0;
        const dy = y1 - y0;
        return { dir: dirOf(dx, dy, axis), dx, dy, ...velocity() };
    }

    function unlisten() {
        if (!listening) {
            return;
        }
        listening = false;
        removeEventListener('pointermove', move, listen);
        removeEventListener('pointerup', up, listen);
        removeEventListener('pointercancel', up, listen);
        removeEventListener('touchmove', touchMove, touchMoveListen);
        removeEventListener('touchend', touchEnd, listen);
        removeEventListener('touchcancel', touchEnd, listen);
    }

    function listenWin() {
        if (listening) {
            return;
        }
        listening = true;
        addEventListener('pointermove', move, listen);
        addEventListener('pointerup', up, listen);
        addEventListener('pointercancel', up, listen);
        addEventListener('touchmove', touchMove, touchMoveListen);
        addEventListener('touchend', touchEnd, listen);
        addEventListener('touchcancel', touchEnd, listen);
    }

    function reset() {
        unlisten();
        if (pid !== -1 && captured) {
            try { node.releasePointerCapture(pid); } catch { /* already released */ }
        }
        pid = -1;
        start = null;
        captured = false;
        done = false;
        fromEdge = false;
        axis = null;
        samples = [];
        t0 = 0;
    }

    function finish() {
        if (captured && current.onend) {
            current.onend(info());
        }
        reset();
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
        x0 = x1 = x;
        y0 = y1 = y;
        start = t;
        captured = false;
        done = false;
        fromEdge = x <= EDGE || x >= window.innerWidth - EDGE;
        axis = null;
        t0 = performance.now();
        samples = [{ t: t0, x, y }];
        listenWin();
        return true;
    }

    function track(x: number, y: number, ev?: { preventDefault(): void; cancelable?: boolean }, pointerId?: number) {
        if (pid === -1 || done) {
            return;
        }
        const dx = x - x0;
        const dy = y - y0;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (!captured) {
            if (adx < AXIS && ady < AXIS) {
                x1 = x;
                y1 = y;
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
            // only block edge back-nav once this is clearly a horizontal swipe
            if (fromEdge && axis === 'x' && ev?.cancelable) {
                ev.preventDefault();
            }
            captured = true;
            if (pointerId !== undefined) {
                try { node.setPointerCapture(pointerId); } catch { /* not yet attached */ }
            }
        }
        x1 = x;
        y1 = y;
        sample(x, y);
        if (ev?.cancelable) {
            ev.preventDefault();
        }
        if (current.onmove) {
            current.onmove(info());
            return;
        }
        if (Math.max(adx, ady) >= THRESHOLD) {
            done = true;
            current.onswipe?.(dirOf(dx, dy, axis));
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
        if (e.pointerId !== pid) {
            return;
        }
        finish();
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
        const t = [...e.changedTouches].find((n) => n.identifier === pid);
        if (!t) {
            return;
        }
        finish();
    }

    const listen = { capture: true } as const;
    const touchMoveListen = { capture: true, passive: false } as const;
    node.setAttribute('data-swipe', '');
    node.addEventListener('pointerdown', down, listen);
    node.addEventListener('touchstart', touchStart, listen);

    return {
        update(o: SwipeOptions) {
            current = o;
        },
        destroy() {
            node.removeAttribute('data-swipe');
            node.removeEventListener('pointerdown', down, listen);
            node.removeEventListener('touchstart', touchStart, listen);
            reset();
        },
    };
}
