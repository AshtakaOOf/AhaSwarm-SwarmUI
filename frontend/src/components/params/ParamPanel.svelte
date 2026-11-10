<script lang="ts">
    import ParamTree from './ParamTree.svelte';
    import ParamSkeleton from './ParamSkeleton.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { presetState } from '../../lib/state/presets.svelte';
    import { ui } from '../../lib/state/ui.svelte';
    import PromptBox from '../generate/PromptBox.svelte';
    import { promptDock } from '../../lib/state/promptdock.svelte';
    import { Toggle, Button, TextInput, EmptyState, Icon } from '../ui';
    import LX from '@lucide/svelte/icons/x';

    const tree = $derived(paramState.loaded ? paramState.tree(ui.settings.showAdvanced) : null);
    const empty = $derived(!!tree && tree.params.length === 0 && tree.children.length === 0);
</script>

<div class="panel">
    <div class="tools ui-dense">
        <div class="filter">
            <TextInput type="search" placeholder="Filter parameters…" aria-label="Filter parameters" bind:value={paramState.filter} />
            {#if paramState.filter}
                <button type="button" class="clear" aria-label="Clear filter" title="Clear filter" onclick={() => (paramState.filter = '')}><Icon icon={LX} /></button>
            {/if}
        </div>
        <div class="row">
            <span class="adv">
                <Toggle hideLabel label="Display advanced options ({paramState.advancedCount})" checked={ui.settings.showAdvanced} onchange={(c: boolean) => { ui.settings.showAdvanced = c; ui.saveSettings(); }} />
                <button type="button" class="advlbl" tabindex="-1" aria-hidden="true" onclick={() => { ui.settings.showAdvanced = !ui.settings.showAdvanced; ui.saveSettings(); }}><span class="full">Display advanced options</span><span class="short">Advanced</span> ({paramState.advancedCount})</button>
            </span>
            <span class="spacer"></span>
            <Button variant="ghost" aria-pressed={paramState.filter.includes('<unaltered>')}
                onclick={() => { paramState.filter = paramState.filter.includes('<unaltered>') ? paramState.filter.split('<unaltered>').join('') : paramState.filter + '<unaltered>'; }}>Altered only</Button>
            <Button variant="ghost" class="danger-ink" onclick={async () => { if (await ui.ask('Reset all parameters?', 'Every parameter goes back to its default value.', { confirmLabel: 'Reset' })) { presetState.resetParams(); } }}>Reset</Button>
            {#if paramState.comfyOn}<Button variant="ghost" onclick={() => paramState.clearComfy()}>Disable workflow</Button>{/if}
        </div>
    </div>
    <div class="scroll" class:pinned={promptDock.pinned}>
        {#if !promptDock.pinned}<PromptBox />{/if}
        <div class="params ui-dense">
        {#if !tree}
            <ParamSkeleton />
        {:else if empty}
            <EmptyState title="No parameters match" message="Try a different filter, or turn on advanced options." />
        {:else}
            <ParamTree node={tree} />
        {/if}
        </div>
        {#if promptDock.pinned}<PromptBox />{/if}
    </div>
</div>

<style>
    .panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--param-panel-bg); container: params / inline-size; }
    .tools { position: relative; z-index: 6; flex: none; display: flex; flex-direction: column; gap: var(--param-row-gap); padding: var(--param-gutter) calc(var(--param-gutter) + var(--param-pad-x)) var(--space-1); background: var(--param-panel-bg); }
    .filter { position: relative; margin-left: calc(-1 * var(--param-pad-x)); margin-right: calc(-1 * var(--space-3)); }
    .filter :global(input.ctl) { padding-left: 10px; padding-right: 30px; }
    .clear { position: absolute; top: 50%; right: 4px; translate: 0 -50%; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; background: transparent; border-radius: var(--radius-sm); color: var(--color-ink-2); line-height: 0; transition: background-color 120ms, color 120ms; }
    .clear:hover, .clear:focus-visible { background: var(--color-active); color: var(--color-ink); }
    .clear:active { background: var(--color-active); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-1); }
    .row :global(.ui-toggle) { min-width: 0; }
    .row { flex-wrap: nowrap; }
    .adv { display: inline-flex; align-items: center; gap: var(--space-2); flex: none; }
    .advlbl { white-space: nowrap; font-size: var(--text-ui, 13px); color: var(--color-ink); cursor: pointer; overflow: hidden; text-overflow: ellipsis; }
    .advlbl .short { display: none; }
    .row > :global(.ctl-ghost) { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    @container params (max-width: 419px) { .advlbl .full { display: none; } .advlbl .short { display: inline; } .row > :global(.ctl-ghost) { padding: 0 4px; } .panel .tools .row > :global(.ctl-ghost:last-child) { margin-right: -4px; } .row { gap: 2px var(--space-1); } }
    /* reset never shrinks; "Altered only" gives way first */
    .tools .row > :global(.ctl-ghost:last-child) { flex: none; }
    .spacer { flex: 1; }
    .tools .row > :global(.ctl-ghost:last-child) { margin-right: -8px; }
    .scroll { position: relative; z-index: 0; isolation: isolate; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 var(--param-gutter) var(--space-3); }
    .scroll { display: flex; flex-direction: column; gap: var(--space-1); }
    .scroll > :global(*) { flex-shrink: 0; }
    .params { display: flex; flex-direction: column; gap: var(--space-1); }
    .params > :global(*) { flex-shrink: 0; }
    .scroll.pinned { padding-bottom: 0; }
    .scroll.pinned > .params { padding-bottom: var(--space-3); }
    .panel :global(.ui-group) {
        background: var(--param-section-bg);
        border-radius: var(--radius-ui);
        padding: var(--param-pad-y) var(--space-1) var(--param-pad-y) var(--param-pad-x);
        --color-raised: var(--param-ctl);
        --color-hover: var(--param-ctl-hover);
        --color-active: var(--param-ctl-active);
        --color-control: var(--param-ctl);
        --color-control-hover: var(--param-ctl-hover);
        --color-control-active: var(--param-ctl-active);
    }
    .panel :global(.ui-group > h3) { margin-top: 0; }
    .panel :global(.ui-group > .body > .inner > div) { gap: var(--param-row-gap); padding-top: var(--param-row-gap); }
    .panel :global(.ui-group .ui-group) { background: none; padding: 0; }
    @container params (max-width: 339px) {
        .scroll { padding-left: 0; padding-right: 0; }
        .tools { padding-left: var(--space-1); padding-right: var(--space-1); }
        .filter { margin-left: 0; margin-right: 0; }
        .panel :global(.ui-group) { border-radius: 0; padding-left: var(--space-1); padding-right: var(--space-1); }
        .panel :global(.ui-group .ui-group) { padding: 0; }
    }
    .panel :global(.ui-group .ui-group > h3) { margin-top: 0; }
    .panel :global(.ui-group > h3 .chev) { margin-left: -3.75px; }
    .panel :global(.ui-group > h3 .chev.-rotate-90) { translate: -1.875px 0; }
</style>
