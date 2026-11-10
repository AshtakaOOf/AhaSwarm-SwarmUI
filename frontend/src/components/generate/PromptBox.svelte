<script lang="ts">
    import LImage from '@lucide/svelte/icons/image';
    import LPlus from '@lucide/svelte/icons/plus';
    import LPin from '@lucide/svelte/icons/pin';
    import LPinOff from '@lucide/svelte/icons/pin-off';
    import LLayers from '@lucide/svelte/icons/layers';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { promptDock } from '../../lib/state/promptdock.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { gen } from '../../lib/state/gen.svelte';
    import { userSettings } from '../../lib/state/usersettings.svelte';
    import { fileToDataUrl } from '../../lib/util/metadata';
    import { api } from '../../lib/api/swarm';
    import { presetState } from '../../lib/state/presets.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import { shiftWeight, moveCommaElement } from '../../lib/util/promptEdit';
    import { suggest, parseCompletions, type Suggestion } from '../../lib/util/autocomplete';
    import { tick } from 'svelte';

    function tokenCounter(key: string) {
        const st = $state({ text: '', count: 0 });
        let counting = false, recount = false;
        async function run() {
            if (counting) {
                recount = true;
                return;
            }
            counting = true;
            try {
                const res = await api.countTokens(`${paramState.values[key] ?? ''}`);
                st.count = res.count;
                st.text = `${res.count}/${Math.max(75, Math.ceil(res.count / 75) * 75)}`;
            }
            catch {
                st.text = '';
            }
            counting = false;
            if (recount) {
                recount = false;
                run();
            }
        }
        $effect(() => {
            void paramState.values[key];
            if (paramState.loaded && paramState.byId[key]) {
                run();
            }
        });
        return st;
    }
    const posTok = tokenCounter('prompt');
    const negTok = tokenCounter('negativeprompt');
    import { Chip, IconButton, Menu, ParamGroup, Suggestions, Textarea, type MenuItem } from '../ui';
    import GenerateControls from './GenerateControls.svelte';
    const mq = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;
    let narrow = $state(mq?.matches ?? false);
    $effect(() => { if (!mq) { return; } const on = (e: MediaQueryListEvent) => (narrow = e.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); });

    const MEDIA_PARAM = (type: string) => (type.startsWith('image/') ? 'promptimages' : type.startsWith('audio/') ? 'promptaudios' : type.startsWith('video/') ? 'promptvideos' : null);
    let fileInput: HTMLInputElement | undefined = $state();
    let dragging = $state(false);
    async function addFiles(files: Iterable<File>): Promise<boolean> {
        let any = false;
        for (const f of files) {
            const key = MEDIA_PARAM(f.type);
            if (!key || !paramState.byId[key]) {
                continue;
            }
            const data = await fileToDataUrl(f);
            paramState.values[key] = [...(paramState.values[key] ?? []), { data, filename: f.name }];
            any = true;
        }
        return any;
    }
    function removeMedia(key: string, i: number) {
        const list = [...(paramState.values[key] ?? [])];
        list.splice(i, 1);
        paramState.values[key] = list;
    }
    const media = $derived(['promptimages', 'promptaudios', 'promptvideos'].flatMap(key => ((paramState.values[key] ?? []) as any[]).map((m, i) => ({ key, i, m }))));
    function onpaste(e: ClipboardEvent) {
        const files = [...(e.clipboardData?.files ?? [])];
        if (files.some(f => MEDIA_PARAM(f.type))) {
            e.preventDefault();
            addFiles(files);
        }
    }
    function ondrop(e: DragEvent) {
        dragging = false;
        const files = [...(e.dataTransfer?.files ?? [])];
        if (files.some(f => MEDIA_PARAM(f.type))) {
            e.preventDefault();
            addFiles(files);
        }
    }

    const hasNeg = $derived(!!paramState.byId['negativeprompt']);

    const boxEl = (key: string) => document.getElementById(key === 'prompt' ? 'prompt-pos' : 'prompt-neg') as HTMLTextAreaElement | null;

    // manually sized prompt boxes: grow to fit inserted text (e.g. Reuse Parameters), never shrink
    function growToFit(key: string) {
        const el = boxEl(key);
        if (!el) {
            return;
        }
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || 19;
        const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
        const max = 6 * lh + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + border;
        if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight < max) {
            el.style.height = `${Math.min(el.scrollHeight + border, max)}px`;
        }
    }
    $effect(() => {
        void paramState.values['prompt'];
        void paramState.values['negativeprompt'];
        void promptDock.negOpen;
        growToFit('prompt');
        growToFit('negativeprompt');
    });

    async function applyEdit(key: string, edit: { text: string; selStart: number; selEnd: number } | null) {
        if (!edit) {
            return;
        }
        paramState.set(key, edit.text);
        await tick();
        const el = boxEl(key);
        el?.setSelectionRange(edit.selStart, edit.selEnd);
    }

    const completions = $derived(parseCompletions(presetState.userData?.autocompletions));
    const clean = (n: string) => n.replace(/\.(safetensors|sft|pt|ckpt|bin|gguf)$/i, '');
    let sugg = $state<Suggestion[]>([]);
    let suggFor = $state<string | null>(null);
    let suggIdx = $state(0);
    function refreshSuggestions(key: string) {
        const el = boxEl(key);
        if (!el || document.activeElement !== el) {
            sugg = [];
            return;
        }
        const before = el.value.substring(0, el.selectionStart ?? el.value.length);
        sugg = suggest(before, {
            wildcards: paramState.wildcards ?? [],
            presets: presetState.all.map(p => p.title),
            loras: (paramState.models['LoRA'] ?? []).map(m => clean(Array.isArray(m) ? m[0] : `${m}`)),
            embeds: (paramState.models['Embedding'] ?? []).map(m => clean(Array.isArray(m) ? m[0] : `${m}`)),
            yolo: paramState.byId['yolomodelinternal']?.values ?? [],
            entries: completions,
            matchMode: `${userSettings.get('autocomplete.matchmode', 'Bucketed')}`,
            sortMode: `${userSettings.get('autocomplete.sortmode', 'Active')}`,
        });
        suggFor = key;
        const first = sugg.findIndex(x => x.apply !== undefined);
        suggIdx = first === -1 ? 0 : first;
    }
    async function applySuggestion(key: string, sg: Suggestion) {
        const el = boxEl(key);
        if (!el || sg.apply === undefined) {
            return;
        }
        const cursor = el.selectionStart ?? el.value.length;
        const pre = el.value.substring(0, sg.index);
        const post = el.value.substring(cursor);
        const at = pre.length + sg.apply.length;
        paramState.set(key, pre + sg.apply + post);
        await tick();
        el.focus();
        el.setSelectionRange(at, at);
        refreshSuggestions(key);
    }
    const suggItems = $derived(sugg.map((sg, i) => ({ id: i, label: sg.apply === undefined ? (sg.desc ?? '') : sg.label, detail: sg.apply === undefined ? undefined : sg.desc, disabled: sg.apply === undefined, tag: sg.tag, sg })));
    let suggOpen = $state(false);
    $effect(() => { suggOpen = sugg.length > 0; });
    let posAnchor: HTMLDivElement | undefined = $state();
    let negAnchor: HTMLDivElement | undefined = $state();
    function keydown(key: string, e: KeyboardEvent) {
        const el = e.currentTarget as HTMLTextAreaElement;
        if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            const step = parseFloat(`${userSettings.get('ui.weightstep', '0.1')}`) || 0.1;
            applyEdit(key, shiftWeight(el.value, el.selectionStart, el.selectionEnd, e.key === 'ArrowUp', step));
            return;
        }
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && `${userSettings.get('ui.tagmovehotkeyenabled', false)}` === 'true') {
            e.preventDefault();
            applyEdit(key, moveCommaElement(el.value, el.selectionStart, el.selectionEnd, e.key === 'ArrowLeft'));
            return;
        }
        if (e.key === 'Enter' && !e.isComposing && ((e.ctrlKey || e.metaKey) || (!e.shiftKey && userSettings.get('ui.enterkeygenerates', true)))) {
            e.preventDefault();
            gen.generate();
        }
    }
    function oninputFor(key: string, v: string) {
        paramState.set(key, v);
        tick().then(() => refreshSuggestions(key));
    }

    let acceptKind = $state('image/*,audio/*,video/*');
    async function pickFiles(accept: string) {
        acceptKind = accept;
        await tick();
        fileInput?.click();
    }
    async function insertText(text: string) {
        const cur = `${paramState.values['prompt'] ?? ''}`;
        paramState.set('prompt', cur + text);
        await tick();
        const el = boxEl('prompt');
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
        refreshSuggestions('prompt');
    }
    const plusItems = $derived<MenuItem[]>([
        { label: 'Auto Segment Refinement', title: 'Adds a <segment:…> tag to automatically find and re-generate part of the image', onselect: () => insertText(' <segment:face>') },
        { label: 'Regional Prompt', title: 'Adds a <region:x,y,w,h> tag to prompt a sub-region of the image', onselect: () => insertText(' <region:0,0,0.5,1> ') },
        { separator: true },
        { label: 'Add Temporary Image', icon: LImage, disabled: !paramState.byId['promptimages'], onselect: () => pickFiles('image/*') },
        { label: 'Add Temporary Video', disabled: !paramState.byId['promptvideos'], onselect: () => pickFiles('video/*') },
        { label: 'Add Temporary Audio', disabled: !paramState.byId['promptaudios'], onselect: () => pickFiles('audio/*') },
        { label: 'Select or Upload Image', disabled: true, title: 'The Inputs browser is not available in AhaSwarm yet' },
        { separator: true },
        { label: 'Other...', title: 'Start a "<" prompt syntax tag and list the options', onselect: () => insertText(' <') },
        { separator: true },
        { label: 'Add LoRA…', icon: LLayers, disabled: !paramState.byId['loras'], title: 'Open the LoRAs browser', onselect: () => ui.showBottom('LoRA') },
    ]);
    const loras = $derived(paramState.byId['loras'] ? paramState.loras : []);
