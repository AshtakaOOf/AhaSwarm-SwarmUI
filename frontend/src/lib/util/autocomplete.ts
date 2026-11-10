
export interface Suggestion {
    label: string;
    desc?: string;
    apply?: string;
    index: number;
    tag?: string;
}

export interface CompletionEntry {
    name: string;
    low: string;
    clean: string;
    count: number;
    countDisplay?: string;
    tag: string;
    alts: string[];
}

export interface CompletionSources {
    wildcards: string[];
    presets: string[];
    loras: string[];
    embeds: string[];
    yolo: string[];
    entries: CompletionEntry[] | null;
    matchMode: string;
    sortMode: string;
}

type Completer = (suffix: string, prompt: string, src: CompletionSources) => (string | Suggestion)[];
interface Prefix {
    description: string;
    completer: Completer;
    selfStanding: boolean;
    isAlt: boolean;
}

const info = (...lines: string[]) => () => lines.map(l => `\n${l}`);

function ordered(set: string[], low: string): string[] {
    const pre: string[] = [], suf: string[] = [];
    for (const item of set) {
        const n = item.toLowerCase();
        if (!n.includes(low)) {
            continue;
        }
        (n.startsWith(low) ? pre : suf).push(item);
    }
    return pre.concat(suf);
}

function setNames(prompt: string, tag: string, low: string): string[] {
    const out: string[] = [];
    const re = new RegExp(`<${tag}\\[(.*?)\\]:`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(prompt))) {
        const name = m[1].split(',')[0];
        if (name.toLowerCase().includes(low)) {
            out.push(name);
        }
    }
    return out;
}

const PREFIXES: Record<string, Prefix> = {};
function reg(name: string, description: string, completer: Completer, selfStanding = false) {
    PREFIXES[name] = { description, completer, selfStanding, isAlt: false };
}
function alt(name: string, of: string) {
    PREFIXES[name] = { ...PREFIXES[of], isAlt: true };
}

