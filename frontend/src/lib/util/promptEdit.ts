
export interface TextEdit {
    text: string;
    selStart: number;
    selEnd: number;
}

const clean = (n: number) => `${parseFloat(n.toFixed(5))}`;

export function shiftWeight(full: string, selStart: number, selEnd: number, up: boolean, step = 0.1): TextEdit | null {
    if (selStart === selEnd) {
        let simple = full;
        for (const ch of ['\n', '\t', ',', '.']) {
            simple = simple.split(ch).join(' ');
        }
        const lastSpace = simple.lastIndexOf(' ', selStart - 1);
        selStart = lastSpace !== -1 ? lastSpace + 1 : 0;
        const nextSpace = simple.indexOf(' ', selStart);
        selEnd = nextSpace !== -1 ? nextSpace : simple.length;
    }
    let before = full.substring(0, selStart);
    let after = full.substring(selEnd);
    let mid = full.substring(selStart, selEnd);
    if (mid.trim() === '') {
        return null;
    }
    let strength = 1;
    while (mid.startsWith(' ')) {
        mid = mid.substring(1);
        before += ' ';
    }
    while (mid.endsWith(' ')) {
        mid = mid.substring(0, mid.length - 1);
        after = ' ' + after;
    }
    const weightPrefix = before.match(/<weight\[([0-9.-]*)\]:$/);
    if (weightPrefix && after.startsWith('>')) {
        before = before.substring(0, before.length - weightPrefix[0].length);
        strength = parseFloat(weightPrefix[1]);
        after = after.substring(1);
    }
    else {
        const parsed = mid.match(/^<weight\[([0-9.-]*)\]:(.*)>$/);
        if (parsed) {
            strength = parseFloat(parsed[1]);
            mid = parsed[2];
        }
        else {
            if (mid.startsWith('(')) {
                before += '(';
                mid = mid.substring(1);
            }
            const m = mid.trim().match(/(?:\:[0-9.-]*)?\)?$/);
            if (m && m[0]) {
                const cut = mid.length - m[0].length;
                if (cut === 0 || mid[cut - 1] !== '\\') {
                    after = mid.substring(cut) + after;
                    mid = mid.substring(0, cut);
                }
            }
            if (before.trimEnd().endsWith('(') && after.trimStart().startsWith(':')) {
                const postColon = after.trimStart().substring(1);
                let paren = postColon.indexOf(')');
                while (paren > 0 && postColon.substring(paren - 1).startsWith('\\)')) {
                    paren = postColon.indexOf(')', paren + 1);
                }
                if (paren !== -1) {
                    before = before.trimEnd();
                    before = before.substring(0, before.length - 1);
                    strength = parseFloat(postColon.substring(0, paren).trim());
                    after = postColon.substring(paren + 1);
                }
            }
            else if (before.trimEnd().endsWith('(') && after.trimStart().startsWith(')')) {
                before = before.trimEnd();
                before = before.substring(0, before.length - 1);
                strength = 1.1;
                after = after.trimStart().substring(1);
            }
        }
    }
    strength += up ? step : -step;
    const s = clean(strength);
    if (s === '1') {
        return { text: `${before}${mid}${after}`, selStart: before.length, selEnd: before.length + mid.length };
    }
    const tag = `<weight[${s}]:`;
    return { text: `${before}${tag}${mid}>${after}`, selStart: before.length + tag.length, selEnd: before.length + tag.length + mid.length };
}

export function moveCommaElement(full: string, cursor: number, cursorEnd: number, left: boolean): TextEdit | null {
    const parts = full.split(',');
    let textIndex = 0, index = -1;
    for (let i = 0; i < parts.length; i++) {
        const len = parts[i].length + 1;
        if (cursor >= textIndex && cursor < textIndex + len) {
            index = i;
            break;
        }
        textIndex += len;
    }
    if (index === -1) {
        return null;
    }
    const swap = left ? index - 1 : index + 1;
    if (swap < 0 || swap >= parts.length) {
        return null;
    }
    [parts[index], parts[swap]] = [parts[swap], parts[index]];
    let out = '', newCursor = 0;
    for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
            out += ',';
        }
        if (i === swap) {
            newCursor = out.length + (cursor - textIndex);
        }
        out += parts[i];
    }
    return { text: out, selStart: newCursor, selEnd: newCursor + (cursorEnd - cursor) };
}
