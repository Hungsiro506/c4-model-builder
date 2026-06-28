# Export Selected as PNG — Feature Plan

Context doc for AI-assisted development. Records design decisions before implementation.

> Status: **planned** (2026-06-28). Not yet started.

## Problem

Users need to share diagrams outside the tool — paste into docs, slides, Slack, Notion.
Today there is no export. The only option is screenshot the browser window, which includes
chrome, panels, and background. Architects need a clean way to select a few nodes and
export just those nodes + their edges as a transparent PNG.

## Scope (locked)

- **Select nodes** via click, shift+click, or rubber-band drag (same multi-select already in the app)
- **Export selected nodes + edges between them** — edges where both endpoints are selected
- **PNG only** — no SVG/JPEG in v1
- **Transparent background** — no canvas grid, no theme background
- **1x resolution** — screen resolution, no retina scaling in v1
- **Boundary boxes excluded** — only content nodes and their edges, no scope/expand wrappers
- **Table nodes included** — if a table inside an expanded DB container is selected, it gets exported

## Out of scope (deferred)

- SVG / JPEG formats
- Retina (2x/3x) scaling
- Export entire view / visible area
- Export with canvas background
- Excalidraw-style "export area" frame-drag

## Key decisions (and why)

1. **html-to-image for DOM → PNG.** Why: React Flow nodes are HTML elements,
   not SVG. Cannot screenshot just the SVG layer. The library renders a DOM subtree to a
   `<canvas>`, crops to bounds, and exports. `html-to-image` is lighter and better maintained
   than `html2canvas`.

2. **BBox computation from selected nodes.** Why: compute the bounding box of all selected
   React Flow nodes (position + measured size). Offset edges to be relative to that bbox.
   Render only the selected subset into an off-screen container, snapshot, discard.

3. **Off-screen render approach.** Why: clone the selected nodes + edges into a hidden
   container with `position: absolute; left: -9999px`, apply styles, render with
   `html-to-image`, then remove. This avoids fighting React Flow's coordinate system
   and viewport transforms.

4. **Transparent background by removing canvas layers.** Why: the off-screen container
   has no background. `html-to-image` defaults to transparent unless a background color
   is explicitly set. Skip the dot-grid `<Background />` and theme background.

5. **No boundary/group overlay nodes in export.** Why: these are decorative wrappers
   derived from member positions. Exporting them adds visual noise. Only content nodes
   (person, softwareSystem, container, component, table) and edges between selected
   nodes are included.

## Key files (planned)

- `src/lib/exportPng.ts` — `exportSelectedAsPng(nodes, edges)` — computes bbox, builds
  off-screen container, renders with html-to-image, triggers download
- `src/components/canvas/ExportButton.tsx` — toolbar button, disabled when no selection
- `src/components/canvas/Canvas.tsx` — wires ExportButton, reads selected element IDs
  from store, filters nodes/edges

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

- `src/lib/exportPng.test.ts` — unit: bbox computation, node/edge filtering,
  selected-edges-only logic
- `e2e/export-png/export-png.spec.ts` — E2E: select nodes, click export, verify
  download triggered, verify image dimensions match selection

## Open items

- Keyboard shortcut for export (Ctrl+Shift+E?)
- Export progress indicator for large selections
- Copy to clipboard instead of download
- Crop padding config (fixed 16px or user-adjustable)
