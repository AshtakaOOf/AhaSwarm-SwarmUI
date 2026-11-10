<script lang="ts">
    import LSave from '@lucide/svelte/icons/save';
    import LUndo from '@lucide/svelte/icons/undo-2';
    import { untrack } from 'svelte';
    import LSearchX from '@lucide/svelte/icons/search-x';
    import { ui } from '../../lib/state/ui.svelte';
    import { Button, Dropdown, EmptyState, Grid, NumberInput, InfoButton, ParamGroup, SettingsSearch, Skeleton, TextInput, Toggle, matchesQuery, queryWords } from '../ui';

    let { load, save, label }: { load: () => Promise<Record<string, any>>; save: (altered: Record<string, any>) => Promise<any>; label: string } = $props();
    let query = $state('');
    let tree = $state<Record<string, any> | null>(null);
    let err = $state<string | null>(null);
    let known: Record<string, any> = {};
    let altered = $state<Record<string, any>>({});
    let saving = $state(false);
    const count = $derived(Object.keys(altered).length);
    const searching = $derived(queryWords(query).length > 0);
    const leafMatch = (s: any, key: string) => matchesQuery(query, s?.name, human(s?.name ?? ''), plain(s?.description), key);
    const anyShown = (o: Record<string, any>, p: string): boolean =>
        Object.entries(o).some(([k, v]) => (v?.type === 'group' ? anyShown(v.value, `${p}${k}.`) : leafMatch(v, `${p}${k}`)));
    const total = $derived.by(() => {
        if (!tree || !searching) return 0;
        let n = 0;
        const walk = (o: Record<string, any>, p: string) => { for (const [k, v] of Object.entries(o)) { if (v?.type === 'group') walk(v.value, `${p}${k}.`); else if (leafMatch(v, `${p}${k}`)) n++; } };
        walk(tree, '');
        return n;
    });

    async function reload() {
        err = null;
        try {
            const t = await load();
            known = {};
            const walk = (o: Record<string, any>, p: string) => { for (const [k, v] of Object.entries(o)) { if (v?.type === 'group') walk(v.value, `${p}${k}.`); else known[`${p}${k}`] = v?.value; } };
            walk(t, '');
            altered = {};
            tree = t;
        }
        catch (e) { err = e instanceof Error ? e.message : String(e); }
    }
    untrack(reload);

    const human = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z]{2,})/g, '$1 $2');
    const plain = (d: string) => `${d ?? ''}`.replace(/<[^>]+>/g, '').trim();
    const cur = (key: string) => (key in altered ? altered[key] : known[key]);
    function edit(key: string, v: any) {
        const a = { ...altered };
        if (`${v}` === `${known[key]}`) delete a[key]; else a[key] = v;
        altered = a;
    }
    async function doSave() {
        saving = true;
        try { await save(altered); ui.toast(`Saved ${count} setting${count === 1 ? '' : 's'}.`, 'success'); await reload(); }
        catch (e) { ui.error(e); }
        saving = false;
    }
</script>

{#snippet rows(o: Record<string, any>, p: string)}
    {#each Object.entries(o) as [k, s] (k)}
        {@const key = `${p}${k}`}
        {#if s?.type === 'group' ? anyShown(s.value, `${key}.`) : leafMatch(s, key)}
        {#if s?.type === 'group'}
            <ParamGroup title={human(s.name)} open={searching}>{@render rows(s.value, `${key}.`)}</ParamGroup>
        {:else}
            {@const v = cur(key)}
            <div class="row" class:edited={key in altered} data-setting={key}>
                <div class="label">
                    <span class="name">{human(s.name)}</span>
                    {#if plain(s.description)}<InfoButton label={human(s.name)} text={plain(s.description)} />{/if}
                </div>
                <div class="ctrl">
                    {#if s.type === 'boolean'}
                        <Toggle hideLabel label={human(s.name)} checked={`${v}` === 'true'} onchange={(c: boolean) => edit(key, c)} />
                    {:else if s.type === 'integer' || s.type === 'decimal'}
                        <NumberInput ariaLabel={human(s.name)} value={Number(v)} step={s.type === 'integer' ? 1 : 0.01} onchange={(n: number) => edit(key, n)} />
                    {:else if s.type === 'dropdown' && s.values}
                        <Dropdown ariaLabel={human(s.name)} options={s.values.map((x: string, i: number) => ({ value: x, label: s.value_names?.[i] ?? x }))} value={`${v}`} onchange={(x: string) => edit(key, x)} />
                    {:else}
                        <TextInput aria-label={human(s.name)} type={s.is_secret ? 'password' : 'text'} value={Array.isArray(v) ? v.join(', ') : `${v ?? ''}`}
                            oninput={(x: string) => edit(key, Array.isArray(known[key]) ? x.split(',').map(t => t.trim()).filter(Boolean) : x)} />
                    {/if}
                </div>
            </div>
        {/if}
        {/if}
    {/each}
{/snippet}

<div class="tree ui-dense" aria-label={label}>
    {#if err}<EmptyState title="Couldn't load {label.toLowerCase()}" message={err} />
    {:else if !tree}<Skeleton lines={6} label="Loading {label}" />
    {:else}
        {@const leaves = Object.fromEntries(Object.entries(tree).filter(([, x]) => x?.type !== 'group'))}
        <SettingsSearch bind:value={query} count={total} label="Search {label.toLowerCase()}" />
        {#if searching && !total}<EmptyState icon={LSearchX} title="No matching settings" message="Nothing in {label.toLowerCase()} matches “{query.trim()}”." />{/if}
        <Grid cols={2} min="340px" {label}>
        {#if anyShown(leaves, '')}<ParamGroup title="General" open={true}>{@render rows(leaves, '')}</ParamGroup>{/if}
        {@render rows(Object.fromEntries(Object.entries(tree).filter(([, x]) => x?.type === 'group')), '')}
        </Grid>
    {/if}
</div>
{#if count}
    <div class="confirm" role="status">
        <span>Save {count} edited setting{count === 1 ? '' : 's'}?</span>
        <span class="sp"></span>
        <Button variant="danger" icon={LUndo} onclick={() => (altered = {})}>Discard</Button>
        <Button variant="primary" icon={LSave} disabled={saving} onclick={doSave}>Save</Button>
    </div>
{/if}

<style>
    .tree { display: flex; flex-direction: column; gap: var(--space-1); }
    .tree :global(.ui-group .ui-group) { background: none; padding: 0 0 0 var(--space-2); }
    .row { display: flex; align-items: center; gap: var(--space-2); min-height: 24px; }
    .label { display: flex; align-items: center; gap: 2px; min-width: 0; }
    .name { font-size: var(--text-small, 12px); color: var(--color-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row > :global(:first-child) { flex: 0 0 40%; min-width: 0; }
    .row.edited .name { color: var(--color-ink); font-weight: 600; }
    .ctrl { flex: 1; min-width: 0; display: flex; }
    .ctrl > :global(*) { flex: 1; min-width: 0; }
    .ctrl > :global(.ui-toggle) { flex: none; }
    .confirm { position: sticky; bottom: 0; z-index: 3; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); margin-top: var(--space-2);
        background: var(--color-raised); border-radius: var(--radius-ui); box-shadow: var(--shadow-up); }
    .sp { flex: 1; }
</style>
