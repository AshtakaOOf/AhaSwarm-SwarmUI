// classic ansiHtml
const COLORS: Record<string, string> = {
    '30': '#000000', '31': '#cd3131', '32': '#0dbc79', '33': '#e5e510', '34': '#2472c8', '35': '#bc3fbc', '36': '#11a8cd', '37': '#e5e5e5',
    '90': '#666666', '91': '#f14c4c', '92': '#23d18b', '93': '#f5f543', '94': '#3b8eea', '95': '#d670d6', '96': '#29b8db', '97': '#ffffff',
};

export type AnsiSeg = { color: string | null; text: string };

export function ansiSegments(text: string): AnsiSeg[] {
    const out: AnsiSeg[] = [];
    let color: string | null = null;
    let buf = '';
    const flush = () => {
        if (buf) {
            out.push({ color, text: buf });
            buf = '';
        }
    };
    let i = 0;
    while (i < text.length) {
        if (text.charCodeAt(i) === 27 && text[i + 1] === '[') {
            let j = i + 2;
            while (j < text.length && text[j] !== 'm') {
                j++;
            }
            if (j < text.length) {
                flush();
                let next: string | null = color;
                for (const code of text.slice(i + 2, j).split(';')) {
                    if (code === '' || code === '0') {
                        next = null;
                    }
                    else if (COLORS[code]) {
                        next = COLORS[code];
                    }
                }
                color = next;
                i = j + 1;
                continue;
            }
        }
        buf += text[i];
        i++;
    }
    flush();
    return out;
}

export function stripAnsi(text: string): string {
    return ansiSegments(text).map(s => s.text).join('');
}

function checkAnsi(): void {
    const s = ansiSegments('a\u001b[31mred\u001b[0mok');
    if (s.length !== 3 || s[0].text !== 'a' || s[0].color || s[1].text !== 'red' || s[1].color !== '#cd3131' || s[2].text !== 'ok' || s[2].color) {
        throw new Error(`ansi: ${JSON.stringify(s)}`);
    }
    if (stripAnsi('a\u001b[31mred\u001b[0mok') !== 'aredok' || ansiSegments('plain')[0]?.text !== 'plain') {
        throw new Error('ansi plain');
    }
}
checkAnsi();