reg('random', 'Select from a set of random words to include', info('Specify a comma-separated list of words to choose from, like "<random:cat,dog,elephant>".', 'You can use "||" instead of "," if you need to include commas in your values.', 'You can use eg "1-5" to pick a random number in a range.'));
reg('random[2-4]', 'Selects multiple options from a set of random words to include', info('Specify a comma-separated list of words to choose from, like "<random[2]:cat,dog,elephant>".', 'You can use "||" instead of "," if you need to include commas in your values. You can use eg "1-5" to pick a random number in a range.', 'Put a comma in the input (eg "random[2,]:") to make the output have commas too.'));
reg('alternate', 'Cause multiple different words or phrases to be alternated between.', info('Specify a comma-separated list of words to choose from, like "<alternate:cat,dog>".', 'You can use "||" instead of "," if you need to include commas in your values.'));
reg('fromto[0.5]', 'Have the prompt change after a given timestep.', info('Specify in the brackets a timestep like 10 (for step 10) or 0.5 (for halfway through).', 'In the data area specify the before and the after separate by "," or "|".', 'For example, "<fromto[10]:cat,dog>" switches from "cat" to "dog" at step 10.'));
reg('weight[1.5]', 'Change how strongly the model attends to a section of the prompt.', info('Use like "<weight[1.5]:some text>" to apply a weight of 1.5 to "some text".', 'Values above 1 are more important, values below 1 (eg 0.5) are less important.', 'Some text encoders such as CLIP natively support weighting. Others it is hacked-in with conditioning multiplication (this may have side effects!).', 'You can also hold Control and press the up/down arrow keys to change the weight of selected text.'));
reg('wildcard', 'Select a random line from a wildcard file (presaved list of options)', (s, _p, src) => {
    const low = s.toLowerCase();
    if (low.includes(':')) {
        return ['\nWildcard contents are not listed here yet.'];
    }
    return src.wildcards.length ? ordered(src.wildcards, low) : ['\nNo wildcards found.'];
});
alt('wc', 'wildcard');
reg('wildcard[2-4]', 'Select multiple random lines from a wildcard file (presaved list of options) (works same as "random" but for wildcards)', (s, _p, src) => ordered(src.wildcards, s.toLowerCase()));
reg('repeat[3]', 'Repeat a value several times', info('Use for example like "<repeat[3]:very> big" to get "very very very big",', 'or "<repeat[1-3]:very>" to get randomly between 1 to 3 "very"s,', 'or <repeat[3]:<random:cat,dog>>" to get "cat" or "dog" 3 times in a row eg "cat dog cat".'));
reg('preset', 'Forcibly apply a preset onto the current generation (useful eg inside wildcards or other automatic inclusions - normally use the Presets UI tab)', (s, _p, src) => ordered(src.presets, s.toLowerCase()));
alt('p', 'preset');
reg('param', 'Read a raw parameter value.', info('Read a parameter value, for example "<param:CFG Scale>" or "<param:cfgscale>" to read the value of CFG Scale.'));
reg('param[param_id]', 'Set a raw parameter value directly.', info('Set a parameter value directly, for example "<param[CFG Scale]:1>" or "<param[cfgscale]:1>" to set CFG Scale to 1.', 'You can combine with sub-syntax, eg "<param[cfgscale]:<random:1,2,3>>" to set CFG Scale to a random value.'));
reg('embed', 'Use a pretrained CLIP TI Embedding', (s, _p, src) => ordered(src.embeds, s.toLowerCase()));
alt('embedding', 'embed');
reg('lora', 'Forcibly apply a pretrained LoRA model (useful eg inside wildcards or other automatic inclusions - normally use the LoRAs UI tab)', (s, _p, src) => ordered(src.loras, s.toLowerCase()));
reg('region', 'Apply a different prompt to a sub-region within the image', info('x,y,width,height eg "0.25,0.25,0.5,0.5"', 'or x,y,width,height,strength eg "0,0,1,1,0.5"', 'where strength is how strongly to apply the prompt to the region (vs global prompt). Can do "region:background" for background-only region.'));
reg('object', 'Select a sub-region inside the image and inpaint over it with a different prompt', info('x,y,width,height eg "0.25,0.25,0.5,0.5"', 'or x,y,width,height,strength,strength2 eg "0,0,1,1,0.5,0.4"', 'where strength is how strongly to apply the prompt to the region (vs global prompt) on the general pass, and strength2 is how strongly to inpaint (ie InitImageCreativity).'));
reg('extend', 'Use an Image2Video model to extend a video repeatedly', info('Input is a frame count, also follow this tag with a prompt for the section.', 'For example, "<extend:81> the cat runs" to add an 81 frame clip of your cat running.', 'See also the "Video Extend" parameter group.'));
reg('segment', 'Automatically segment an area by CLIP matcher and inpaint it (optionally with a unique prompt)', (s, _p, src) => {
    const low = s.toLowerCase();
    if (low.startsWith('yolo-') && src.yolo.length) {
        return ordered(src.yolo.map(m => `yolo-${m}`), low);
    }
    return info('Specify before the ">" some text to match against in the image, like "<segment:face>".', 'Can also do "<segment:text,creativity,threshold>" eg "face,0.6,0.5" where creativity is InitImageCreativity, and threshold is mask matching threshold for CLIP-Seg.', 'You can use a negative threshold value like "<segment:face,0.6,-0.5>" to invert the mask.', 'You may use the "yolo-" prefix to use a YOLOv8 seg model,', 'For more advanced usages and a link to relevant docs, click the "+" button next to the prompt box, then "Auto Segment Refinement".')();
});
reg('setvar[var_name]', 'Store text for reference later in the prompt', info('Save the content of the tag into the named variable. eg "<setvar[colors]: red and blue>", then use like "<var:colors>"', 'Variables can include the results of other tags. eg "<setvar[expression]: <random: smiling|frowning|crying>>"', 'Reference stored values later in the prompt with the <var:> tag', 'The setvar tag emits a copy the variable value in place. You can not do this with eg "<setvar[colors,false]: red and blue>"'));
reg('var', 'Reference a previously saved variable later', (s, prompt) => {
    const found = setNames(prompt, 'setvar', s.toLowerCase());
    return found.length ? found : info('Recall a value previously saved with <setvar[name]:...>, use like "<var:name>"', '"setvar" must be used earlier in the prompt, then "var" later')();
});
reg('setmacro[macro_name]', 'Store raw text for reference later in the prompt', info('Save the raw content of the tag into the named macro. eg "<setmacro[color]:<random:red|blue|green>>", then use like "<macro:color>"', 'Macro content will be re-evaluated each time it is used eg "<macro:color> hair, <macro:color> eyes" might produce "red hair, blue eyes', 'Reference macros later in the prompt with the <macro:> tag', 'The setmacro tag emits a copy the variable value in place. You can not do this with eg "<setmacro[colors,false]: red and blue>"'));
reg('macro', 'Reference a previously saved macro', (s, prompt) => {
    const found = setNames(prompt, 'setmacro', s.toLowerCase());
    return found.length ? found : info('Recall a macro previously saved with <setmacro[name]:...>, use like "<macro:name>"', '"setmacro" must be used earlier in the prompt, then "macro" later')();
});
reg('clear', 'Automatically clear part of the image to transparent (by CLIP segmentation matching) (iffy quality, prefer the Remove Background parameter over this)', info('Specify before the ">" some text to match against in the image, like "<segment:background>"'));
reg('break', 'Split this prompt across multiple lines of conditioning to the model (helps separate concepts for long prompts).', () => [], true);
reg('base', 'Add a section of prompt text that is only used for the Base pass (excluding refiner/i2v/etc).', () => [], true);
reg('refiner', 'Add a section of prompt text that is only used for the Refine/Upscale pass.', () => [], true);
reg('pixeldecoder', 'Add a section of prompt text that is only used for the PiD pixel-decoder upscale pass.', () => [], true);
reg('video', 'Add a section of prompt text that replaces the prompt for the image-to-video generation pass.', () => [], true);
reg('videoswap', 'Add a section of prompt text that replaces the prompt for the image-to-video Swap pass (eg Wan 2.2 lownoise).', () => [], true);
reg('trigger', "Automatically fills with the current model or LoRA's trigger phrase(s), if any.", () => [], true);
reg('comment', "Add a discarded personal comment. Will not be treated as part of the 'real prompt'.", info('This is a personal comment, write a note to yourself.'));

