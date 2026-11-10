let n = 0;
export const uid = (p = 'ui') => `${p}-${++n}`;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function snap(v: number, step: number, min = 0) {
  if (!step) return v;
  return +(Math.round((v - min) / step) * step + min).toFixed(decimals(step));
}

export function portal(node: HTMLElement) {
  (document.fullscreenElement ?? document.body).appendChild(node);
  return { destroy: () => node.remove() };
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((e) => e.offsetParent !== null || e === document.activeElement);

export const decimals = (step: number) => (String(step).split('.')[1] || '').length;

export function fitNumber(v: number, step = 0, min = -Infinity, max = Infinity) {
  return clamp(step ? snap(v, step, isFinite(min) ? min : 0) : v, min, max);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export function rovingKeys(e: KeyboardEvent, root: HTMLElement, selector: string, vertical = false) {
  const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => !(el as HTMLButtonElement).disabled);
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const n = e.key === keys[1] ? i + 1 : e.key === keys[0] ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
  if (n === null) return;
  e.preventDefault();
  const t = items[(n + items.length) % items.length];
  items.forEach((el) => (el.tabIndex = el === t ? 0 : -1));
  t.focus();
}

export type RectLike = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export const pointRect = (x: number, y: number, h = 0): RectLike => ({ left: x, right: x, top: y, bottom: y + h, width: 0, height: h });

export function placePopover(anchor: Element | RectLike, pop: HTMLElement, side: 'bottom' | 'top' | 'right' = 'bottom', matchWidth = true, align: 'start' | 'center' = 'start') {
  const r = 'getBoundingClientRect' in anchor ? anchor.getBoundingClientRect() : anchor;
  const vw = window.innerWidth, vh = window.innerHeight, m = 8;
  const t = getComputedStyle(pop).getPropertyValue('--size-popover-max-h').trim();
  const cap = (parseFloat(t) || 320) * (t.endsWith('vh') ? vh / 100 : 1);
  const want = Math.min(pop.scrollHeight, cap);
  const w = Math.min(Math.max(matchWidth ? r.width : 0, pop.scrollWidth), vw - m * 2);
  if (side === 'right') {
    const h = Math.min(want, vh - m * 2);
    const left = r.right + w + m <= vw ? r.right : Math.max(m, r.left - w);
    const top = Math.min(Math.max(m, r.top - 4), vh - h - m);
    return `left:${left}px;min-width:${w}px;max-height:${h}px;top:${top}px`;
  }
  const below = vh - r.bottom - m, above = r.top - m;
  const up = side === 'top' ? !(above < want && below > above) : below < want && above > below;
  const h = Math.min(want, up ? above : below);
  const x = align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
  const left = Math.min(Math.max(m, x), vw - w - m);
  const g = align === 'center' ? 6 : 2;
  return `left:${left}px;min-width:${w}px;max-height:${h}px;top:${up ? r.top - h - g : r.bottom + g}px`;
}

const MIRROR = ['boxSizing', 'width', 'height', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize'] as const;

export function caretRect(el: HTMLTextAreaElement | HTMLInputElement, pos = el.selectionEnd ?? el.value.length): RectLike {
  const cs = getComputedStyle(el), d = document.createElement('div'), s = d.style as unknown as Record<string, string>;
  for (const p of MIRROR) s[p] = cs[p];
  Object.assign(d.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', overflow: 'hidden', whiteSpace: el.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre', wordWrap: 'break-word' });
  d.textContent = el.value.slice(0, pos);
  const sp = document.createElement('span');
  sp.textContent = el.value.slice(pos) || '.';
  d.appendChild(sp);
  document.body.appendChild(d);
  const r = el.getBoundingClientRect(), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
  const x = Math.min(r.right, r.left + el.clientLeft + sp.offsetLeft - el.scrollLeft);
  const y = Math.min(Math.max(r.top, r.top + el.clientTop + sp.offsetTop - el.scrollTop), r.bottom - lh);
  d.remove();
  return pointRect(x, y, lh);
}

export function longPress(node: HTMLElement, opts: { ms?: number; onlong: (x: number, y: number) => void }) {
  let o = opts, t: ReturnType<typeof setTimeout> | undefined, sx = 0, sy = 0, fired = 0;
  const start = (e: TouchEvent) => {
    if (e.touches.length !== 1) return clearTimeout(t);
    const p = e.touches[0];
    (sx = p.clientX), (sy = p.clientY);
    clearTimeout(t);
    t = setTimeout(() => {
      fired = Date.now();
      o.onlong(sx, sy);
    }, o.ms ?? 500);
  };
  const move = (e: TouchEvent) => {
    const p = e.touches[0];
    if (p && Math.hypot(p.clientX - sx, p.clientY - sy) > 10) clearTimeout(t);
  };
  const end = (e: TouchEvent) => {
    clearTimeout(t);
    if (Date.now() - fired < 1500 && e.cancelable) e.preventDefault();
  };
  const ctx = (e: Event) => Date.now() - fired < 1500 && e.preventDefault();
  const on: [string, EventListener][] = [['touchstart', start as EventListener], ['touchmove', move as EventListener], ['touchend', end as EventListener], ['touchcancel', () => clearTimeout(t)], ['contextmenu', ctx]];
  for (const [k, f] of on) node.addEventListener(k, f, { passive: k !== 'touchend' && k !== 'contextmenu' });
  return {
    update: (n: typeof opts) => (o = n),
    destroy() {
      clearTimeout(t);
      for (const [k, f] of on) node.removeEventListener(k, f);
    },
  };
}

export function onOutside(nodes: () => (Element | null | undefined)[], fn: () => void) {
  const h = (e: Event) => {
    const t = e.target as Node;
    if (!nodes().some((n) => n?.contains(t))) fn();
  };
  document.addEventListener('mousedown', h, true);
  document.addEventListener('touchstart', h, true);
  return () => {
    document.removeEventListener('mousedown', h, true);
    document.removeEventListener('touchstart', h, true);
  };
}

export function rangeSelect<K>(keys: K[], selected: K[], anchor: K | undefined, target: K, e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}, toggle = false): K[] {
  const add = e.ctrlKey || e.metaKey;
  if (e.shiftKey && anchor !== undefined && keys.includes(anchor)) {
    const [a, b] = [keys.indexOf(anchor), keys.indexOf(target)].sort((x, y) => x - y);
    const range = keys.slice(a, b + 1);
    return add ? [...selected.filter((k) => !range.includes(k)), ...range] : range;
  }
  if (add || toggle) return selected.includes(target) ? selected.filter((k) => k !== target) : [...selected, target];
  return [target];
}

