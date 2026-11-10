<script lang="ts">
    import ParamTree from './ParamTree.svelte';
    import ParamInput from './ParamInput.svelte';
    import type { GroupNode } from '../../lib/state/params.svelte';
    import { paramState } from '../../lib/state/params.svelte';
    import { ParamGroup } from '../ui';

    let { node, depth = 0 }: { node: GroupNode; depth?: number } = $props();
    const filtering = $derived(paramState.filter.trim().length > 0);
</script>

{#each node.params as p (p.id)}
    <ParamInput param={p} />
{/each}
{#each node.children as child (child.group!.id)}
    {@const g = child.group!}
    <ParamGroup title={g.id === 'resolution' && paramState.byId['width'] ? `${g.name}: ${paramState.resolutionLabel}` : g.name} description={g.description} id="grp-{g.id}"
        open={filtering || !!paramState.groupOpen[g.id]}
        ontoggle={(o: boolean) => { paramState.groupOpen[g.id] = o; }}
        toggleable={g.toggles}
        enabled={g.toggles ? !!paramState.groupToggles[g.id] : true}
        onenable={(e: boolean) => { paramState.groupToggles[g.id] = e; }}>
        <ParamTree node={child} depth={depth + 1} />
    </ParamGroup>
{/each}
