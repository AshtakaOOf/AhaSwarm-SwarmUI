<script lang="ts">
    import { api } from '../../lib/api/swarm';
    import type { ModelInfo } from '../../lib/api/types';
    import { CodeBlock, Modal, Skeleton } from '../ui';

    let { model, subtype, onclose }: { model: ModelInfo; subtype: string; onclose: () => void } = $props();
    let open = $state(true);
    let text = $state<string | null>(null);
    let error = $state<string | null>(null);

    // classic denseStringifyHeaderJson
    function dense(header: Record<string, any>): string {
        const lines = Object.entries(header).map(([key, v]) => {
            if (v && typeof v === 'object' && Object.keys(v).length === 3 && v.dtype && v.shape && v.data_offsets) {
                return `    "${key}": "dtype": "${v.dtype}", "shape": ${JSON.stringify(v.shape)}, "data_offsets": ${JSON.stringify(v.data_offsets)},`;
            }
            const json = JSON.stringify({ [key]: v }, null, 4);
            return `${json.substring(2, json.length - 2)},`;
        });
        return `{\n${lines.join('\n')}\n}`;
    }

    $effect(() => {
        api.getModelHeaders(model.name, subtype)
            .then(r => (text = dense(r.headers ?? {})))
            .catch(e => (error = e instanceof Error ? e.message : String(e)));
    });
</script>

<Modal bind:open tone="panel" title="Raw header" subtitle={model.name} size="lg" {onclose}>
    {#if error}
        <p class="aha-muted">{error}</p>
    {:else if text === null}
        <Skeleton height="12rem" label="Loading header" />
    {:else}
        <CodeBlock code={text} language="json" maxHeight="65vh" />
    {/if}
</Modal>
