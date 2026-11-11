// Dark is the default and the fallback, so it ships in the main CSS; every other theme is its own chunk, loaded when picked
import './dark.css';

const LOADERS = import.meta.glob(['./*.css', '!./dark.css']);
const loaded = new Map<string, Promise<unknown>>();
let wanted = '';

export interface ThemeDef {
  id: string;
  label: string;
  isLight: boolean;
  file: string;
  special?: boolean;
  custom?: boolean;
}

// dark and Light first, then alphabetical by label (a light variant after its dark one)
export const THEMES: ThemeDef[] = [
  { id: 'dark', label: 'Dark', isLight: false, file: 'dark.css' },
  { id: 'light', label: 'Light', isLight: true, file: 'light.css' },
  { id: 'adwaita', label: 'Adwaita', isLight: false, special: true, file: 'adwaita.css' },
  { id: 'adwaita-light', label: 'Adwaita', isLight: true, special: true, file: 'adwaita-light.css' },
  { id: 'autumn', label: 'Autumn', isLight: false, file: 'autumn.css' },
  { id: 'ctp-frappe', label: 'Catppuccin Frappé', isLight: false, file: 'catppuccin-frappe.css' },
  { id: 'ctp-latte', label: 'Catppuccin Latte', isLight: true, file: 'catppuccin-latte.css' },
  { id: 'ctp-macchiato', label: 'Catppuccin Macchiato', isLight: false, file: 'catppuccin-macchiato.css' },
  { id: 'ctp-mocha', label: 'Catppuccin Mocha', isLight: false, file: 'catppuccin-mocha.css' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', isLight: false, file: 'gruvbox-dark.css' },
  { id: 'gruvbox-light', label: 'Gruvbox Light', isLight: true, file: 'gruvbox-light.css' },
  { id: 'one-dark', label: 'One Dark', isLight: false, file: 'one-dark.css' },
  { id: 'rose-pine', label: 'Rosé Pine', isLight: false, file: 'rose-pine.css' },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', isLight: true, file: 'rose-pine-dawn.css' },
  { id: 'rose-pine-moon', label: 'Rosé Pine Moon', isLight: false, file: 'rose-pine-moon.css' },
  { id: 'vapor', label: 'Vapor', isLight: false, file: 'vapor.css' },
  { id: 'vgui2', label: 'VGUI2', isLight: false, special: true, file: 'vgui2.css' },
];

const FIRST = ['dark', 'light'];
const rank = (t: ThemeDef) => { const i = FIRST.indexOf(t.id); return i < 0 ? FIRST.length : i; };
const byLabel = (a: ThemeDef, b: ThemeDef) => rank(a) - rank(b) || a.label.localeCompare(b.label) || Number(a.isLight) - Number(b.isLight);

export function registerCustomTheme(id: string, css: string): ThemeDef | null {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id) || THEMES.some((t) => t.id === id)) return null;
  const style = document.createElement('style');
  style.dataset.customTheme = id;
  style.textContent = css;
  document.head.appendChild(style);
  const label = /--theme-label\s*:\s*["']([^"']+)["']/.exec(css)?.[1]
    ?? id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const def: ThemeDef = { id, label, isLight: /color-scheme\s*:\s*light/i.test(css), file: `${id}.css`, custom: true };
  THEMES.push(def);
  THEMES.sort(byLabel);
  return def;
}

/** loads a theme's CSS (once); resolves straight away for Dark and custom themes, which are already on the page */
export function loadTheme(id: string): Promise<void> {
  const def = THEMES.find((t) => t.id === id);
  const load = def && !def.custom ? LOADERS[`./${def.file}`] : undefined;
  if (!load) return Promise.resolve();
  let p = loaded.get(def!.file);
  if (!p) {
    // a failed load (offline, or a deploy swapped the chunks) may be retried on the next pick
    p = load().catch((e) => { loaded.delete(def!.file); throw e; });
    loaded.set(def!.file, p);
  }
  return p.then(() => {});
}

/** switches theme once its CSS is in, so the page never sits on a theme with no colours; a newer pick wins */
export function setTheme(name: string): Promise<void> {
  const id = !name || name === 'default' ? 'dark' : name;
  wanted = id;
  return loadTheme(id).then(
    () => { if (wanted === id) document.documentElement.dataset.theme = id; },
    (e) => { console.warn(`AhaSwarm: could not load the '${id}' theme`, e); },
  );
}

export function themeDef(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function themeLabel(t: ThemeDef): string {
  const tags = [t.isLight && !/\blight\b/i.test(t.label) ? 'light' : '', t.special ? 'special' : '', t.custom ? 'custom' : ''].filter(Boolean);
  return tags.length ? `${t.label} (${tags.join(', ')})` : t.label;
}

export interface ThemeAccent { value: string; label: string }

const cssString = (v: string) => v.trim().replace(/^["']|["']$/g, '');

export function themeAccentOptions(): ThemeAccent[] {
  const cs = getComputedStyle(document.documentElement);
  const name = cssString(cs.getPropertyValue('--accent-default-name')) || 'theme';
  const swatches = cssString(cs.getPropertyValue('--accent-swatches'))
    .split(',')
    .map((s) => s.trim().match(/^(.*\S)\s+(#[0-9a-f]{3,8})$/i))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ label: m[1], value: m[2].toLowerCase() }));
  return [{ value: '', label: `Theme default (${name})` }, ...swatches];
}