</script>

{#snippet suggestBox(key: string)}
    <Suggestions anchor={key === 'prompt' ? posAnchor : negAnchor} items={suggItems} bind:open={suggOpen} bind:active={suggIdx}
        id="{key === 'prompt' ? 'prompt' : 'neg'}-suggest" label="Suggestions" onpick={(it) => applySuggestion(key, it.sg)} onclose={() => (sugg = [])}>
        {#snippet item(it, on)}
            <span class="min-w-0 flex-1 truncate {it.disabled ? 'text-ink-3' : ''}" style={it.tag ? `color: var(--tag-${it.tag}, inherit)` : ''}>{it.label}</span>
            {#if it.detail}<span class="ml-2 max-w-[50%] shrink-0 truncate text-small {on ? 'text-ink-2' : 'text-ink-3'}">{it.detail}</span>{/if}
        {/snippet}
    </Suggestions>
{/snippet}

{#snippet tokens(t: { text: string; count: number })}
    {#if t.text}<span class="tokens text-small tabular-nums text-ink-3" style:color={t.count > 75 ? 'var(--color-warning)' : undefined} title="Token count ({t.count > 75 ? 'past the 75-token chunk boundary' : '75 per chunk'})">{t.text}</span>{/if}
{/snippet}

{#snippet pinBtn()}
    <Menu items={plusItems} label="Prompt tools">
        {#snippet trigger(p)}<IconButton {...p} icon={LPlus} label="Prompt tools: image/video/audio prompts, LoRAs, segments, regions, syntax" />{/snippet}
    </Menu>
    <IconButton icon={promptDock.pinned ? LPinOff : LPin} label={promptDock.pinned ? 'Unpin from bottom' : 'Pin to bottom'}
        onclick={() => promptDock.setPinned(!promptDock.pinned)} />
{/snippet}

<div class="prompt-card" class:pinned={promptDock.pinned} data-pinned={promptDock.pinned}>
<ParamGroup title="Prompt" id="grp-prompt" headClass="ui-dense" open={promptDock.open} ontoggle={(o: boolean) => promptDock.setOpen(o)} actions={pinBtn}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fields" class:dragging {onpaste} {ondrop} ondragover={(e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); dragging = true; } }} ondragleave={() => (dragging = false)}>
        {#if media.length}
            <div class="chips">
                {#if media.length}<div class="chipset" role="group" aria-label="Prompt media">{#each media as x (x.key + x.i)}<Chip label={x.m.filename ?? 'pasted media'} title={x.m.filename} removeLabel="Remove {x.m.filename ?? 'media'}" onremove={() => removeMedia(x.key, x.i)}>{#if x.key === 'promptimages'}<img src={x.m.data} alt="" class="pm-thumb" />{/if}</Chip>{/each}</div>{/if}
            </div>
        {/if}
        <input bind:this={fileInput} type="file" accept={acceptKind} multiple hidden onchange={(e) => { addFiles([...(e.currentTarget.files ?? [])]); e.currentTarget.value = ''; }} />
        <div class="anchor" bind:this={posAnchor}>
            <Textarea id="prompt-pos" aria-label="Prompt" rows={2} autosize={false} class="pr-14"
                placeholder="Type your prompt here… (Ctrl/⌘+Enter generates; drag/paste an image for Image Prompting)"
                value={`${paramState.values['prompt'] ?? ''}`} oninput={(v: string) => oninputFor('prompt', v)} onkeydown={(e: KeyboardEvent) => keydown('prompt', e)}
                onclick={() => refreshSuggestions('prompt')} />
            {@render tokens(posTok)}
            {#if suggFor === 'prompt'}{@render suggestBox('prompt')}{/if}
        </div>
        {#if hasNeg}
                <div class="anchor" bind:this={negAnchor}>
                    <button type="button" class="negtoggle" aria-expanded={promptDock.negOpen} onclick={() => promptDock.setNegOpen(!promptDock.negOpen)}>
                        <ChevronDown size={13} class="chev shrink-0 {promptDock.negOpen ? '' : '-rotate-90'}" aria-hidden="true" />
                        <span>Negative prompt</span>
                    </button>
                    {#if promptDock.negOpen}
                        <Textarea id="prompt-neg" aria-label="Negative prompt" rows={1} autosize={false} class="pr-14"
                            placeholder="Optionally, type a negative prompt here…"
                            value={`${paramState.values['negativeprompt'] ?? ''}`} oninput={(v: string) => oninputFor('negativeprompt', v)} onkeydown={(e: KeyboardEvent) => keydown('negativeprompt', e)}
                            onclick={() => refreshSuggestions('negativeprompt')} />
                        {@render tokens(negTok)}
                        {#if suggFor === 'negativeprompt'}{@render suggestBox('negativeprompt')}{/if}
                    {/if}
                </div>
        {/if}
    </div>
    {#if narrow}<div class="toolbar"><GenerateControls block /></div>{/if}
</ParamGroup>
</div>

<style>
    .prompt-card { padding-bottom: 0; }
    .prompt-card.pinned {
        position: sticky; bottom: 0; z-index: 5;
        margin: auto calc(-1 * var(--param-gutter)) 0; padding: 0 var(--param-gutter) var(--param-gutter);
        background: var(--param-panel-bg); box-shadow: var(--shadow-panel);
    }
    .fields { display: flex; flex-direction: column; gap: var(--param-row-gap); }
    .prompt-card > :global(.ui-group.ui-group) { padding-left: var(--space-1); }
    .prompt-card > :global(.ui-group.ui-group > h3), .negtoggle { padding-left: calc(var(--param-pad-x) - var(--space-1)); }
    @container params (max-width: 339px) {
        .prompt-card > :global(.ui-group.ui-group > h3), .negtoggle { padding-left: 0; }
    }
    .anchor { position: relative; }
    .negtoggle { display: flex; align-items: center; gap: 2px; height: 20px; padding: 0; background: none; border: 0; color: var(--color-ink-3); font-size: var(--text-small); text-transform: uppercase; cursor: pointer; }
    .negtoggle:hover { color: var(--color-ink); }
    .negtoggle :global(.chev) { transition: transform var(--motion-fast); }
    .tokens { position: absolute; right: 10px; bottom: 6px; line-height: 19px; pointer-events: none; }
    .chips { display: flex; flex-direction: column; gap: var(--space-1); }
    .chipset { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .pm-thumb { width: 20px; height: 20px; object-fit: cover; border-radius: var(--radius-sm); }
    .toolbar { display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1); }
    .dragging { background: var(--color-control-active); }
</style>
