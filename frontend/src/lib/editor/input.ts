import { ctxOf } from './layer';
import type { Editor } from './editor.svelte';
import { begin, cancelAction, continueAction, finish } from './tools.svelte';
import { BRUSH_TOOLS, MAX_ZOOM, MIN_ZOOM, type Pt } from './types';

export function attach(this: Editor, canvas: HTMLCanvasElement): () => void {
    this.detach?.();
    this.canvas = canvas;
    this.ctx = ctxOf(canvas);
    const cs = getComputedStyle(canvas);
    this.checkA = cs.getPropertyValue('--editor-check-a').trim() || this.checkA;
    this.checkB = cs.getPropertyValue('--editor-check-b').trim() || this.checkB;
    const opts = { passive: false } as AddEventListenerOptions;
    const down = (e: PointerEvent) => onDown.call(this, e);
    const move = (e: PointerEvent) => onMove.call(this, e);
    const up = (e: PointerEvent) => onUp.call(this, e);
    const wheel = (e: WheelEvent) => onWheel.call(this, e);
    const leave = () => { this.hover = null; this.render(); };
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down, opts);
    canvas.addEventListener('pointermove', move, opts);
    canvas.addEventListener('pointerup', up, opts);
    canvas.addEventListener('pointercancel', up, opts);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, opts);
    canvas.addEventListener('contextmenu', noMenu);
    this.antsTimer = window.setInterval(() => {
        if (this.selection || this.action?.kind === 'select') {
            this.antsOffset = (this.antsOffset + 1) % 8;
            this.render();
        }
    }, 120);
    const detach = () => {
        if (this.detach !== detach) {
            return;
        }
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('wheel', wheel);
        canvas.removeEventListener('contextmenu', noMenu);
        window.clearInterval(this.antsTimer);
        this.antsTimer = 0;
        if (this.frame) {
            cancelAnimationFrame(this.frame);
            this.frame = 0;
        }
        cancelAction.call(this);
        this.canvas = null;
        this.ctx = null;
        this.detach = null;
    };
    this.detach = detach;
    return detach;
}

export function resize(this: Editor, w: number, h: number): void {
    if (!this.canvas) {
        return;
    }
    const first = !this.viewW;
    this.dpr = window.devicePixelRatio || 1;
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    if (first) {
        this.fit();
    }
    this.renderNow();
}

export function fit(this: Editor): void {
    if (!this.viewW || !this.width) {
        return;
    }
    const pad = 16;
    this.zoom = Math.min((this.viewW - pad * 2) / this.width, (this.viewH - pad * 2) / this.height, 8);
    this.panX = (this.viewW - this.width * this.zoom) / 2;
    this.panY = (this.viewH - this.height * this.zoom) / 2;
    this.render();
}

export function zoomBy(this: Editor, factor: number, at?: Pt): void {
    const p = at ?? { x: this.viewW / 2, y: this.viewH / 2 };
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    this.panX = p.x - ((p.x - this.panX) * z) / this.zoom;
    this.panY = p.y - ((p.y - this.panY) * z) / this.zoom;
    this.zoom = z;
    this.render();
}

export function setZoom(this: Editor, z: number): void {
    zoomBy.call(this, z / this.zoom);
}

export function toDoc(this: Editor, p: Pt): Pt {
    return { x: (p.x - this.panX) / this.zoom, y: (p.y - this.panY) / this.zoom };
}

