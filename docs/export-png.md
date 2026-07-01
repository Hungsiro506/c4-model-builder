# Export Selected as PNG — Feature Plan

Context doc for AI-assisted development. Records design decisions before implementation.

> Status: **in progress** (2026-06-30). Branch `feat/export-selected-png`.

## Problem

Users need to share diagrams outside the tool — paste into docs, slides, Slack, Notion.
Whole-canvas export already exists (`exportCanvasAsPNG` / `exportCanvasAsSVG` /
`copyCanvasAsPNG` in `src/lib/exportUtils.ts`, shipped upstream as PR #72), but it always
captures the *entire* view with its background. There is no way to export *just a few
selected nodes* on a transparent background. Architects need a clean way to select a subset
and export only those nodes + the edges between them as a transparent PNG.

## Scope (locked)

- **Select nodes** via click, shift+click, or rubber-band drag (same multi-select already in the app)
- **Export selected nodes + edges between them** — edges where both endpoints are selected
- **Copy to clipboard** — the PNG goes to the clipboard (paste into Slack/Notion/docs), no file download
- **PNG only** — no SVG/JPEG in v1
- **Transparent background** — no canvas grid, no theme background
- **1×/2×/3× scale picker, default 1×** — matches Excalidraw's export scale (scale is the quality lever; PNG is lossless)
- **10px crop padding** — matches Excalidraw's default export padding
- **Boundary boxes excluded** — only content nodes and their edges, no scope/expand wrappers
- **Table nodes included** — if a table inside an expanded DB container is selected, it gets exported

## Out of scope (deferred)

- SVG / JPEG formats
- File download (clipboard only for v1)
- Right-click context-menu entry (menu lives on the multi-select bar)
- Export entire view / visible area
- Export with canvas background
- Excalidraw-style "export area" frame-drag

## Key decisions (and why)

1. **html-to-image for DOM → PNG.** Why: React Flow nodes are HTML elements,
   not SVG. Cannot screenshot just the SVG layer. The library renders a DOM subtree to a
   `<canvas>`, crops to bounds, and exports. `html-to-image` is lighter and better maintained
   than `html2canvas`. Already a dependency, already used by `exportCanvasAsPNG`.

2. **Filter the live viewport — NOT an off-screen clone.** *(Revised 2026-06-30 — the
   original plan called for cloning selected nodes into a hidden `-9999px` container and
   replicating every CSS custom property. That path is brittle: edges live in a separate
   SVG layer from nodes, so a clone has to recompute edge coordinates and carry `url(#…)`
   marker defs along by hand.)* Instead we follow React Flow's own download-image recipe and
   `html-to-image`'s existing usage in this repo:
   - compute the bounding box of the selected nodes with `getNodesBounds(selectedNodes)`
     (built-in RF util),
   - derive a transform with `getViewportForBounds(bbox, width, height, minZoom, maxZoom, 0)`,
   - call `toBlob(viewportEl, { width, height, style: { transform }, filter })` against the
     **live** `.react-flow__viewport`.
   The `filter(domNode)` callback drops everything we don't want (see #5). Markers and CSS
   vars stay in the live DOM tree, so nothing needs re-stitching or replicating.

3. **BBox from selected content nodes.** Compute over the selected nodes *after* excluding
   boundary/group overlays (#5), so the crop hugs the real content.

4. **Transparent background.** Pass `backgroundColor: undefined` (html-to-image defaults to
   transparent) and have the `filter` drop the dot-grid `.react-flow__background` layer.
   No theme background is applied. v1 uses `pixelRatio: 1` (locked-scope 1x).

5. **`filter` excludes overlays + non-participating edges.** Drop: nodes not in the selected
   set; boundary/group overlay nodes (decorative wrappers derived from member positions);
   edges where *both* endpoints are not selected; React Flow chrome (`.react-flow__background`,
   `__minimap`, `__controls`, `__panel`, `__attribution`). Keep content nodes (person,
   softwareSystem, container, component, table — including synthetic `__table__*` ids) and
   edges between two selected nodes.

## Key files (planned)

- `src/lib/exportSelectedPng.ts` —
  - `selectExportNodeIds(nodes, selectedIds)` — pure: selected content nodes, boundary/group
    excluded.
  - `selectExportEdgeIds(edges, exportNodeIdSet)` — pure: edges with both endpoints in the set.
  - `exportSelectedAsPng(viewportEl, nodes, edges, selectedIds)` — DOM: bbox + transform +
    `toBlob` with the filter, then `downloadBlob` (reused from `exportUtils.ts`).
- `src/components/layout/FloatingTopPill.tsx` (or the existing export menu) — an
  "Export selection as PNG" action, disabled when `selectedElementIds.length === 0`.
- `src/components/canvas/Canvas.tsx` — already holds the `useReactFlow()` instance and reads
  `selectedElementIds`; supplies nodes/edges/viewport element to the export call.

## Technical notes

- React Flow nodes are positioned absolutely. The off-screen container must replicate
  the exact CSS custom properties (`--color-*`, `--canvas-*`) so node fills, borders,
  and edge strokes render correctly.
- Edges are SVG `<path>` elements. `html-to-image` inlines them via `foreignObject`
  or clones the SVG markup. May need `fetch` for marker defs (`url(#c4-arrow)`).
- Table nodes inside expanded DB containers have synthetic IDs (`__table__*`). The
  export must handle these — they're content nodes, not overlays.
- Performance: 50+ selected nodes means a large off-screen container. Test with the
  Big Bank template (~40 nodes) to verify acceptable render time (<2s).

## Tests

- `src/lib/exportSelectedPng.test.ts` — unit: node/edge filtering (overlay
  exclusion, both-endpoints edge rule, synthetic table ids), the `html-to-image`
  filter predicate, the `toBlob` call shape (transparent, 10px padding, scale →
  pixelRatio), and `copySelectedAsPng` writing a PNG `ClipboardItem`.
- `e2e/canvas/export-selected-png.spec.ts` — E2E: select nodes → open the
  multi-select-bar "PNG" menu → pick 2× → verify the clipboard copy confirms.

## Open items

- Keyboard shortcut for copy (Ctrl+Shift+C?)
- File-download variant (v1 is clipboard only)
- Single-node export (the bar only appears at 2+ selection; v1 ships multi only)

## Progress log

### 2026-06-30 — first cut (branch `feat/export-selected-png`)

- `src/lib/exportSelectedPng.ts` — pure filters (`selectExportNodeIds`,
  `selectExportEdgeIds`, `makeExportFilter`) + `exportSelectedAsPng`.
  Filter-live-viewport approach (decision #2), 1x, transparent, download.
- Wired a "PNG" action into `src/components/layout/MultiSelectBar.tsx` (visible
  on 2+ selection). Passes `reactFlow.getNodesBounds` for sub-flow correctness.

### 2026-07-01 — reworked to match Excalidraw

- Swapped download → **clipboard** (`copySelectedAsPng`, `ClipboardItem` +
  `navigator.clipboard.write`).
- Added **1×/2×/3× scale picker** (default 1×) → `pixelRatio`; the bar's PNG
  button now opens a small scale flyout, then confirms with a "Copied" label +
  `announce()`.
- Crop **padding 16 → 10** to match Excalidraw.
- 19 unit tests + 1 E2E. `npm run typecheck` + build clean.
