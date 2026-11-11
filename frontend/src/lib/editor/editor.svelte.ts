import { Stroke, type BrushKind, type BrushSettings } from './brush';
import { hexToRgb, rgbToHex } from './color';
import { History, pixelEntry } from './history';
import { Layer, clipRect, ctxOf, makeCanvas, unionRect, type Ctx, type Rect } from './layer';
import { floodFill, LiquifyWarp } from './pixels';
import { Selection, type SelectionShape } from './selection';
import { renderText, textBounds, type TextSpec, type TextStyle } from './text';
import { Transform, type XHandle } from './transform';

export type ToolId = 'brush' | 'airbrush' | 'eraser' | 'eyedropper' | 'fill' | 'lassofill' | 'rect' | 'ellipse' | 'lasso' | 'move' | 'liquify' | 'text' | 'hand';

const BRUSH_TOOLS: ToolId[] = ['brush', 'airbrush', 'eraser'];
const MIN_ZOOM = 0.02, MAX_ZOOM = 32;

interface Pt { x: number; y: number }
interface PointerInfo extends Pt { type: string }

type Action =
    | { kind: 'stroke'; layer: Layer; stroke: Stroke; timer: number; touch: boolean }
    | { kind: 'pan'; last: Pt }
    | { kind: 'pinch'; dist: number; mid: Pt }
    | { kind: 'pick' }
    | { kind: 'select'; shape: SelectionShape; fill?: Layer }
    | { kind: 'move'; layer: Layer; start: Pt; ox: number; oy: number; float: HTMLCanvasElement | null; dx: number; dy: number }
    | { kind: 'liquify'; layer: Layer; last: Pt; dirty: Rect | null; warp: LiquifyWarp }
    | { kind: 'xform'; handle: XHandle; snap: ReturnType<Transform['snapshot']>; from: Pt }
    | { kind: 'textmove'; layer: Layer; start: Pt; ox: number; oy: number };

/** classic ImageEditor, rebuilt: layers + mask layers, painting tools, selection and export to init image / mask */
export class Editor {
    tool = $state<ToolId>('brush');
    color = $state('#000000');
    color2 = $state('#ffffff');
    recentColors = $state<string[]>([]);
    brushes = $state<Record<BrushKind, BrushSettings>>({
        brush: { size: 12, opacity: 1, hardness: 1, flow: 1, pressureSize: true, pressureFlow: false },
        airbrush: { size: 80, opacity: 1, hardness: 0, flow: 0.25, pressureSize: false, pressureFlow: true },
        eraser: { size: 30, opacity: 1, hardness: 1, flow: 1, pressureSize: true, pressureFlow: false },
    });
    fill = $state({ tolerance: 32, allLayers: true, expand: 2 });
    liquify = $state({ size: 90, strength: 0.5 });
    layers = $state.raw<Layer[]>([]);
    activeId = $state(0);
    /** other layers selected along with the active one (Ctrl / Shift + click, or select mode) */
    extraSel = $state<number[]>([]);
    rev = $state(0);
    canUndo = $state(false);
    canRedo = $state(false);
    zoom = $state(1);
    hasSelection = $state(false);
    width = $state(0);
    height = $state(0);
    /** the piece being transformed (Ctrl+T); other tools wait until it's applied or cancelled */
    xform = $state.raw<Transform | null>(null);
    xformRev = $state(0);
    editingText = $state<number | null>(null);
    hasClipboard = $state(false);
    textStyle = $state<TextStyle>({ font: 'sans-serif', size: 48, bold: false, italic: false, align: 'left', lineHeight: 1.2, strokeWidth: 0 });

    private canvas: HTMLCanvasElement | null = null;
    private ctx: Ctx | null = null;
    private viewW = 0;
    private viewH = 0;
    private dpr = 1;
    private panX = 0;
    private panY = 0;
    private history = new History(40, () => {
        this.canUndo = this.history.canUndo;
        this.canRedo = this.history.canRedo;
    });
    private selection: Selection | null = null;
    private clip: { canvas: HTMLCanvasElement; x: number; y: number; isMask: boolean; name: string; text?: TextSpec } | null = null;
    /** set when the window loses focus after a copy: the system clipboard may now hold something from another app */
    clipMaybeStale = false;
    private xsession: { layer: Layer; sel: Selection | null } | null = null;
    private textSession: { layer: Layer; isNew: boolean; before: TextSpec } | null = null;
    onNotice: ((msg: string) => void) | null = null;
    private backup: HTMLCanvasElement | null = null;
    private scratch = makeCanvas(1, 1);
    private scratch2 = makeCanvas(1, 1);
    private maskView = makeCanvas(1, 1);
    private pointers = new Map<number, PointerInfo>();
    private action: Action | null = null;
    private penSeen = false;
    private spaceDown = false;
    private altDown = false;
    private hover: Pt | null = null;
    private frame = 0;
    private antsTimer = 0;
    private antsOffset = 0;
    private checkA = '#3a3a3a';
    private checkB = '#2e2e2e';

    private setActive(id: number): void {
        this.activeId = id;
        this.extraSel = [];
    }

    /** layer list click: replace the selection, toggle one layer in or out, or select a range from the active one */
    selectLayer(id: number, mode: 'replace' | 'toggle' | 'range' = 'replace'): void {
        if (mode === 'replace' || !this.layers.some(l => l.id === this.activeId)) {
            this.setActive(id);
        }
        else if (mode === 'toggle') {
            if (id === this.activeId) {
                // keep one active: hand it to another selected layer, if any
                const next = this.extraSel[this.extraSel.length - 1];
                if (next !== undefined) {
                    this.activeId = next;
                    this.extraSel = this.extraSel.filter(x => x !== next);
                }
            }
            else if (this.extraSel.includes(id)) {
                this.extraSel = this.extraSel.filter(x => x !== id);
            }
            else {
                this.extraSel = [...this.extraSel, this.activeId];
                this.activeId = id;
            }
        }
        else {
            const a = this.layers.findIndex(l => l.id === this.activeId), b = this.layers.findIndex(l => l.id === id);
            const [lo, hi] = a < b ? [a, b] : [b, a];
            this.extraSel = this.layers.slice(lo, hi + 1).map(l => l.id).filter(x => x !== id);
            this.activeId = id;
        }
        this.finishText();
        this.render();
    }

    /** the selected layers, bottom to top */
    get selectedLayers(): Layer[] {
        return this.layers.filter(l => l.id === this.activeId || this.extraSel.includes(l.id));
    }

