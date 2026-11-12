# Image editor

AhaSwarm's port of classic SwarmUI's image editor (`image_editor.js`), with extra painting tools. It opens from the
**Image Editor** button in the current image's button row (it follows the buttons-above-metadata setting), or at the top right of the current image area when no image is shown (back to the current edit, else the current image,
else a white canvas at the current width x height like classic `openEmptyEditor`) or an image's **Edit Image** menu
entry. Unlike classic (which swaps it into the current image area) it opens in a large Modal (`size="xl"`,
`tone="clear"`, `fullscreen="auto"`, mounted by GeneratePage), full screen at 640px and below like other auto sheets,
so it isn't limited by the image area. Escape still belongs to the editor. A press and release on the dimmed backdrop
hides the Modal like the close button (the edit stays); a drag that starts on the canvas and ends on the backdrop does
not close it.

The edit outlives the Modal: its close button only hides it, and you generate from the normal page (where the batch
and progress are). While an edit exists the Image Editor button uses the accent colour and a discard X on the button;
Discard Edits is also in the editor's Save menu. Starting a new edit over one with changes asks first. Bring a
result back in with an image's "Add To Editor As Layer" menu entry.

While an edit exists, every generation uses its flattened image layers as `initimage` and its mask layers as `maskimage`,
with width/height from the canvas (rounded down to multiples of 8) and `initimagecreativity` defaulting to 0.6, like
classic `getGenInput`. The Init Image and Mask Image params are hidden meanwhile (`paramState.managedParams`, classic
`doParamHides`).

## Code

| Path | Role |
|---|---|
| `lib/editor/editor.svelte.ts` | `Editor`: layers, view, text, undo, rendering. Pointer input, tools, selection/transform and clipboard/export live in `input.ts`, `tools.svelte.ts`, `select.ts` and `clipboard.ts`. The engine and `ImageEditor` are loaded only when the editor is opened. |
| `lib/editor/layer.ts` | `Layer` (a canvas plus offset, opacity, visibility, `isMask`) and rect helpers |
| `lib/editor/brush.ts` | `Stroke`: stamp-based brush / airbrush / eraser with pressure, painted into a per-stroke buffer |
| `lib/editor/pixels.ts` | Flood fill (paint bucket, with Expand) and `LiquifyWarp` |
| `lib/editor/liquifyGL.ts` | WebGL2 renderer for liquify (used when available) |
| `lib/editor/transform.ts` | `Transform`: free transform (move / scale / rotate / flip) and the Catmull-Rom mesh warp |
| `lib/editor/text.ts` | Text layer spec and rasterizing |
| `lib/editor/selection.ts` | `Selection`: rect / ellipse / lasso shape plus a rendered alpha mask |
| `lib/editor/history.ts` | Undo/redo; pixel edits store only the touched rect |
| `lib/state/editor.svelte.ts` | `editorState`: open / close, and the `paramState.inputHooks` entry that adds the editor's inputs |
| `components/editor/*` | `ImageEditorModal` (the Modal), `ImageEditor` (layout, shortcuts), `EditorToolOptions`, `EditorTextOptions`, `EditorColor`, `EditorLayers` |

## Behaviour

- Tools: brush (B), airbrush (A), eraser (E), paint bucket (G), lasso fill (F), eyedropper (I, or Alt + click), rectangle
  (M) / ellipse (O) / lasso (L) select, move (V; moves the selected pixels when there is a selection), liquify push (W),
  text (T), pan (H). Ctrl+T transforms the selection (or the layer's content): drag handles to scale (Shift keeps
  proportions), outside the box to rotate (Shift snaps 15°), flip / rotate 90° buttons, and a 2×2 to 6×6 warp grid;
  Enter applies, Escape cancels. `[` / `]` resize the brush, X swaps colours, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo, Ctrl+A / Ctrl+D /
  Ctrl+Shift+I select all / deselect / invert, Delete clears the selection, Ctrl+0 fits the view. Ctrl+E opens Edit, Ctrl+S opens Save.
- A stroke paints into its own buffer, shown over the layer at the brush opacity and merged on release, so a stroke never
  darkens where it overlaps itself. Airbrush keeps spraying while held still. Pen pressure drives size (brush, eraser) or
  flow (airbrush); mouse and touch count as full pressure.
- Dabs add to a float coverage map and the stroke canvas is refreshed from it, so faint airbrush dabs build up smoothly
  instead of banding in 8-bit alpha.
- The paint bucket samples all layers by default and grows the fill by Expand pixels (outer ring at half strength), so
  it tucks under anti-aliased line art.
- Liquify builds a displacement map per stroke and re-samples the untouched original (bicubic) each frame, so repeated
  pushes don't blur. The map is smooth at brush scale, so it is stored on a grid (one node per 1 to 4 px depending on
  brush size; under 0.1 px average error) and interpolated per pixel; the image is still sampled at full resolution.
  Pointer moves only update the map, and the redraw happens once per frame, only for the pushed area. With WebGL2 the
  redraw runs on the GPU (`liquifyGL.ts`, same maths) and the layer is written once on release; otherwise it runs on
  the CPU. The preview and the applied result are the same pixels.
- The mesh warp draws the piece as textured triangles; each triangle's clip is offset a pixel along its edge normals so
  neighbours overlap and no seams show. While transforming, the rest of the layer is kept as a GPU-side copy, and at
  full opacity and under 200% zoom the piece is drawn straight to the screen instead of through a layer-sized scratch
  canvas.
- Text layers stay editable (click them with the text tool to edit or drag) until a pixel tool paints on them, which
  rasterizes them as an undoable step. While editing, font / size / style / alignment / outline sit in a Popover next
  to the text (a bottom sheet on narrow screens). The outline uses the secondary colour.
- Copy / cut (Ctrl+C / Ctrl+X) take the selection on the active layer, or the whole layer without one (text layers stay
  editable); Ctrl+Shift+C copies all visible image layers merged. Ctrl+V pastes a new layer above the active one, at the
  copied position. Copies also go to the system clipboard as PNG when the page is secure (https or localhost). A paste
  event carrying an image wins over the editor's own clipboard only if the window lost focus since the last copy (the
  user may have copied in another app); the Edit menu reads the async clipboard for the same case.
- The Save menu downloads the flattened image as a PNG, or stores it to Image History with the current params as its
  metadata (classic `storeImageToHistoryWithCurrentParams`, `AddImageToHistory`); "Full Canvas" also keeps what's past
  the canvas edges (classic `getMaximumImageData`). Stored images join the output batch like a generation.
- Layers: Ctrl / Cmd + click toggles a layer into the selection, Shift + click selects a range, and the select-several
  button does the same by tapping (touch screens). With several selected, delete removes them all and merge combines
  them into the lowest one (all image or all mask layers; hidden ones are left out and kept), each as one undo step.
  Move Up / Move Down are in each layer's menu.
- Selections clip brushes, fills and lasso fills. Painting on a mask layer always paints white.
- Navigation: wheel zooms, trackpad scroll pans, Space + drag / middle or right drag / the pan tool pan, two fingers
  pinch-zoom and pan. Once a pen has been used, single-finger touches only pan (palm rejection).
- `finalMask` follows classic `getFinalMaskData`: white where the mask layers are painted, plus transparent areas of the
  image; all white when no mask layer has content (a plain img2img).
- `exportForGen` caches the PNGs until the next edit, because Generate Previews rebuilds the input every 100ms.