export function scrollHint(node: HTMLElement) {
  node.classList.add('ui-scroll-hint');
  const measure = () => {
    const { scrollHeight: sh, clientHeight: ch, scrollTop: st } = node;
    const over = sh > ch + 1;
    node.classList.toggle('is-overflowing', over);
    if (!over) return;
    const h = Math.max(16, (ch * ch) / sh);
    node.style.setProperty('--sb-h', `${h}px`);
    node.style.setProperty('--sb-top', `${st + (st / (sh - ch)) * (ch - h)}px`);
  };
  node.addEventListener('pointerenter', measure, { passive: true });
  node.addEventListener('focusout', measure);
  return { destroy: () => { node.removeEventListener('pointerenter', measure); node.removeEventListener('focusout', measure); } };
}

export function setTheme(name: string) {
  const root = document.documentElement;
  root.dataset.theme = !name || name === 'default' ? 'dark' : name;
}

export function setContrast(high: boolean) {
  const root = document.documentElement;
  if (high) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
}

export type ContrastMode = 'auto' | 'on' | 'off';

const SYSTEM_CONTRAST = ['(prefers-contrast: more)', '(forced-colors: active)'];

export function systemWantsContrast(): boolean {
  return typeof matchMedia === 'function' && SYSTEM_CONTRAST.some((q) => matchMedia(q).matches);
}

export function applyContrastMode(mode: ContrastMode): () => void {
  if (mode !== 'auto' || typeof matchMedia !== 'function') {
    setContrast(mode === 'on');
    return () => {};
  }
  const lists = SYSTEM_CONTRAST.map((q) => matchMedia(q));
  const update = () => setContrast(lists.some((l) => l.matches));
  update();
  for (const l of lists) l.addEventListener('change', update);
  return () => { for (const l of lists) l.removeEventListener('change', update); };
}

type RGB = [number, number, number];
const toRgb = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const toHex = (c: RGB) => `#${c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;
export function luminance(hex: string): number {
  const c = toRgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export function onAccent(hex: string): '#000000' | '#ffffff' {
  const w = contrast(hex, '#ffffff'), k = contrast(hex, '#000000');
  return w >= 3 || w >= k ? '#ffffff' : '#000000';
}

export function accentTokens(hex: string): Record<string, string> | null {
  const c = toRgb(hex);
  if (!c) return null;
  const on = onAccent(hex);
  const away: RGB = on === '#ffffff' ? [0, 0, 0] : [255, 255, 255];
  return {
    '--color-accent': toHex(c),
    '--color-accent-hover': toHex(mix(c, away, 0.12)),
    '--color-accent-active': toHex(mix(c, away, 0.22)),
    '--color-on-accent': on,
  };
}

export function setAccent(hex: string | null | undefined) {
  const st = document.documentElement.style;
  const t = hex ? accentTokens(hex) : null;
  for (const k of ['--color-accent', '--color-accent-hover', '--color-accent-active', '--color-on-accent']) {
    if (t) st.setProperty(k, t[k]); else st.removeProperty(k);
  }
}
