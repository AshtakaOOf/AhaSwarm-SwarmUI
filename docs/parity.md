# AhaSwarm and classic SwarmUI parity

This is from reading the code, not from testing in a browser. Effort is S, M or L (small, medium, large), followed by how much people would miss it.

**Missing**

- Image Compare (side by side, overlay, swap, metadata table): L, high (contribution welcome)
- Changing your own password: S, high
- Classic JS extension hooks. Third-party Classic-only extension UIs won't appear (Grid and Image Batcher were rebuilt natively): L, high for people with extra extensions
- Auth token list, create and revoke: S, med
- Register from the in-app login (the Classic `/Register` page still works): S, med
- SAM2 point and box masking in the image editor: M, med (contribution welcome)
- Dropping an image onto the editor canvas as a layer: S, med (contribution welcome)
- Video and audio editing (trim, audio only): M, med (contribution welcome)
- UI language picker and translations: L, not a priority at all
- TensorRT engine creation: M, low
- Sending logs to Pastebin, the Text Notepad tool, and first-run tips: S, low

**Partial**

- Parameter Configuration for hiding, renaming and regrouping params. Edits made in Classic still apply, but there's no AhaSwarm UI for it: M, med
- Possibly the shape tool in the editor: S, low (contribution welcome)

**Intentionally different**: the drag-to-rearrange Generate layout, the installer, and debug routes.

**Done recently**: changing your own password; admin interrupt of another user's generations; preset import, export and duplicate; arrow keys on the current image and batch, and History grid keyboard navigation; History right-click menu (same actions as the current image; Image Compare is still missing as a feature).
