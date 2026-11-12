import { api } from '../api/swarm';
import { paramState } from '../state/params.svelte';

export interface TextEdit {
    text: string;
    selStart: number;
    selEnd: number;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// classic matchWildcard
export function wildcardTagPattern(name: string): RegExp {
    return new RegExp(`<((?:wildcard|wc)(?:\\[\\d+(?:-\\d+)?\\])?):${escapeRegExp(name)}>`, 'g');
}

export function promptHasWildcard(prompt: string, name: string): boolean {
    return wildcardTagPattern(name).test(prompt);
}

export function toggleWildcard(text: string, name: string, cursor: number): TextEdit {
    if (promptHasWildcard(text, name)) {
        const next = text.replace(wildcardTagPattern(name), ' ').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '');
        const at = Math.max(0, Math.min(cursor, next.length));
        return { text: next, selStart: at, selEnd: at };
    }
    const tag = `<wildcard:${name}>`;
    const at = Math.max(0, Math.min(cursor, text.length));
    const pre = text.slice(0, at);
    const post = text.slice(at);
    const left = pre.length && !/\s$/.test(pre) ? `${pre} ` : pre;
    const right = post.length && !/^\s/.test(post) ? ` ${post}` : post;
    const out = left + tag + right;
    const pos = left.length + tag.length;
    return { text: out, selStart: pos, selEnd: pos };
}

// toggle the tag in the main prompt and leave the cursor just after it (classic selectWildcard)
export function toggleWildcardInPrompt(name: string): void {
    const el = document.getElementById('prompt-pos') as HTMLTextAreaElement | null;
    const text = `${paramState.values['prompt'] ?? ''}`;
    const cursor = el?.selectionStart ?? text.length;
    const edit = toggleWildcard(text, name, cursor);
    paramState.set('prompt', edit.text);
    requestAnimationFrame(() => {
        const box = document.getElementById('prompt-pos') as HTMLTextAreaElement | null;
        if (!box) {
            return;
        }
        box.focus();
        box.setSelectionRange(edit.selStart, edit.selEnd);
    });
}

export function wildcardRawIsCut(raw: string | undefined): boolean {
    return !!raw && raw.length >= 515 && raw.endsWith('...');
}

const fullText = new Map<string, string>();
const textLoading = new Set<string>();

export function cachedWildcardText(name: string): string | undefined {
    return fullText.get(name);
}

export function forgetWildcardText(name?: string): void {
    if (name) {
        fullText.delete(name);
        textLoading.delete(name);
    }
    else {
        fullText.clear();
        textLoading.clear();
    }
}

export function ensureWildcardText(names: string[], onupdate: () => void): void {
    const todo = names.filter(n => !fullText.has(n) && !textLoading.has(n));
    if (!todo.length) {
        return;
    }
    let i = 0;
    const worker = async () => {
        while (i < todo.length) {
            const name = todo[i++];
            textLoading.add(name);
            try {
                const res = await api.describeModel(name, 'Wildcards') as { model?: { raw?: string }; raw?: string };
                const card = res.model ?? res;
                fullText.set(name, `${card.raw ?? ''}`);
            }
            catch {
                fullText.set(name, ''); // keep the list preview; don't retry this session
            }
            finally {
                textLoading.delete(name);
            }
            onupdate();
        }
    };
    void Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
}

export function wildcardPreview(raw: string | undefined, lines = Infinity): string {
    const all = `${raw ?? ''}`.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return (lines < Infinity ? all.slice(0, lines) : all).join('\n');
}

function checkWildcardToggle(): void {
    const mid = toggleWildcard('hello world', 'people/hair', 5);
    if (mid.text !== 'hello <wildcard:people/hair> world') {
        throw new Error(`wildcard insert: ${mid.text}`);
    }
    const again = toggleWildcard('a <wc[2]:hair> cat <wildcard[1-3]:hair>', 'hair', 0);
    if (again.text !== 'a cat') {
        throw new Error(`wildcard remove: ${again.text}`);
    }
    if (!promptHasWildcard('<wildcard:a.b>', 'a.b') || promptHasWildcard('<wildcard:ab>', 'a.b')) {
        throw new Error('wildcard match');
    }
}
checkWildcardToggle();
