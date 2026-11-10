// settings search: one query filters a page of settings by name, description and id
import { getContext, setContext } from 'svelte';

const norm = (t: string) => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').toLowerCase();

export function queryWords(q: string): string[] {
  return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

export function matchesQuery(q: string, ...texts: (string | null | undefined)[]): boolean {
  const words = queryWords(q);
  if (!words.length) return true;
  const raw = texts.filter(Boolean).join(' ');
  const hay = `${raw.toLowerCase()} ${norm(raw)} ${norm(raw).replace(/\s+/g, '')}`;
  return words.every((w) => hay.includes(w));
}

type Entry = { text: string; group?: string };

export class SearchScope {
  query = $state('');
  #items = $state<Record<string, Entry>>({});
  #groups = $state<Record<string, string>>({});
  get active(): boolean { return queryWords(this.query).length > 0; }
  shows(text: string, group?: string): boolean {
    return matchesQuery(this.query, text) || (!!group && matchesQuery(this.query, this.#groups[group]));
  }
  groupShows(group: string): boolean {
    if (!this.active || matchesQuery(this.query, this.#groups[group])) return true;
    return Object.values(this.#items).some((i) => i.group === group && matchesQuery(this.query, i.text));
  }
  get count(): number { return Object.values(this.#items).filter((i) => this.shows(i.text, i.group)).length; }
  register(id: string, text: string, group?: string): () => void {
    this.#items[id] = { text, group };
    return () => { delete this.#items[id]; };
  }
  registerGroup(id: string, title: string): () => void {
    this.#groups[id] = title;
    return () => { delete this.#groups[id]; };
  }
}

const KEY = Symbol('ahakit-search');
const GROUP = Symbol('ahakit-search-group');
export function provideSearch(scope = new SearchScope()): SearchScope { setContext(KEY, scope); return scope; }
export function useSearch(): SearchScope | undefined { return getContext<SearchScope | undefined>(KEY); }
export function provideSearchGroup(id: string): void { setContext(GROUP, id); }
export function useSearchGroup(): string | undefined { return getContext<string | undefined>(GROUP); }
