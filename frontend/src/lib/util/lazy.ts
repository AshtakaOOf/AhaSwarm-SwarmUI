export function lazy<T>(load: () => Promise<{ default: T }>): () => Promise<T> {
    let p: Promise<T> | undefined;
    return () => (p ??= load().then(m => m.default, e => {
        // retry after a failed chunk load
        p = undefined;
        throw e;
    }));
}