export function local(this: Editor, e: PointerEvent | WheelEvent): Pt {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function setKeyState(this: Editor, key: 'space' | 'alt', down: boolean): void {
    if (key === 'space') {
        this.spaceDown = down;
    }
    else {
        this.altDown = down;
    }
    this.render();
}

export function cursor(this: Editor): string {
    if (this.xform && !this.spaceDown && this.action?.kind !== 'pan') {
        const h = this.action?.kind === 'xform' ? this.action.handle : this.hover && this.xform.hit(toDoc.call(this, this.hover), 9 / this.zoom);
        if (!h) return 'default';
        if (h.kind === 'scale') return h.hx && h.hy ? (h.hx === h.hy ? 'nwse-resize' : 'nesw-resize') : h.hx ? 'ew-resize' : 'ns-resize';
        return h.kind === 'rotate' ? 'alias' : h.kind === 'point' ? 'pointer' : 'move';
    }
    if (this.tool === 'text') {
        return 'text';
    }
    if (this.action?.kind === 'pan' || this.tool === 'hand' || this.spaceDown) {
        return this.action?.kind === 'pan' ? 'grabbing' : 'grab';
    }
    if (this.altDown || this.tool === 'eyedropper' || this.tool === 'fill') {
        return 'crosshair';
    }
    if (this.tool === 'move') {
        return 'move';
    }
    return BRUSH_TOOLS.includes(this.tool) || this.tool === 'liquify' ? 'none' : 'crosshair';
}

export function onDown(this: Editor, e: PointerEvent): void {
    if (!this.width) {
        return;
    }
    e.preventDefault();
    try {
        this.canvas!.setPointerCapture(e.pointerId);
    }
    catch {
        // synthetic or already-released pointers can't be captured; drawing still works without it
    }
    const p = local.call(this, e);
    this.pointers.set(e.pointerId, { ...p, type: e.pointerType });
    if (e.pointerType === 'pen') {
        this.penSeen = true;
    }
    const touches = [...this.pointers.values()].filter(q => q.type === 'touch');
    if (e.pointerType === 'touch' && touches.length >= 2) {
        // a second finger turns whatever the first one started into a pinch
        if (this.action?.kind === 'stroke' && this.action.touch || this.action?.kind === 'pick' || this.action?.kind === 'pan') {
            cancelAction.call(this);
        }
        if (!this.action) {
            const [a, b] = touches;
            this.action = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        }
        return;
    }
    if (this.action) {
        return;
    }
    // with a pen around, fingers only navigate (palm rejection)
    if (e.button === 1 || e.button === 2 || this.spaceDown || this.tool === 'hand' || (e.pointerType === 'touch' && this.penSeen)) {
        this.action = { kind: 'pan', last: p };
        this.render();
        return;
    }
    if (e.button !== 0) {
        return;
    }
    if (this.xform) {
        const d = toDoc.call(this, p), h = this.xform.hit(d, (e.pointerType === 'touch' ? 20 : 9) / this.zoom);
        if (h) {
            this.action = { kind: 'xform', handle: h, snap: this.xform.snapshot(), from: d };
        }
        return;
    }
    begin.call(this, this.altDown && this.tool !== 'move' && this.tool !== 'text' ? 'eyedropper' : this.tool, toDoc.call(this, p), e);
}

export function onMove(this: Editor, e: PointerEvent): void {
    const p = local.call(this, e);
    if (this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { ...p, type: e.pointerType });
    }
    if (e.pointerType !== 'touch') {
        this.hover = p;
    }
    const a = this.action;
    if (!a) {
        this.render();
        return;
    }
    e.preventDefault();
    if (a.kind === 'pinch') {
        const t = [...this.pointers.values()].filter(q => q.type === 'touch');
        if (t.length < 2) {
            return;
        }
        const dist = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y), mid = { x: (t[0].x + t[1].x) / 2, y: (t[0].y + t[1].y) / 2 };
        this.panX += mid.x - a.mid.x;
        this.panY += mid.y - a.mid.y;
        if (a.dist > 0 && dist > 0) {
            zoomBy.call(this, dist / a.dist, mid);
        }
        a.dist = dist;
        a.mid = mid;
        this.render();
        return;
    }
    if (a.kind === 'pan') {
        this.panX += p.x - a.last.x;
        this.panY += p.y - a.last.y;
        a.last = p;
        this.render();
        return;
    }
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) {
        continueAction.call(this, toDoc.call(this, local.call(this, ev)), ev);
    }
    this.render();
}

export function onUp(this: Editor, e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    const a = this.action;
    if (!a) {
        return;
    }
    if (a.kind === 'pinch') {
        if (![...this.pointers.values()].some(q => q.type === 'touch')) {
            this.action = null;
        }
        return;
    }
    if (e.type === 'pointercancel') {
        cancelAction.call(this);
        return;
    }
    finish.call(this);
}

export function onWheel(this: Editor, e: WheelEvent): void {
    if (!this.width) {
        return;
    }
    e.preventDefault();
    const p = local.call(this, e);
    // trackpad two-finger scroll pans; ctrl+wheel (also trackpad pinch) and plain mouse wheel zoom
    if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0) {
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
        this.render();
        return;
    }
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomBy.call(this, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p);
}

export function pressure(this: Editor, e: PointerEvent): number {
    return e.pointerType === 'pen' ? Math.max(0.01, e.pressure || 0) : 1;
}