export const PROMPT_PREFIXES = PREFIXES;

function largeCount(n: number): string {
    if (n > 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n > 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n > 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return `${n}`;
}

export function parseCompletions(raw: string[] | null | undefined): CompletionEntry[] | null {
    if (!raw || !raw.length) {
        return null;
    }
    return raw.map(val => {
        const s = val.split('\n');
        const count = parseInt(s[3] ?? '') || 0;
        return {
            name: s[0],
            clean: s[1] ?? s[0],
            low: (s[1] ?? s[0]).replace(/ /g, '_').toLowerCase(),
            tag: s[2] ?? '0',
            count,
            countDisplay: count ? largeCount(count) : undefined,
            alts: s[4] ? s[4].split(',').map(x => x.trim().toLowerCase()) : [],
        };
    });
}

export function findLastWordIndex(text: string): number {
    let index = -1;
    for (const cut of [' ', ',', '.', '\n']) {
        index = Math.max(index, text.lastIndexOf(cut));
    }
    return index + 1;
}

function tagMatches(word: string, src: CompletionSources): CompletionEntry[] {
    if (word.length <= 1 || !src.entries) {
        return [];
    }
    const low = word.toLowerCase();
    const starts: CompletionEntry[] = [], startsAlt: CompletionEntry[] = [], contains: CompletionEntry[] = [], all: CompletionEntry[] = [];
    for (const e of src.entries) {
        if (!(e.low.includes(low) || e.alts.some(a => a.includes(low)))) {
            continue;
        }
        if (e.low.startsWith(low)) starts.push(e);
        else if (e.alts.some(a => a.startsWith(low))) startsAlt.push(e);
        else contains.push(e);
        all.push(e);
    }
    const sort = (l: CompletionEntry[]) => {
        if (src.sortMode === 'Active') l.sort((a, b) => a.low.length - b.low.length || a.low.localeCompare(b.low));
        else if (src.sortMode === 'Alphabetical') l.sort((a, b) => a.low.localeCompare(b.low));
        else if (src.sortMode === 'Frequency') l.sort((a, b) => b.count - a.count);
    };
    let out: CompletionEntry[];
    if (src.matchMode === 'Contains') {
        sort(all);
        out = all;
    }
    else if (src.matchMode === 'StartsWith') {
        sort(starts);
        sort(startsAlt);
        out = starts.concat(startsAlt);
    }
    else {
        sort(starts);
        sort(startsAlt);
        sort(contains);
        out = starts.concat(startsAlt, contains);
    }
    return out.slice(0, 50);
}

/** suggestions for the text before the cursor (classic getPossibleList + onInput) */
export function suggest(prompt: string, src: CompletionSources): Suggestion[] {
    const wordIndex = findLastWordIndex(prompt);
    const tags: Suggestion[] = tagMatches(prompt.substring(wordIndex), src).map(e => ({
        label: e.clean, desc: e.countDisplay, apply: e.name, index: wordIndex, tag: e.tag,
    }));
    const lastBrace = prompt.lastIndexOf('<');
    if (lastBrace === -1 || prompt.lastIndexOf('>') > lastBrace) {
        return tags;
    }
    const content = prompt.substring(lastBrace + 1);
    const colon = content.indexOf(':');
    if (colon === -1) {
        const low = content.toLowerCase();
        return Object.entries(PREFIXES).filter(([n, p]) => n.toLowerCase().startsWith(low) && !p.isAlt)
            .map(([n, p]) => ({ label: n, desc: p.description, apply: p.selfStanding ? `<${n}>` : `<${n}:`, index: lastBrace }));
    }
    const prefix = content.substring(0, colon);
    const p = PREFIXES[prefix];
    if (!p) {
        return [];
    }
    return p.completer(content.substring(colon + 1), prompt, src).map(v => {
        if (typeof v === 'object') {
            return v;
        }
        if (v.startsWith('\n')) {
            return { label: '', desc: v.substring(1), index: lastBrace };
        }
        const apply = v.startsWith('\t') ? v.substring(1) : `<${prefix}:${v}>`;
        return { label: apply, apply, index: lastBrace };
    });
}
