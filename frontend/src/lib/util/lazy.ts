/**
 * Loads a component's chunk once and remembers it. Use with `{#await}`, for UI that isn't needed at startup (modals,
 * tabs, tools), so it stays out of the main bundle:
 *     const loadX = lazy(() => import('./X.svelte'));
 *     {#if xEver}{#await loadX() then X}<X ... />{/await}{/if}
 */
export function lazy<T>(load: () => Promise<{ default: T }>): () => Promise<T> {
    let p: Promise<T> | undefined;
    return () => (p ??= load().then(m => m.default, e => {
        // a failed load (eg a deploy swapped the chunks) may be retried on the next open
        p = undefined;
        throw e;
    }));
}
