# Themes

A theme sets AhaSwarm's colours (and a few shapes, like corner roundness). Pick one in **Settings → AhaSwarm → Theme**;
the accent colour can be changed there too, separately for each theme. There is also a high contrast option that works
on top of any theme.

## Make your own theme

1. Pick a built-in theme close to what you want from
   [`frontend/src/lib/ahakit/themes/`](../frontend/src/lib/ahakit/themes/) (`dark.css` and `light.css` are good starts).
2. Copy it into `SwarmUI/Data/AhaSwarm/themes/` (create the folder if needed) and give it a new name, e.g. `ocean.css`.
3. In the file, replace the old theme name in both `:root[data-theme="..."]` lines with the new file name
   (`:root[data-theme="ocean"]`). Optionally add `--theme-label: "Ocean";` inside the first block to set its display name.
4. Change the colours you want and save.
5. Reload AhaSwarm. The theme shows in the Theme list as "Ocean (custom)". Reload again after each edit.

Keep every line from the copied file, even ones you don't change: a missing colour doesn't fall back to another theme.

## The colours worth changing first

| Variable | What it colours |
|---|---|
| `--color-base` | The app background, behind everything |
| `--color-panel` | Panels and sections (parameter panel, browsers, popups) |
| `--color-raised` | Buttons, inputs and other controls |
| `--color-hover` / `--color-active` | Controls when hovered / pressed |
| `--color-ink` | Main text |
| `--color-ink-2` / `--color-ink-3` | Secondary and faint text |
| `--color-accent` | Primary buttons, selection, toggles and focus (also set `--color-accent-default` to the same value) |
| `--color-on-accent` | Text on the accent colour |
| `--color-border` | Borders around cards and sections (`transparent` for none) |
| `--color-danger` | Delete and other destructive buttons |
| `--radius-ui` | Corner roundness of controls |

Everything else (status colours, shadows, overlays, the high contrast block) is listed with its value in the built-in
theme files; the comments there say what each group is for. Add `color-scheme: light;` to mark a light theme.

## For developers

- Each built-in theme is one explicit CSS file in `lib/ahakit/themes/`, registered in `themes/index.ts` (`THEMES`:
  Dark and Light first, then alphabetical; `isLight`, `special`). No colours are generated in JS.
- Only `dark.css` (the default and fallback) is in the main CSS. Every other built-in theme is its own chunk:
  `setTheme` loads it with `loadTheme` and switches `data-theme` once it's in, so the page never sits on a theme with
  no colours. Read theme tokens (as the accent picker does) after `loadTheme` resolves.
- Base tokens live in `theme.css` (`@theme`, so Tailwind utilities follow them); aliases and non-colour tokens in
  `tokens.css`. A new colour token goes into every theme file.
- Components and pages never use hex or `rgb()`: use a token (Tailwind arbitrary values too, e.g.
  `bg-[var(--color-info-bg)]`). Borders and button edges are inset shadows (`--edge-*`, `--shadow-field`), so themes
  restyle them without changing layout.
- `setAccent(hex)` writes the accent tokens inline (`accentTokens` picks white or black text by 3:1 contrast);
  `--accent-swatches` / `--accent-default-name` feed the accent picker.
- High contrast is `data-contrast="high"` (`applyContrastMode`, Auto follows `prefers-contrast` / `forced-colors`);
  `high-contrast.css` and `forced-colors.css` hold the shared rules.
- Custom themes: the server inlines `Data/AhaSwarm/themes/*.css` (at most 64 files of 512 KiB) into `/Aha/index.html`;
  `lib/customThemes.ts` registers them with `registerCustomTheme` before settings load. Ids clashing with a built-in
  theme are skipped. The dev server (`/Ahadev/`) doesn't get them.
- `setTheme` always sets `data-theme` (Dark too), so the high contrast overlay (`:root[data-theme][data-contrast]`)
  outranks every theme. Each theme file ends with its own high contrast block; `high-contrast.css` adds what is shared.
- The media-control tokens (VideoPlayer bar) and the selected-card ring are the same in every theme: they sit on the
  picture, not on the UI.
- Under forced colours, button edges (box-shadows) disappear, so `forced-colors.css` draws real outlines.
- Chromium makes single-line text fields scroll containers, so hovering one hid the ancestor's overlay scrollbar; those
  inputs get `overflow: hidden` in `theme.css`.