    /** deletes several layers as one undo step (at least one layer always stays) */
    deleteLayers(list: Layer[]): void {
        this.finishText();
        const gone = list.filter(l => this.layers.includes(l)).slice(0, this.layers.length - 1);
        if (!gone.length) {
            return;
        }
        const before = [...this.layers], prevActive = this.activeId, prevExtra = [...this.extraSel];
        const apply = () => {
            this.layers = before.filter(l => !gone.includes(l));
            this.setActive(this.layers.includes(this.active!) ? this.activeId : this.layers[this.layers.length - 1].id);
        };
        apply();
        this.history.push({
            label: gone.length > 1 ? `Delete ${gone.length} layers` : `Delete ${gone[0].name}`,
            undo: () => { this.layers = before; this.activeId = prevActive; this.extraSel = prevExtra; this.touch(); },
            redo: () => { apply(); this.touch(); },
        });
        this.touch();
    }

    /** whether the selection can merge: 2+ layers, all image or all mask */
    get canMergeSelected(): boolean {
        const sel = this.selectedLayers;
        return sel.length > 1 && sel.every(l => l.isMask === sel[0].isMask) && sel.slice(1).some(l => l.visible);
    }

    /** merges the selected layers into the lowest one, in stack order; hidden ones are left out and kept */
    mergeSelected(): void {
        if (!this.canMergeSelected || this.xform) {
            return;
        }
        this.finishText();
        const sel = this.selectedLayers, target = sel[0], above = sel.slice(1).filter(l => l.visible);
        this.rasterize(target);
        this.saveBackup(target);
        const rect = { x: 0, y: 0, w: target.width, h: target.height };
        const beforePx = this.backupData(rect);
        for (const l of above) {
            l.draw(target.ctx, -target.x, -target.y);
        }
        const px = pixelEntry('Merge', target, rect, beforePx);
        const before = [...this.layers], prevActive = this.activeId, prevExtra = [...this.extraSel];
        const apply = () => { this.layers = before.filter(l => !above.includes(l)); this.setActive(target.id); };
        apply();
        this.history.push({
            label: `Merge ${above.length + 1} layers`,
            undo: () => { px.undo(); this.layers = before; this.activeId = prevActive; this.extraSel = prevExtra; this.touch(); },
            redo: () => { px.redo(); apply(); this.touch(); },
        });
        this.touch();
    }

    /** switching tools applies a pending transform and ends text editing */
    setTool(id: ToolId): void {
        if (this.xform) {
            this.applyTransform();
        }
        if (id !== 'text') {
            this.finishText();
        }
        this.tool = id;
        this.render();
    }

    get active(): Layer | null {
        return this.layers.find(l => l.id === this.activeId) ?? null;
    }

    get brush(): BrushSettings | null {
        return BRUSH_TOOLS.includes(this.tool) ? this.brushes[this.tool as BrushKind] : null;
    }

    /** classic setBaseImage: the picture, an empty paint layer above it, and an empty mask layer */
    load(img: CanvasImageSource, w: number, h: number): void {
        this.width = w;
        this.height = h;
        const base = new Layer('Image', w, h);
        base.ctx.drawImage(img, 0, 0, w, h);
        const paint = new Layer('Paint', w, h);
        const mask = new Layer('Mask', w, h, true);
        this.layers = [base, paint, mask];
        this.setActive(paint.id);
        this.selection = null;
        this.hasSelection = false;
        this.history.clear();
        this.backup = makeCanvas(w, h);
        this.maskView = makeCanvas(w, h);
        this.fit();
        this.touch();
    }

    blank(w: number, h: number, color = '#ffffff'): void {
        const c = makeCanvas(w, h), ctx = ctxOf(c);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        this.load(c, w, h);
    }

