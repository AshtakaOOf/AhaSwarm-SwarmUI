export interface ImportedPreset {
    title: string;
    description: string;
    preview_image?: string;
    param_map: Record<string, any>;
    is_starred?: boolean;
}

function addValueToPrompt(text: string): string {
    if (text.includes('{value}')) {
        return text;
    }
    if (text.includes('{prompt}')) {
        return text.replace('{prompt}', '{value}');
    }
    return `{value} ${text}`;
}

/** classic parseCsvLine */
function parseCsvLine(text: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const c = text.charAt(i);
        if (c === '"') {
            if (inQuotes) {
                if (i + 1 < text.length && text.charAt(i + 1) === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                inQuotes = true;
            }
        }
        else if (c === ',' && !inQuotes) {
            result.push(current);
            current = '';
        }
        else {
            current += c;
        }
    }
    result.push(current);
    return result;
}

function splitCsvLines(text: string): string[] {
    const lines: string[] = [];
    let isQuoted = false;
    let piece = '';
    let skipNext = false;
    for (const char of text) {
        if (char === '\\') {
            piece += char;
            skipNext = true;
            continue;
        }
        if (skipNext) {
            piece += char;
            skipNext = false;
            continue;
        }
        if (char === '"') {
            isQuoted = !isQuoted;
        }
        if (char === '\n' && !isQuoted) {
            lines.push(piece);
            piece = '';
        }
        else {
            piece += char;
        }
    }
    lines.push(piece);
    return lines;
}

function promptPreset(name: string, prompt: string, negativeprompt: string): ImportedPreset {
    return {
        title: name,
        description: `Imported prompt preset '${name}'`,
        preview_image: '',
        param_map: { prompt, negativeprompt },
    };
}

/** classic importPresetsToData: Swarm JSON, a name/prompt array, or prompt CSV. returns a map, an error string, or null */
export function importPresetsToData(text: string): Record<string, ImportedPreset> | string | null {
    if (text.trim() === '') {
        return null;
    }
    if (text.startsWith('{')) {
        const data = JSON.parse(text) as Record<string, ImportedPreset>;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return 'Data input looks invalid.';
        }
        return data;
    }
    if (text.startsWith('[')) {
        const parsed = JSON.parse(`{ "list": ${text} }`) as { list: { name?: string; prompt?: string; negative_prompt?: string; negativeprompt?: string }[] };
        const data: Record<string, ImportedPreset> = {};
        for (const item of parsed.list) {
            if (item.name) {
                data[item.name] = promptPreset(item.name, addValueToPrompt(item.prompt || ''), addValueToPrompt(item.negative_prompt || item.negativeprompt || ''));
            }
        }
        return data;
    }
    if (text.startsWith('name,prompt,negative_prompt')) {
        const data: Record<string, ImportedPreset> = {};
        for (const line of splitCsvLines(text).slice(1)) {
            if (line.trim() === '') {
                continue;
            }
            const parts = parseCsvLine(line);
            if (parts.length < 3 || parts.length > 5) {
                return `Invalid CSV line: ${line}`;
            }
            const name = parts[0];
            let prompt = parts[1];
            let negativeprompt = parts[2];
            if (!prompt && !negativeprompt) {
                continue;
            }
            prompt = addValueToPrompt(prompt || '');
            negativeprompt = addValueToPrompt(negativeprompt || '');
            data[name.toLowerCase()] = promptPreset(name, prompt, negativeprompt);
        }
        return data;
    }
    return 'data had no recognizable format';
}

export function presetsToJson(presets: { title: string }[]): string {
    const data: Record<string, unknown> = {};
    for (const p of presets) {
        data[p.title] = p;
    }
    return JSON.stringify(data, null, 4);
}

/** classic export CSV of name, prompt, negative_prompt */
export function presetsToCsv(presets: { title: string; param_map?: Record<string, any> }[]): string {
    let text = 'name,prompt,negative_prompt,\n';
    for (const preset of presets) {
        const prompt = `${preset.param_map?.prompt ?? ''}`;
        const negative = `${preset.param_map?.negativeprompt ?? ''}`;
        if (prompt || negative) {
            const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
            text += `${q(preset.title)},${q(prompt)},${q(negative)},\n`;
        }
    }
    return text;
}

/** classic downloadPlainText */
export function downloadText(name: string, text: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
