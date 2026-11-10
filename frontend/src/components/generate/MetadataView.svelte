<script lang="ts">
    import { formatMetadataEntries, type MetaEntry } from '../../lib/util/metadataFormat';
    import { paramState } from '../../lib/state/params.svelte';
    import { parseMetadata } from '../../lib/util/metadata';
    import { isLoraRefActive, isModelRefActive, metadataLoras, metadataModels, toggleLoraRef, useModelRef } from '../../lib/state/metadataModels';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import { Chip, CopyButton } from '../ui';

    let { metadata }: { metadata: string | null } = $props();
    const formatted = $derived(formatMetadataEntries(metadata, id => paramState.byId[id]));
    const rawParams = $derived(parseMetadata(metadata)?.params ?? {});
    const models = $derived(metadataModels(rawParams));
    const loras = $derived(metadataLoras(rawParams));
    const modelIds = $derived(new Set(models.map(r => r.id)));
    const COMMON = ['seed', 'steps', 'cfgscale', 'sampler', 'scheduler', 'resolution', 'aspectratio', 'width', 'height', 'images', 'batchsize', 'vae', 'refinermodel', 'refinercontrolpercentage', 'refinerupscale', 'initimagecreativity'];
    // timing from sui_extra_data, shown with the common params instead of under More
    const SHOWN_EXTRA = ['generation_time', 'generationtime', 'prep_time'];
    const norm = (e: MetaEntry) => `${e.id}`.toLowerCase().replace(/[^a-z_]/g, '');
    const flat = (e: MetaEntry): string => (e.nested ? e.nested.map(n => `${n.key}: ${flat(n)}`).join(', ') : e.value);
    const isParam = (id: string) => !!paramState.byId[id];
    const human = (k: string) => k.replace(/^sui_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bId\b/g, 'ID').replace(/\bUrl\b/g, 'URL');
    function fmt(id: string, v: string): string {
        const k = id.toLowerCase(), t = `${v}`.trim();
        if (/time|duration|elapsed/.test(k)) {
            const pg = /^([\d.]+)\s*\(prep\)\s*and\s*([\d.]+)\s*\(gen\)/i.exec(t);
            if (pg) return `${(+pg[1]).toFixed(1)}s prep - ${(+pg[2]).toFixed(1)}s gen`;
            const m = /^(-?[\d.]+)\s*(ms|s|sec|secs|seconds?)?$/i.exec(t);
            if (m) { const n = +m[1] / (m[2]?.toLowerCase() === 'ms' ? 1000 : 1); return n >= 60 ? `${Math.floor(n / 60)}m ${Math.round(n % 60)}s` : `${n.toFixed(n < 10 ? 1 : 0)}s`; }
        }
        if (/date|created|modified|timestamp/.test(k)) {
            const d = /^\d{10,13}$/.test(t) ? new Date(+t * (t.length === 10 ? 1000 : 1)) : new Date(t);
            if (!isNaN(+d) && /\d{4}|^\d{10}/.test(t)) return /^\d{4}-\d{2}-\d{2}$/.test(t) ? d.toLocaleDateString(undefined, { timeZone: 'UTC' }) : d.toLocaleString();
        }
        if (/size|bytes/.test(k) && /^\d+$/.test(t)) { const n = +t; return n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`; }
        return t;
    }
    const tidy = (e: MetaEntry): MetaEntry => (isParam(`${e.id}`) ? e : { ...e, key: e.key === e.id ? human(`${e.key}`) : e.key, value: e.nested ? e.value : fmt(`${e.id}`, e.value) });
    // the original (raw) prompt starts collapsed only when its processed version is shown too
    const ALTERNATE: Record<string, string> = { originalprompt: 'processedprompt', originalnegativeprompt: 'negativeprompt' };
    const COLLAPSED = Object.keys(ALTERNATE);
    const pkey = (e: MetaEntry) => `${e.id}`.toLowerCase().replace(/[^a-z]/g, '');
    const collapsed = (p: MetaEntry) => COLLAPSED.includes(pkey(p)) && groups.prompts.some(o => pkey(o) === ALTERNATE[pkey(p)]);
    const groups = $derived.by(() => {
        const g = { prompts: [] as MetaEntry[], common: [] as MetaEntry[], more: [] as MetaEntry[] };
        for (const e of formatted.entries) {
            const id = norm(e);
            if (modelIds.has(`${e.id}`) || ['loras', 'loraweights', 'lorasectionconfinement'].includes(id)) continue;
            if (e.isPrompt && !e.nested) g.prompts.push(e);
            else if (e.nested) for (const n of e.nested) (SHOWN_EXTRA.includes(norm(n)) ? g.common : g.more).push(tidy({ ...n, key: `${n.key}` }));
            else if (COMMON.includes(id) && (isParam(`${e.id}`) || ['width', 'height', 'resolution'].includes(id))) g.common.push(e);
            else if (SHOWN_EXTRA.includes(id)) g.common.push(tidy(e));
            else g.more.push(tidy(e));
        }
        const w = g.common.find(e => norm(e) === 'width'), h = g.common.find(e => norm(e) === 'height');
        if (w && h) g.common.splice(g.common.indexOf(w), 1, { ...w, id: 'resolution', key: 'Resolution', value: `${w.value}×${h.value}` });
        if (w && h) g.common.splice(g.common.indexOf(h), 1);
        const rank = (e: MetaEntry) => { const i = COMMON.indexOf(norm(e)); return i < 0 ? COMMON.length + SHOWN_EXTRA.indexOf(norm(e)) : i; };
        g.common.sort((a, b) => rank(a) - rank(b));
        return g;
    });
</script>

{#if formatted.error}
    <p class="text-small text-ink-3">{formatted.error}</p>
{:else if !formatted.entries.length}
    <p class="text-small text-ink-3">No metadata.</p>
{:else}
    <div class="md">
        {#each groups.prompts as p (p.id)}
            <details class="block prompt" open={!collapsed(p)}>
                <summary class="lbl">
                    <ChevronDown size={15} class="chev" aria-hidden="true" />
                    <span title={`${p.id}`}>{p.key}</span>
                    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (only keeps the copy click from toggling the details) -->
                    <span class="copy" onclick={(e) => e.stopPropagation()}><CopyButton text={p.value} label="Copy {p.key}" /></span>
                </summary>
                <p class="txt">{p.value}</p>
            </details>
        {/each}
        {#if models.length}
            <div class="block">
                <div class="lbl"><span>Model{models.length > 1 ? 's' : ''}</span></div>
                <div class="chips">
                    {#each models as r (r.id)}
                        <Chip label={r.id === 'model' ? r.name : `${r.param}: ${r.name}`} variant={isModelRefActive(r) ? 'active' : 'default'} onclick={() => useModelRef(r)} />
                    {/each}
                </div>
            </div>
        {/if}
        {#if loras.length}
            <div class="block">
                <div class="lbl"><span>LoRAs</span></div>
                <div class="chips">
                    {#each loras as r (r.name)}
                        <Chip label={r.name} variant={isLoraRefActive(r) ? 'active' : 'default'} onclick={() => toggleLoraRef(r)}>
                            {#if r.weight !== 1}<span class="w">{r.weight}</span>{/if}
                        </Chip>
                    {/each}
                </div>
            </div>
        {/if}
        {#if groups.common.length}
            <dl class="grid">
                {#each groups.common as e (e.id)}<dt title={`${e.id}`}>{e.key}</dt><dd>{flat(e)}</dd>{/each}
            </dl>
        {/if}
        {#if groups.more.length}
            <details class="more">
                <summary><ChevronDown size={15} class="chev" aria-hidden="true" />More ({groups.more.length})</summary>
                <dl class="grid">
                    {#each groups.more as e (e.id + e.key)}<dt title={`${e.id}`}>{e.key}</dt><dd>{flat(e)}</dd>{/each}
                </dl>
            </details>
        {/if}
    </div>
{/if}

<style>
    .md { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-ui); color: var(--color-ink); min-width: 0; padding-bottom: calc(var(--space-6) + var(--space-3)); }

    .block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .lbl { display: flex; align-items: center; gap: var(--space-1); height: 20px; font-size: var(--text-small); color: var(--color-ink-3); text-transform: uppercase; }
    .lbl :global(.ctl) { height: 20px; width: 20px; }
    .txt { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .chips :global(.chip) { height: 24px; }
    .w { color: var(--color-ink-3); }
    /* label column is max-content but capped, so a long name wraps instead of pushing the value right */
    .grid { display: grid; grid-template-columns: fit-content(9em) minmax(0, 1fr); gap: 2px var(--space-3); margin: 0; }
    dt { color: var(--color-ink-3); overflow-wrap: anywhere; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .prompt summary { cursor: pointer; list-style: none; }
    .prompt summary::-webkit-details-marker { display: none; }
    .prompt summary :global(.chev) { flex: none; transform: rotate(-90deg); transition: transform var(--motion-fast); }
    .prompt[open] summary :global(.chev) { transform: rotate(0deg); }
    .prompt summary:hover { color: var(--color-ink); }
    .prompt .txt { padding-top: 2px; }
    .more summary { cursor: pointer; font-size: var(--text-small); color: var(--color-ink-3); text-transform: uppercase; height: 24px; display: flex; align-items: center; gap: var(--space-1); list-style: none; }
    .more summary::-webkit-details-marker { display: none; }
    .more summary :global(.chev) { flex: none; transform: rotate(-90deg); transition: transform var(--motion-fast); }
    .more[open] summary :global(.chev) { transform: rotate(0deg); }
    .more summary:hover { color: var(--color-ink); }
</style>