    attach(canvas: HTMLCanvasElement): () => void {
        this.canvas = canvas;
        this.ctx = ctxOf(canvas);
        const cs = getComputedStyle(canvas);
        this.checkA = cs.getPropertyValue('--editor-check-a').trim() || this.checkA;
        this.checkB = cs.getPropertyValue('--editor-check-b').trim() || this.checkB;
        const opts = { passive: false } as AddEventListenerOptions;
        const down = (e: PointerEvent) => this.onDown(e), move = (e: PointerEvent) => this.onMove(e), up = (e: PointerEvent) => this.onUp(e);
        const wheel = (e: WheelEvent) => this.onWheel(e), leave = () => { this.hover = null; this.render(); };
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
        return () => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            canvas.removeEventListener('pointerleave', leave);
            canvas.removeEventListener('wheel', wheel);
            canvas.removeEventListener('contextmenu', noMenu);
            window.clearInterval(this.antsTimer);
            this.cancelAction();
            this.canvas = null;
            this.ctx = null;
        };
    }

    resize(w: number, h: number): void {
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

    fit(): void {
        if (!this.viewW || !this.width) {
            return;
        }
        const pad = 16;
        this.zoom = Math.min((this.viewW - pad * 2) / this.width, (this.viewH - pad * 2) / this.height, 8);
        this.panX = (this.viewW - this.width * this.zoom) / 2;
        this.panY = (this.viewH - this.height * this.zoom) / 2;
        this.render();
    }

    zoomBy(factor: number, at?: Pt): void {
        const p = at ?? { x: this.viewW / 2, y: this.viewH / 2 };
        const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
        this.panX = p.x - ((p.x - this.panX) * z) / this.zoom;
        this.panY = p.y - ((p.y - this.panY) * z) / this.zoom;
        this.zoom = z;
        this.render();
    }

    setZoom(z: number): void {
        this.zoomBy(z / this.zoom);
    }

    private touch(): void {
        this.layers = [...this.layers];
        this.rev++;
        this.render();
    }

    private toDoc(p: Pt): Pt {
        return { x: (p.x - this.panX) / this.zoom, y: (p.y - this.panY) / this.zoom };
    }

    private local(e: PointerEvent | WheelEvent): Pt {
        const r = this.canvas!.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    setKeyState(key: 'space' | 'alt', down: boolean): void {
        if (key === 'space') {
            this.spaceDown = down;
        }
        else {
            this.altDown = down;
        }
        this.render();
    }

    get cursor(): string {
        if (this.xform && !this.spaceDown && this.action?.kind !== 'pan') {
            const h = this.action?.kind === 'xform' ? this.action.handle : this.hover && this.xform.hit(this.toDoc(this.hover), 9 / this.zoom);
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

    private onDown(e: PointerEvent): void {
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
        const p = this.local(e);
        this.pointers.set(e.pointerId, { ...p, type: e.pointerType });
        if (e.pointerType === 'pen') {
            this.penSeen = true;
        }
        const touches = [...this.pointers.values()].filter(q => q.type === 'touch');
        if (e.pointerType === 'touch' && touches.length >= 2) {
            // a second finger turns whatever the first one started into a pinch
            if (this.action?.kind === 'stroke' && this.action.touch || this.action?.kind === 'pick' || this.action?.kind === 'pan') {
                this.cancelAction();
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
            const d = this.toDoc(p), h = this.xform.hit(d, (e.pointerType === 'touch' ? 20 : 9) / this.zoom);
            if (h) {
                this.action = { kind: 'xform', handle: h, snap: this.xform.snapshot(), from: d };
            }
            return;
        }
        this.begin(this.altDown && this.tool !== 'move' && this.tool !== 'text' ? 'eyedropper' : this.tool, this.toDoc(p), e);
    }

    private onMove(e: PointerEvent): void {
        const p = this.local(e);
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
                this.zoomBy(dist / a.dist, mid);
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
            this.continue(this.toDoc(this.local(ev)), ev);
        }
        this.render();
    }

    private onUp(e: PointerEvent): void {
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
            this.cancelAction();
            return;
        }
        this.finish();
    }

    private onWheel(e: WheelEvent): void {
        if (!this.width) {
            return;
        }
        e.preventDefault();
        const p = this.local(e);
        // trackpad two-finger scroll pans; ctrl+wheel (also trackpad pinch) and plain mouse wheel zoom
        if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0) {
            this.panX -= e.deltaX;
            this.panY -= e.deltaY;
            this.render();
            return;
        }
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p);
    }

    private pressure(e: PointerEvent): number {
        return e.pointerType === 'pen' ? Math.max(0.01, e.pressure || 0) : 1;
    }

    private begin(tool: ToolId, d: Pt, e: PointerEvent): void {
        const layer = this.active;
        if (tool === 'eyedropper') {
            this.action = { kind: 'pick' };
            this.pick(d);
            return;
        }
        if (tool === 'text') {
            this.textClick(d);
            return;
        }
        if (tool === 'rect' || tool === 'ellipse' || tool === 'lasso') {
            this.action = { kind: 'select', shape: tool === 'lasso' ? { kind: 'poly', points: [[d.x, d.y]] } : { kind: tool, x: d.x, y: d.y, w: 0, h: 0 } };
            return;
        }
        if (!layer) {
            return;
        }
        if (tool === 'lassofill') {
            if (layer.visible) {
                this.rasterize(layer);
                this.action = { kind: 'select', shape: { kind: 'poly', points: [[d.x, d.y]] }, fill: layer };
            }
            return;
        }
        if (!layer.visible) {
            this.onNotice?.('That layer is hidden. Show it to edit it.');
            return;
        }
        if (tool !== 'move' || this.selection) {
            this.rasterize(layer);
        }
        if (tool === 'fill') {
            this.bucket(layer, d);
            return;
        }
        this.saveBackup(layer);
        if (BRUSH_TOOLS.includes(tool)) {
            const kind = tool as BrushKind;
            const color = layer.isMask ? '#ffffff' : this.color;
            const stroke = new Stroke(kind, $state.snapshot(this.brushes[kind]), color, layer.width, layer.height);
            stroke.add(d.x - layer.x, d.y - layer.y, this.pressure(e));
            const timer = kind === 'airbrush' ? window.setInterval(() => { stroke.tick(); this.render(); }, 40) : 0;
            this.action = { kind: 'stroke', layer, stroke, timer, touch: e.pointerType === 'touch' };
            this.rememberColor();
        }
        else if (tool === 'move') {
            let float: HTMLCanvasElement | null = null;
            if (this.selection) {
                // cut the selected pixels into a floating piece that follows the pointer
                float = makeCanvas(layer.width, layer.height);
                const fctx = ctxOf(float);
                fctx.drawImage(layer.canvas, 0, 0);
                fctx.globalCompositeOperation = 'destination-in';
                fctx.drawImage(this.selection.mask, -layer.x, -layer.y);
                layer.ctx.save();
                layer.ctx.globalCompositeOperation = 'destination-out';
                layer.ctx.drawImage(this.selection.mask, -layer.x, -layer.y);
                layer.ctx.restore();
            }
            this.action = { kind: 'move', layer, start: d, ox: layer.x, oy: layer.y, float, dx: 0, dy: 0 };
        }
        else if (tool === 'liquify') {
            this.action = { kind: 'liquify', layer, last: { x: d.x - layer.x, y: d.y - layer.y }, dirty: null, warp: new LiquifyWarp(layer.ctx, layer.width, layer.height) };
        }
    }

    private continue(d: Pt, e: PointerEvent): void {
        const a = this.action;
        if (!a) {
            return;
        }
        if (a.kind === 'stroke') {
            a.stroke.add(d.x - a.layer.x, d.y - a.layer.y, this.pressure(e));
        }
        else if (a.kind === 'xform') {
            this.xform?.drag(a.handle, a.snap, a.from, d, e.shiftKey);
        }
        else if (a.kind === 'textmove' && a.layer.text) {
            a.layer.text.x = a.ox + Math.round(d.x - a.start.x);
            a.layer.text.y = a.oy + Math.round(d.y - a.start.y);
            renderText(a.layer);
        }
        else if (a.kind === 'pick') {
            this.pick(d);
        }
        else if (a.kind === 'select') {
            const s = a.shape;
            if (s.kind === 'poly') {
                const [lx, ly] = s.points[s.points.length - 1];
                if (Math.hypot(d.x - lx, d.y - ly) * this.zoom > 3) {
                    s.points.push([d.x, d.y]);
                }
            }
            else {
                s.w = d.x - s.x;
                s.h = d.y - s.y;
                if (e.shiftKey) {
                    const m = Math.max(Math.abs(s.w), Math.abs(s.h));
                    s.w = Math.sign(s.w || 1) * m;
                    s.h = Math.sign(s.h || 1) * m;
                }
            }
        }
        else if (a.kind === 'move') {
            let dx = Math.round(d.x - a.start.x), dy = Math.round(d.y - a.start.y);
            if (e.shiftKey) {
                if (Math.abs(dx) > Math.abs(dy)) dy = 0;
                else dx = 0;
            }
            a.dx = dx;
            a.dy = dy;
            if (!a.float) {
                a.layer.x = a.ox + dx;
                a.layer.y = a.oy + dy;
            }
        }
        else if (a.kind === 'liquify') {
            const p = { x: d.x - a.layer.x, y: d.y - a.layer.y };
            const r = this.liquify.size / 2, dist = Math.hypot(p.x - a.last.x, p.y - a.last.y);
            const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.15)));
            for (let i = 1; i <= steps; i++) {
                const from = { x: a.last.x + ((p.x - a.last.x) * (i - 1)) / steps, y: a.last.y + ((p.y - a.last.y) * (i - 1)) / steps };
                const to = { x: a.last.x + ((p.x - a.last.x) * i) / steps, y: a.last.y + ((p.y - a.last.y) * i) / steps };
                const rect = a.warp.push(from.x, from.y, to.x, to.y, r, this.liquify.strength);
                if (rect) {
                    a.dirty = unionRect(a.dirty, rect);
                }
            }
            a.last = p;
        }
    }

    private finish(): void {
        const a = this.action;
        this.action = null;
        if (!a) {
            return;
        }
        if (a.kind === 'stroke') {
            window.clearInterval(a.timer);
            const clip = this.selection;
            a.stroke.apply(a.layer.ctx, clip?.mask ?? null, -a.layer.x, -a.layer.y);
            const rect = a.stroke.dirty && clipRect(a.stroke.dirty, a.layer.width, a.layer.height);
            if (rect) {
                this.commitPixels(a.stroke.kind === 'eraser' ? 'Erase' : 'Paint', a.layer, rect);
            }
        }
        else if (a.kind === 'select' && a.fill) {
            this.lassoFill(a.fill, a.shape);
        }
        else if (a.kind === 'select') {
            const s = Selection.normalize(a.shape);
            const tiny = s.kind === 'poly' ? s.points.length < 3 : s.w < 1 || s.h < 1;
            this.setSelection(tiny ? null : new Selection(s, false, this.width, this.height), tiny ? 'Deselect' : 'Select');
        }
        else if (a.kind === 'move') {
            if (a.float) {
                a.layer.ctx.drawImage(a.float, a.dx, a.dy);
                const before = this.selection!;
                const after = before.moved(a.dx, a.dy);
                const r = clipRect(unionRect(before.bounds(), after.bounds()), this.width, this.height);
                const rect = r && clipRect({ x: r.x - a.layer.x, y: r.y - a.layer.y, w: r.w, h: r.h }, a.layer.width, a.layer.height);
                this.selection = after;
                if (rect) {
                    const px = pixelEntry('Move', a.layer, rect, this.backupData(rect));
                    this.history.push({ label: 'Move', undo: () => { px.undo(); this.selection = before; this.touch(); }, redo: () => { px.redo(); this.selection = after; this.touch(); } });
                }
            }
            else if (a.dx || a.dy) {
                const { layer, ox, oy } = a, nx = layer.x, ny = layer.y;
                this.history.push({ label: 'Move layer', undo: () => { layer.x = ox; layer.y = oy; this.touch(); }, redo: () => { layer.x = nx; layer.y = ny; this.touch(); } });
            }
        }
        else if (a.kind === 'liquify' && a.dirty) {
            const rect = clipRect(a.dirty, a.layer.width, a.layer.height);
            if (rect) {
                this.commitPixels('Liquify', a.layer, rect);
            }
        }
        this.touch();
    }

    private cancelAction(): void {
        const a = this.action;
        this.action = null;
        if (!a) {
            return;
        }
        if (a.kind === 'stroke') {
            window.clearInterval(a.timer);
        }
        if (a.kind === 'xform') {
            this.xform?.restore(a.snap);
        }
        if ((a.kind === 'liquify' || a.kind === 'move') && this.backup) {
            a.layer.ctx.clearRect(0, 0, a.layer.width, a.layer.height);
            a.layer.ctx.drawImage(this.backup, 0, 0);
            if (a.kind === 'move') {
                a.layer.x = a.ox;
                a.layer.y = a.oy;
            }
        }
        this.render();
    }

    private saveBackup(layer: Layer): void {
        if (!this.backup || this.backup.width !== layer.width || this.backup.height !== layer.height) {
            this.backup = makeCanvas(layer.width, layer.height);
        }
        const b = ctxOf(this.backup, true);
        b.clearRect(0, 0, layer.width, layer.height);
        b.drawImage(layer.canvas, 0, 0);
    }

    private backupData(r: Rect): ImageData {
        return ctxOf(this.backup!, true).getImageData(r.x, r.y, r.w, r.h);
    }

    private commitPixels(label: string, layer: Layer, rect: Rect): void {
        const px = pixelEntry(label, layer, rect, this.backupData(rect));
        this.history.push({ label, undo: () => { px.undo(); this.touch(); }, redo: () => { px.redo(); this.touch(); } });
    }

    /** runs a whole-layer pixel change as one undo step */
    private editLayer(label: string, layer: Layer, fn: (l: Layer) => void): void {
        this.saveBackup(layer);
        fn(layer);
        this.commitPixels(label, layer, { x: 0, y: 0, w: layer.width, h: layer.height });
        this.touch();
    }

    private pick(d: Pt): void {
        const c = makeCanvas(1, 1), ctx = ctxOf(c, true);
        for (const l of this.layers) {
            if (!l.isMask) {
                l.draw(ctx, -Math.floor(d.x), -Math.floor(d.y));
            }
        }
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a > 0) {
            this.color = rgbToHex({ r, g, b });
        }
    }

    private rememberColor(): void {
        const c = this.color.toLowerCase();
        if (this.recentColors[0] !== c) {
            this.recentColors = [c, ...this.recentColors.filter(x => x !== c)].slice(0, 12);
        }
    }

    private layerClip(layer: Layer): Uint8ClampedArray | null {
        if (!this.selection) {
            return null;
        }
        const c = makeCanvas(layer.width, layer.height), ctx = ctxOf(c, true);
        ctx.drawImage(this.selection.mask, -layer.x, -layer.y);
        return ctx.getImageData(0, 0, layer.width, layer.height).data;
    }

    private bucket(layer: Layer, d: Pt): void {
        const rgb = hexToRgb(layer.isMask ? '#ffffff' : this.color)!;
        let source: ImageData;
        if (this.fill.allLayers && !layer.isMask) {
            const c = makeCanvas(layer.width, layer.height), ctx = ctxOf(c, true);
            for (const l of this.layers) {
                if (!l.isMask) {
                    l.draw(ctx, -layer.x, -layer.y);
                }
            }
            source = ctx.getImageData(0, 0, layer.width, layer.height);
        }
        else {
            source = layer.ctx.getImageData(0, 0, layer.width, layer.height);
        }
        this.saveBackup(layer);
        const rect = floodFill(source, layer.ctx, d.x - layer.x, d.y - layer.y, rgb, 1, this.fill.tolerance, this.layerClip(layer), this.fill.expand);
        if (rect) {
            this.commitPixels('Fill', layer, rect);
            this.rememberColor();
        }
        this.touch();
    }

    private lassoFill(layer: Layer, shape: SelectionShape): void {
        if (shape.kind !== 'poly' || shape.points.length < 3) {
            return;
        }
        const sel = this.selection;
        this.editLayer('Lasso fill', layer, l => {
            const c = makeCanvas(l.width, l.height), ctx = ctxOf(c);
            ctx.translate(-l.x, -l.y);
            ctx.fillStyle = l.isMask ? '#ffffff' : this.color;
            ctx.fill(new Selection(shape, false, 1, 1).path());
            if (sel) {
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(sel.mask, 0, 0);
            }
            l.ctx.drawImage(c, 0, 0);
        });
        this.rememberColor();
    }

    private setSelection(sel: Selection | null, label: string): void {
        const before = this.selection;
        if (!before && !sel) {
            return;
        }
        this.selection = sel;
        this.hasSelection = !!sel;
        this.history.push({
            label,
            undo: () => { this.selection = before; this.hasSelection = !!before; this.render(); },
            redo: () => { this.selection = sel; this.hasSelection = !!sel; this.render(); },
        });
        this.render();
    }

    selectAll(): void {
        this.setSelection(new Selection({ kind: 'rect', x: 0, y: 0, w: this.width, h: this.height }, false, this.width, this.height), 'Select all');
    }

    deselect(): void {
        this.setSelection(null, 'Deselect');
    }

    invertSelection(): void {
        if (this.selection) {
            this.setSelection(this.selection.invert(), 'Invert selection');
        }
    }

    /** clears the selection on the active layer (the whole layer without one) */
    clearSelected(): void {
        const layer = this.active, sel = this.selection;
        if (!layer) {
            return;
        }
        this.editLayer('Clear', layer, l => {
            if (sel) {
                l.ctx.save();
                l.ctx.globalCompositeOperation = 'destination-out';
                l.ctx.drawImage(sel.mask, -l.x, -l.y);
                l.ctx.restore();
            }
            else {
                l.ctx.clearRect(0, 0, l.width, l.height);
            }
        });
    }

    fillSelected(): void {
        const layer = this.active, sel = this.selection;
        if (!layer) {
            return;
        }
        this.editLayer('Fill', layer, l => {
            const c = makeCanvas(l.width, l.height), ctx = ctxOf(c);
            ctx.fillStyle = l.isMask ? '#ffffff' : this.color;
            ctx.fillRect(0, 0, l.width, l.height);
            if (sel) {
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(sel.mask, -l.x, -l.y);
            }
            l.ctx.drawImage(c, 0, 0);
        });
        this.rememberColor();
    }

    undo(): void {
        this.cancelAction();
        if (this.xform) {
            this.cancelTransform();
            return;
        }
        this.finishText();
        this.history.undo();
        this.hasSelection = !!this.selection;
        this.touch();
    }

    redo(): void {
        this.cancelAction();
        if (this.xform) {
            return;
        }
        this.finishText();
        this.history.redo();
        this.hasSelection = !!this.selection;
        this.touch();
    }

    private structural(label: string, apply: () => void, revert: () => void): void {
        apply();
        this.history.push({ label, undo: () => { revert(); this.touch(); }, redo: () => { apply(); this.touch(); } });
        this.touch();
    }

    private insert(layer: Layer, index = this.layers.length): void {
        const prevActive = this.activeId;
        this.structural(`Add ${layer.name}`, () => {
            const list = [...this.layers];
            list.splice(index, 0, layer);
            this.layers = list;
            this.setActive(layer.id);
        }, () => {
            this.layers = this.layers.filter(l => l !== layer);
            this.setActive(prevActive);
        });
    }

    private nextName(base: string): string {
        let n = 1;
        while (this.layers.some(l => l.name === `${base} ${n}`)) {
            n++;
        }
        return `${base} ${n}`;
    }

    addLayer(mask = false): void {
        const active = this.active;
        const index = active ? this.layers.indexOf(active) + 1 : this.layers.length;
        this.insert(new Layer(this.nextName(mask ? 'Mask' : 'Layer'), this.width, this.height, mask), index);
    }

    addImageLayer(img: CanvasImageSource & { width: number; height: number }, name = 'Image'): void {
        const w = (img as HTMLImageElement).naturalWidth || img.width, h = (img as HTMLImageElement).naturalHeight || img.height;
        const l = new Layer(this.nextName(name), w, h);
        l.ctx.drawImage(img, 0, 0);
        l.x = Math.round((this.width - w) / 2);
        l.y = Math.round((this.height - h) / 2);
        const active = this.active;
        this.insert(l, active ? this.layers.indexOf(active) + 1 : this.layers.length);
    }

    duplicateLayer(layer: Layer): void {
        this.insert(layer.clone(`${layer.name} copy`), this.layers.indexOf(layer) + 1);
    }

    deleteLayer(layer: Layer): void {
        this.finishText();
        if (this.layers.length <= 1) {
            return;
        }
        const index = this.layers.indexOf(layer), prevActive = this.activeId;
        this.structural(`Delete ${layer.name}`, () => {
            this.layers = this.layers.filter(l => l !== layer);
            if (this.activeId === layer.id) {
                this.setActive(this.layers[Math.max(0, index - 1)].id);
            }
        }, () => {
            const list = [...this.layers];
            list.splice(index, 0, layer);
            this.layers = list;
            this.setActive(prevActive);
        });
    }

    moveLayer(layer: Layer, dir: 1 | -1): void {
        const i = this.layers.indexOf(layer), j = i + dir;
        if (j < 0 || j >= this.layers.length) {
            return;
        }
        const swap = () => {
            const list = [...this.layers];
            [list[i], list[j]] = [list[j], list[i]];
            this.layers = list;
        };
        this.structural('Reorder layers', swap, swap);
    }

    setLayerProps(layer: Layer, props: Partial<Pick<Layer, 'visible' | 'opacity' | 'name' | 'isMask'>>, record = true): void {
        const before = { visible: layer.visible, opacity: layer.opacity, name: layer.name, isMask: layer.isMask };
        const after = { ...before, ...props };
        if (!record) {
            Object.assign(layer, after);
            this.touch();
            return;
        }
        this.structural('Layer change', () => Object.assign(layer, after), () => Object.assign(layer, before));
    }

    /** records an opacity drag as one step once it ends */
    commitOpacity(layer: Layer, from: number): void {
        const to = layer.opacity;
        if (from !== to) {
            this.history.push({ label: 'Opacity', undo: () => { layer.opacity = from; this.touch(); }, redo: () => { layer.opacity = to; this.touch(); } });
        }
    }

    mergeDown(layer: Layer): void {
        const i = this.layers.indexOf(layer);
        const below = this.layers[i - 1];
        if (!below || below.isMask !== layer.isMask) {
            return;
        }
        this.saveBackup(below);
        const rect = { x: 0, y: 0, w: below.width, h: below.height };
        const before = this.backupData(rect);
        layer.draw(below.ctx, -below.x, -below.y);
        const px = pixelEntry('Merge', below, rect, before);
        const apply = () => { this.layers = this.layers.filter(l => l !== layer); this.setActive(below.id); };
        apply();
        this.history.push({
            label: 'Merge down',
            undo: () => { px.undo(); const list = [...this.layers]; list.splice(i, 0, layer); this.layers = list; this.setActive(layer.id); this.touch(); },
            redo: () => { px.redo(); apply(); this.touch(); },
        });
        this.touch();
    }

    invertLayer(layer: Layer): void {
        this.editLayer(layer.isMask ? 'Invert mask' : 'Invert colours', layer, l => {
            const img = l.ctx.getImageData(0, 0, l.width, l.height), d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                if (l.isMask) {
                    d[i] = d[i + 1] = d[i + 2] = 255;
                    d[i + 3] = 255 - d[i + 3];
                }
                else {
                    d[i] = 255 - d[i];
                    d[i + 1] = 255 - d[i + 1];
                    d[i + 2] = 255 - d[i + 2];
                }
            }
            l.ctx.putImageData(img, 0, 0);
        });
    }

    clearLayer(layer: Layer): void {
        this.editLayer('Clear layer', layer, l => l.ctx.clearRect(0, 0, l.width, l.height));
    }

    /** turns an editable text layer into plain pixels (undoable), before painting on it */
    private rasterize(layer: Layer): void {
        const spec = layer.text;
        if (!spec) {
            return;
        }
        if (this.textSession?.layer === layer) {
            this.finishText();
        }
        layer.text = undefined;
        this.history.push({ label: 'Rasterize text', undo: () => { layer.text = { ...spec }; renderText(layer); this.touch(); }, redo: () => { layer.text = undefined; this.touch(); } });
        this.onNotice?.('Text layer converted to pixels.');
    }

    private textHit(d: Pt): Layer | null {
        for (const l of [...this.layers].reverse()) {
            if (l.text && l.visible) {
                const b = textBounds(l.ctx, l.text);
                if (d.x >= b.x + l.x && d.x <= b.x + l.x + b.w && d.y >= b.y + l.y && d.y <= b.y + l.y + b.h) {
                    return l;
                }
            }
        }
        return null;
    }

    private textClick(d: Pt): void {
        const hit = this.textHit(d);
        if (hit) {
            if (this.textSession?.layer !== hit) {
                this.finishText();
                this.textSession = { layer: hit, isNew: false, before: { ...hit.text! } };
            }
            this.setActive(hit.id);
            this.editingText = hit.id;
            this.color = hit.text!.color;
            this.color2 = hit.text!.strokeColor;
            this.action = { kind: 'textmove', layer: hit, start: d, ox: hit.text!.x, oy: hit.text!.y };
            this.touch();
            return;
        }
        this.finishText();
        const active = this.active;
        const layer = new Layer(this.nextName('Text'), this.width, this.height);
        layer.text = { ...$state.snapshot(this.textStyle), text: '', color: this.color, strokeColor: this.color2, x: Math.round(d.x), y: Math.round(d.y) };
        const list = [...this.layers];
        list.splice(active ? this.layers.indexOf(active) + 1 : list.length, 0, layer);
        this.layers = list;
        this.setActive(layer.id);
        this.editingText = layer.id;
        this.textSession = { layer, isNew: true, before: { ...layer.text } };
        this.rememberColor();
        this.touch();
    }

    get editingLayer(): Layer | null {
        return this.textSession?.layer ?? null;
    }

    /** live edit of the text being edited (recorded as one undo step when editing ends) */
    updateText(patch: Partial<TextSpec>): void {
        const l = this.textSession?.layer;
        if (!l?.text) {
            return;
        }
        Object.assign(l.text, patch);
        renderText(l);
        this.touch();
    }

    /** style for new text, also applied to the text being edited */
    setTextStyle(patch: Partial<TextStyle>): void {
        Object.assign(this.textStyle, patch);
        this.updateText(patch);
    }

    finishText(): void {
        const sess = this.textSession;
        this.textSession = null;
        this.editingText = null;
        if (!sess) {
            return;
        }
        const { layer, isNew, before } = sess;
        const after = layer.text ? { ...layer.text } : null;
        if (!after) {
            return;
        }
        if (isNew) {
            if (!after.text.trim()) {
                this.layers = this.layers.filter(l => l !== layer);
                if (this.activeId === layer.id) {
                    this.setActive(this.layers[this.layers.length - 1]?.id ?? 0);
                }
                this.touch();
                return;
            }
            const index = this.layers.indexOf(layer);
            this.history.push({
                label: 'Add text',
                undo: () => { this.layers = this.layers.filter(l => l !== layer); this.touch(); },
                redo: () => { const list = [...this.layers]; list.splice(index, 0, layer); this.layers = list; this.touch(); },
            });
        }
        else if (JSON.stringify(before) !== JSON.stringify(after)) {
            const set = (spec: TextSpec) => () => { layer.text = { ...spec }; renderText(layer); this.touch(); };
            this.history.push({ label: 'Edit text', undo: set(before), redo: set(after) });
        }
        this.touch();
    }

    /** classic has no free transform; this is Photoshop's Ctrl+T on the selection (or the whole layer's content) */
    startTransform(): void {
        const layer = this.active;
        if (this.xform || !layer) {
            return;
        }
        if (!layer.visible) {
            this.onNotice?.('That layer is hidden. Show it to transform it.');
            return;
        }
        this.finishText();
        this.rasterize(layer);
        const sel = this.selection;
        const area = sel ? clipRect(sel.bounds(), this.width, this.height) : null;
        const r = sel ? area && clipRect({ x: area.x - layer.x, y: area.y - layer.y, w: area.w, h: area.h }, layer.width, layer.height) : this.contentBounds(layer);
        if (!r) {
            this.onNotice?.(sel ? 'Nothing selected on this layer.' : 'This layer is empty.');
            return;
        }
        this.saveBackup(layer);
        const piece = makeCanvas(r.w, r.h), pctx = ctxOf(piece);
        pctx.drawImage(layer.canvas, -r.x, -r.y);
        layer.ctx.save();
        if (sel) {
            pctx.globalCompositeOperation = 'destination-in';
            pctx.drawImage(sel.mask, -r.x - layer.x, -r.y - layer.y);
            layer.ctx.globalCompositeOperation = 'destination-out';
            layer.ctx.drawImage(sel.mask, -layer.x, -layer.y);
        }
        else {
            layer.ctx.clearRect(r.x, r.y, r.w, r.h);
        }
        layer.ctx.restore();
        this.xform = new Transform(piece, r.x + layer.x, r.y + layer.y);
        this.xsession = { layer, sel };
        this.xformRev++;
        this.touch();
    }

    private contentBounds(layer: Layer): Rect | null {
        const { width: w, height: h } = layer, d = layer.ctx.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (d[(y * w + x) * 4 + 3]) {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
            }
        }
        return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    applyTransform(): void {
        const t = this.xform, sess = this.xsession;
        if (!t || !sess) {
            return;
        }
        const { layer, sel } = sess;
        layer.ctx.save();
        layer.ctx.translate(-layer.x, -layer.y);
        t.draw(layer.ctx, 1);
        layer.ctx.restore();
        const rect = { x: 0, y: 0, w: layer.width, h: layer.height };
        const px = pixelEntry('Transform', layer, rect, this.backupData(rect));
        const after = sel ? new Selection({ kind: 'poly', points: t.outline(6).map(p => [p.x, p.y] as [number, number]) }, false, this.width, this.height) : null;
        this.xform = null;
        this.xsession = null;
        this.selection = after;
        this.hasSelection = !!after;
        this.history.push({
            label: 'Transform',
            undo: () => { px.undo(); this.selection = sel; this.hasSelection = !!sel; this.touch(); },
            redo: () => { px.redo(); this.selection = after; this.hasSelection = !!after; this.touch(); },
        });
        this.xformRev++;
        this.touch();
    }

    cancelTransform(): void {
        const sess = this.xsession;
        if (!sess || !this.backup) {
            return;
        }
        sess.layer.ctx.clearRect(0, 0, sess.layer.width, sess.layer.height);
        sess.layer.ctx.drawImage(this.backup, 0, 0);
        this.xform = null;
        this.xsession = null;
        this.xformRev++;
        this.touch();
    }

    xformFlip(horizontal: boolean): void {
        this.xform?.flip(horizontal);
        this.xformRev++;
        this.touch();
    }

    xformRotate90(dir: 1 | -1): void {
        this.xform?.rotate90(dir);
        this.xformRev++;
        this.touch();
    }

    xformMesh(cells: number | null): void {
        this.xform?.setMesh(cells);
        this.xformRev++;
        this.touch();
    }

    /** Ctrl+C: the selection on the active layer (whole layer without one), or all visible image layers when merged */
    copy(merged = false): boolean {
        const layer = this.active;
        if (!layer || this.xform) {
            return false;
        }
        this.finishText();
        const sel = this.selection;
        if (!sel && !merged) {
            this.copyLayer(layer);
            return true;
        }
        const r = sel ? clipRect(sel.bounds(), this.width, this.height) : { x: 0, y: 0, w: this.width, h: this.height };
        if (!r) {
            this.onNotice?.('Nothing selected.');
            return false;
        }
        const c = makeCanvas(r.w, r.h), ctx = ctxOf(c);
        const sources = merged ? this.layers.filter(l => !l.isMask && l.visible) : [layer];
        for (const l of sources) {
            ctx.globalAlpha = merged ? l.opacity : 1;
            ctx.drawImage(l.canvas, l.x - r.x, l.y - r.y);
        }
        ctx.globalAlpha = 1;
        if (sel) {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(sel.mask, -r.x, -r.y);
        }
        this.setClip({ canvas: c, x: r.x, y: r.y, isMask: !merged && layer.isMask, name: merged ? 'Merged' : layer.name });
        return true;
    }

    copyLayer(layer: Layer): void {
        const c = makeCanvas(layer.width, layer.height);
        ctxOf(c).drawImage(layer.canvas, 0, 0);
        this.setClip({ canvas: c, x: layer.x, y: layer.y, isMask: layer.isMask, name: layer.name, text: layer.text && { ...layer.text } });
    }

    cut(): void {
        if (this.copy()) {
            this.clearSelected();
        }
    }

    private setClip(clip: NonNullable<Editor['clip']>): void {
        this.clip = clip;
        this.hasClipboard = true;
        this.clipMaybeStale = false;
        // also offer it to other apps; needs a secure page (https or localhost), so it's best-effort
        if (!clip.text && window.isSecureContext && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            clip.canvas.toBlob(b => { if (b) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); }, 'image/png');
        }
    }

    /** Ctrl+V: a new layer above the active one, where the copy came from */
    paste(): void {
        const clip = this.clip;
        if (!clip || this.xform) {
            return;
        }
        this.finishText();
        const l = new Layer(this.nextName(clip.text ? 'Text' : clip.isMask ? 'Mask' : 'Pasted'), clip.canvas.width, clip.canvas.height, clip.isMask);
        l.ctx.drawImage(clip.canvas, 0, 0);
        l.x = clip.x;
        l.y = clip.y;
        if (clip.text) {
            l.text = { ...clip.text };
        }
        const active = this.active;
        this.insert(l, active ? this.layers.indexOf(active) + 1 : this.layers.length);
    }

    /** an image from another app (paste event or the async clipboard): a new layer, centred */
    pasteImage(img: CanvasImageSource & { width: number; height: number }): void {
        if (this.xform) {
            return;
        }
        this.finishText();
        this.addImageLayer(img, 'Pasted');
    }

    swapColors(): void {
        [this.color, this.color2] = [this.color2, this.color];
    }

    render(): void {
        if (!this.frame) {
            this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                this.renderNow();
            });
        }
    }

    /** the active layer with the in-progress stroke or floating selection on top, as drawn on screen */
    private liveLayer(layer: Layer): CanvasImageSource {
        const a = this.action;
        if (a?.kind === 'stroke' && a.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(layer.canvas, 0, 0);
            a.stroke.flush();
            let buf: HTMLCanvasElement = a.stroke.buffer;
            if (this.selection) {
                const s2 = this.sized(this.scratch2, layer), c2 = ctxOf(s2);
                c2.clearRect(0, 0, s2.width, s2.height);
                c2.drawImage(buf, 0, 0);
                c2.globalCompositeOperation = 'destination-in';
                c2.drawImage(this.selection.mask, -layer.x, -layer.y);
                c2.globalCompositeOperation = 'source-over';
                buf = s2;
            }
            ctx.globalAlpha = a.stroke.s.opacity;
            ctx.globalCompositeOperation = a.stroke.kind === 'eraser' ? 'destination-out' : 'source-over';
            ctx.drawImage(buf, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            return s;
        }
        if (this.xform && this.xsession?.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.save();
            ctx.translate(-layer.x, -layer.y);
            this.xform.draw(ctx, 1);
            ctx.restore();
            return s;
        }
        if (a?.kind === 'move' && a.float && a.layer === layer) {
            const s = this.sized(this.scratch, layer), ctx = ctxOf(s);
            ctx.clearRect(0, 0, s.width, s.height);
            ctx.drawImage(layer.canvas, 0, 0);
            ctx.drawImage(a.float, a.dx, a.dy);
            return s;
        }
        return layer.canvas;
    }

    private sized(c: HTMLCanvasElement, layer: Layer): HTMLCanvasElement {
        if (c.width !== layer.width || c.height !== layer.height) {
            c.width = layer.width;
            c.height = layer.height;
        }
        return c;
    }

    private renderNow(): void {
        const ctx = this.ctx;
        if (!ctx || !this.canvas) {
            return;
        }
        const z = this.zoom, dpr = this.dpr;
        this.canvas.style.cursor = this.cursor;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // the area around the picture stays see-through; the stage behind the canvas sets its colour
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.width) {
            return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dx = this.panX, dy = this.panY, dw = this.width * z, dh = this.height * z;
        // transparency checkerboard in screen space so it stays the same size at any zoom
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, dw, dh);
        ctx.clip();
        ctx.fillStyle = this.checkA;
        ctx.fillRect(dx, dy, dw, dh);
        ctx.fillStyle = this.checkB;
        const sq = 8;
        const x0 = Math.max(dx, 0), y0 = Math.max(dy, 0), x1 = Math.min(dx + dw, this.viewW), y1 = Math.min(dy + dh, this.viewH);
        for (let y = Math.floor((y0 - dy) / sq); y * sq + dy < y1; y++) {
            for (let x = Math.floor((x0 - dx) / sq) + ((Math.floor((y0 - dy) / sq) + y) % 2 ? 0 : 1) % 2; x * sq + dx < x1; x += 2) {
                ctx.fillRect(dx + x * sq, dy + y * sq, sq, sq);
            }
        }
        ctx.restore();
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(z, z);
        ctx.imageSmoothingEnabled = z < 2;
        for (const l of this.layers) {
            if (!l.isMask && l.visible) {
                ctx.globalAlpha = l.opacity;
                ctx.drawImage(this.liveLayer(l), l.x, l.y);
            }
        }
        ctx.globalAlpha = 1;
        const masks = this.layers.filter(l => l.isMask && l.visible);
        if (masks.length) {
            // mask layers show as a tint over the picture, stronger while one is being edited
            const mv = this.maskView, mctx = ctxOf(mv);
            if (mv.width !== this.width || mv.height !== this.height) {
                mv.width = this.width;
                mv.height = this.height;
            }
            mctx.clearRect(0, 0, mv.width, mv.height);
            for (const l of masks) {
                mctx.globalAlpha = l.opacity;
                mctx.drawImage(this.liveLayer(l), l.x, l.y);
            }
            mctx.globalAlpha = 1;
            mctx.globalCompositeOperation = 'source-in';
            mctx.fillStyle = '#ff2d78';
            mctx.fillRect(0, 0, mv.width, mv.height);
            mctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this.active?.isMask ? 0.6 : 0.35;
            ctx.drawImage(mv, 0, 0);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(Math.round(dx) - 0.5, Math.round(dy) - 0.5, Math.round(dw) + 1, Math.round(dh) + 1);
        const active = this.active;
        if (active && (active.x || active.y || active.width !== this.width || active.height !== this.height)) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.strokeRect(dx + active.x * z, dy + active.y * z, active.width * z, active.height * z);
            ctx.setLineDash([]);
        }
        const a = this.action;
        if (a?.kind === 'select' && a.fill && a.shape.kind === 'poly') {
            ctx.save();
            ctx.translate(dx, dy);
            ctx.scale(z, z);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = a.fill.isMask ? '#ff2d78' : this.color;
            ctx.fill(new Selection(a.shape, false, 1, 1).path());
            ctx.restore();
        }
        const pending = a?.kind === 'select' && !a.fill ? new Selection(Selection.normalize(a.shape), false, 1, 1) : null;
        const sel = pending ?? this.selection;
        if (sel) {
            let path = sel.path();
            if (a?.kind === 'move' && a.float) {
                path = sel.moved(a.dx, a.dy).path();
            }
            ctx.save();
            ctx.translate(dx, dy);
            ctx.scale(z, z);
            ctx.lineWidth = 1 / z;
            ctx.strokeStyle = '#000';
            ctx.stroke(path);
            ctx.setLineDash([4 / z, 4 / z]);
            ctx.lineDashOffset = -this.antsOffset / z;
            ctx.strokeStyle = '#fff';
            ctx.stroke(path);
            ctx.restore();
        }
        if (this.xform) {
            const t = this.xform, toS = (p: Pt) => ({ x: dx + p.x * z, y: dy + p.y * z });
            ctx.save();
            ctx.lineWidth = 1;
            for (const line of t.gridLines(8)) {
                ctx.beginPath();
                line.forEach((p, i) => { const q = toS(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            const out = t.outline(8).map(toS);
            ctx.beginPath();
            out.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
            for (const hp of t.handles()) {
                const q = toS(hp);
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.beginPath();
                if (t.mesh) ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
                else ctx.rect(q.x - 4.5, q.y - 4.5, 9, 9);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }
        const tl = this.textSession?.layer;
        if (tl?.text) {
            const b = textBounds(tl.ctx, tl.text);
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.strokeRect(dx + (b.x + tl.x) * z, dy + (b.y + tl.y) * z, b.w * z, b.h * z);
            ctx.setLineDash([]);
        }
        const h = this.hover;
        const size = this.xform ? 0 : this.brush?.size ?? (this.tool === 'liquify' ? this.liquify.size : 0);
        if (h && size && !this.spaceDown && !this.altDown && a?.kind !== 'pan') {
            const r = Math.max(1.5, (size * z) / 2);
            ctx.beginPath();
            ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    private composite(maskOnly: boolean): HTMLCanvasElement {
        const c = makeCanvas(this.width, this.height), ctx = ctxOf(c, true);
        for (const l of this.layers) {
            if (l.isMask === maskOnly && l.visible) {
                ctx.globalAlpha = l.opacity;
                ctx.drawImage(this.liveLayer(l), l.x, l.y);
            }
        }
        ctx.globalAlpha = 1;
        return c;
    }

    /** classic getFinalImageData */
    finalImage(type = 'image/png'): string {
        return this.composite(false).toDataURL(type);
    }

    /** classic getMaximumImageData: everything on the image layers, including what's past the canvas edges */
    fullCanvasImage(): string {
        let x0 = 0, y0 = 0, x1 = this.width, y1 = this.height;
        for (const l of this.layers) {
            if (!l.isMask && l.visible) {
                x0 = Math.min(x0, l.x);
                y0 = Math.min(y0, l.y);
                x1 = Math.max(x1, l.x + l.width);
                y1 = Math.max(y1, l.y + l.height);
            }
        }
        const c = makeCanvas(x1 - x0, y1 - y0), ctx = ctxOf(c);
        for (const l of this.layers) {
            if (!l.isMask && l.visible) {
                ctx.globalAlpha = l.opacity;
                ctx.drawImage(this.liveLayer(l), l.x - x0, l.y - y0);
            }
        }
        return c.toDataURL('image/png');
    }

    get hasMask(): boolean {
        return this.layers.some(l => l.isMask && l.visible && l.hasContent());
    }

    /** classic getFinalMaskData: white = regenerate. Transparent areas of the image count as masked too */
    finalMask(): string {
        const w = this.width, h = this.height;
        const c = makeCanvas(w, h), ctx = ctxOf(c, true);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        if (this.hasMask) {
            const img = this.composite(false), ictx = ctxOf(img, true);
            const data = ictx.getImageData(0, 0, w, h);
            const d = data.data;
            for (let i = 0; i < d.length; i += 4) {
                d[i] = d[i + 1] = d[i + 2] = 0;
            }
            ictx.putImageData(data, 0, 0);
            ctx.drawImage(img, 0, 0);
            for (const l of this.layers) {
                if (l.isMask) {
                    l.draw(ctx);
                }
            }
        }
        const out = makeCanvas(w, h), octx = ctxOf(out);
        octx.fillStyle = '#000000';
        octx.fillRect(0, 0, w, h);
        octx.globalCompositeOperation = 'luminosity';
        octx.drawImage(c, 0, 0);
        return out.toDataURL('image/png');
    }

    private exported: { rev: number; image: string; mask: string } | null = null;

    /** image + mask for generation, re-encoded only after an edit (Generate Previews asks every 100ms) */
    exportForGen(): { image: string; mask: string } {
        if (this.exported?.rev !== this.rev) {
            this.exported = { rev: this.rev, image: this.finalImage(), mask: this.finalMask() };
        }
        return this.exported;
    }

    destroy(): void {
        this.cancelAction();
        this.layers = [];
        this.history.clear();
    }
}
