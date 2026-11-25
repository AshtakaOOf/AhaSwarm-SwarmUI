import { gen } from '../state/gen.svelte';

/** true when the event landed in a field the user is typing into */
export function typingIn(e: Event): boolean {
    const el = e.target;
    if (!(el instanceof HTMLElement)) {
        return false;
    }
    if (el.isContentEditable) {
        return true;
    }
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
    }
    if (tag !== 'INPUT') {
        return false;
    }
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color', 'hidden'].includes(type);
}

/** classic shiftToNextImagePreview: walk gen.ordered by dir (-1 previous, +1 next) */
export function stepCurrent(dir: number): boolean {
    const list = gen.ordered;
    if (!list.length) {
        return false;
    }
    const cur = gen.current;
    const i = cur ? list.findIndex(o => o.src === cur.src) : (dir > 0 ? -1 : 0);
    const n = i + dir;
    if (n < 0 || n >= list.length) {
        return false;
    }
    gen.current = list[n];
    return true;
}

function inNav(el: EventTarget | null, sel: string): boolean {
    return el instanceof Element && !!el.closest(sel);
}

/** classic currentimagehandler window keydown: arrows when current/batch/body focused; ctrl+enter generates */
export function onGenerateKeys(e: KeyboardEvent, opts: { generate?: () => void; fullscreen?: boolean }): boolean {
    if (e.defaultPrevented || e.altKey || e.isComposing) {
        return false;
    }
    const genKey = e.key === 'Enter' && (e.ctrlKey || e.metaKey) && opts.generate;
    if (genKey) {
        if (typingIn(e) && (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return false;
        }
        if (document.querySelector('.ui-modal')) {
            return false;
        }
        e.preventDefault();
        opts.generate!();
        return true;
    }
    if (e.ctrlKey || e.metaKey || typingIn(e) || opts.fullscreen) {
        return false;
    }
    const focus = document.activeElement;
    const ok = !focus || focus === document.body || focus === document.documentElement || inNav(focus, '[data-img-nav]');
    if (!ok) {
        return false;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        return stepCurrent(-1);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        return stepCurrent(1);
    }
    return false;
}
