export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface ToastAction {
  label: string;
  href?: string;
  onclick?: () => void;
}
export interface ToastOptions {
  kind?: ToastKind;
  title?: string;
  timeout?: number;
  action?: ToastAction;
}
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  title?: string;
  timeout: number;
  action?: ToastAction;
  count: number;
}

export const toasts: Toast[] = $state([]);
const timers = new Map<number, { t?: ReturnType<typeof setTimeout>; left: number; at: number }>();
let n = 0;

function arm(id: number, ms: number) {
  const s = timers.get(id) ?? { left: ms, at: 0 };
  clearTimeout(s.t);
  s.left = ms;
  s.at = Date.now();
  s.t = setTimeout(() => dismiss(id), ms);
  timers.set(id, s);
}

export function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
  clearTimeout(timers.get(id)?.t);
  timers.delete(id);
}

export function pause(id: number) {
  const s = timers.get(id);
  if (!s?.t) return;
  clearTimeout(s.t);
  s.t = undefined;
  s.left = Math.max(800, s.left - (Date.now() - s.at));
}
export function resume(id: number) {
  const s = timers.get(id);
  if (s && !s.t) arm(id, s.left);
}

export function toast(message: string, { kind = 'info', title, timeout = kind === 'error' ? 0 : 6000, action }: ToastOptions = {}) {
  const dup = toasts.find((t) => t.kind === kind && t.message === message && t.title === title);
  if (dup) {
    dup.count++;
    if (dup.timeout > 0) arm(dup.id, dup.timeout);
    return dup.id;
  }
  const id = ++n;
  toasts.push({ id, message, kind, title, timeout, action, count: 1 });
  if (timeout > 0) arm(id, timeout);
  return id;
}

export const toastSuccess = (m: string, o?: ToastOptions) => toast(m, { ...o, kind: 'success' });
export const toastWarning = (m: string, o?: ToastOptions) => toast(m, { ...o, kind: 'warning' });
export const toastError = (m: string, o?: ToastOptions) => toast(m, { ...o, kind: 'error' });
