<script lang="ts">
    import { KeyValueList } from '../ui';
    let { swarmVersion = '?' }: { swarmVersion?: string } = $props();
</script>

<KeyValueList dense label="About" items={[
    { key: 'AhaSwarm', value: `${__AHA_VERSION__}-${__AHA_COMMIT__}`, mono: true, copy: true },
    { key: 'SwarmUI', value: swarmVersion || '?' },
]} />
