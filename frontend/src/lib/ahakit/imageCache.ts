// small byte-capped LRU of fetched image blobs, exposed as object URLs

type Entry = { url: string; size: number; refs: number };
const MAX_BYTES = 96 * 1024 * 1024;
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<string>>();
let bytes = 0;

const cacheable = (src: string) => !!src && !/^(data|blob):/.test(src);

function touch(src: string, e: Entry) {
  entries.delete(src);
  entries.set(src, e);
}

function evict() {
  for (const [src, e] of entries) {
    if (bytes <= MAX_BYTES) break;
    if (e.refs > 0) continue;
    entries.delete(src);
    bytes -= e.size;
    URL.revokeObjectURL(e.url);
  }
}

export function cachedImage(src: string): string | undefined {
  const e = entries.get(src);
  if (e) touch(src, e);
  return e?.url;
}

// fetch `src` once (concurrent callers share the request) and cache it
export function loadImage(src: string): Promise<string> {
  if (!cacheable(src)) return Promise.resolve(src);
  const hit = cachedImage(src);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(src);
  if (!p) {
    p = fetch(src, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
      .then((b) => {
        const e: Entry = { url: URL.createObjectURL(b), size: b.size, refs: 0 };
        entries.set(src, e);
        bytes += b.size;
        evict();
        return e.url;
      })
      .catch(() => src)
      .finally(() => pending.delete(src));
    pending.set(src, p);
  }
  return p;
}

export function holdImage(src: string): () => void {
  const e = entries.get(src);
  if (!e) return () => {};
  e.refs++;
  return () => { e.refs--; if (bytes > MAX_BYTES) evict(); };
}
