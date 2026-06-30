# Canvas Legend — Feature Plan

Context doc for AI-assisted development. Records design decisions before implementation.

> Status: **planned** (2026-06-28). Not yet started.

## Problem

The canvas uses visual encoding everywhere — colored borders for change states,
dashed lines for async edges, dot/arrow markers for direction, different path
styles — but there is zero legend or key explaining what any of it means.
Users learn by trial and error, which is bad UX for a professional tool.

## Scope (locked)

- **Always visible** — floating panel in bottom-left corner of canvas,
  semi-transparent, always on. Toggle button in toolbar to hide.
- **Toggle state persisted** — show/hide preference survives page reload
- **Static reference** — no canvas interaction in v1 (interactive legend is v2)
- **Content v1:** element change states + edge styles + edge markers
- **Auto-hides** in presentation mode
- **Included in PNG export** — when user exports selected nodes, legend renders
  at bottom-left of the exported image (fixed offset from content bbox)

## Out of scope (deferred)

- Interactive legend (hover legend item → highlight matching elements)
- Click legend item to filter canvas by that style
- FK edge specific legend entry (indigo dashed — relevant only when DB containers expanded)
- Custom legend entries (user-defined tags)

## Key decisions (and why)

1. **Always visible, bottom-left corner.** Why: the toolbar is top, right panel is
   right, minimap is bottom-right (when visible). Bottom-left is the only free
   corner. Always-on means new users see the reference immediately — no discovery
   problem. Power users toggle it off in toolbar.

2. **Toggle via toolbar, not settings.** Why: the legend is a canvas aid, not a
   preference. A toggle button in the toolbar (between "Fit" and "Add element")
   is one click away. Settings would bury it.

3. **Semi-transparent glass panel.** Why: must not obscure nodes behind it.
   Uses the same `glass-panel` style as the toolbar and minimap. Opacity ~85%.

4. **Static reference only (v1).** Why: interactive legend (hover to highlight)
   requires tracking all elements by changeState tag, subscribing to canvas state,
   and coordinating highlight state. That's a separate feature with its own complexity.
   v1 just answers "what does this color mean?"

5. **Content derived from the changeState system.** Why: the legend doesn't define
   new colors — it reads the same `CHANGESTATE_ELEMENT_STYLES` and
   `CHANGESTATE_RELATIONSHIP_STYLES` constants that drive rendering. Single source
   of truth. If someone adds a new change state, the legend auto-updates.

## Visual design

```
┌─ Legend ──────────────────────┐
│                               │
│ Elements                      │
│ ┌──────────┐  Unchanged       │
│ │ blue box │  (no change)     │
│ └──────────┘                  │
│ ┌──────────┐  New             │
│ │ green box│  (added)         │
│ └──────────┘                  │
│ ┌──────────┐  Modified        │
│ │ amber box│  (changed)       │
│ └──────────┘                  │
│ ┌──────────┐  Removed         │
│ │ red box  │  (deleted)       │
│ └──────────┘                  │
│                               │
│ Edges                         │
│ ──────────  Straight          │
│ ╭─────────  Curved            │
│ └──┐┌──    Orthogonal         │
│ - - - - -  Dashed (async)     │
│ ●─────→    Dot → Arrow        │
│                               │
└───────────────────────────────┘
```

## Key files (planned)

- `src/components/canvas/CanvasLegend.tsx` — the panel component, reads
  `CHANGESTATE_ELEMENT_STYLES` and `CHANGESTATE_RELATIONSHIP_STYLES` to
  render legend entries
- `src/components/canvas/Canvas.tsx` — renders `<CanvasLegend />` inside the
  ReactFlow container, conditionally shown
- `src/lib/themes.ts` — may need a helper to extract legend-format style entries
- `src/components/layout/Toolbar.tsx` — toggle button for legend visibility

## Tests

- `src/components/canvas/CanvasLegend.test.tsx` — unit: renders all change states,
  renders edge style entries, hides when toggled off, hides in presentation mode
- No E2E needed for v1 — visual component, static content, no interaction

## Open items

- FK edge entry (indigo dashed) — add when DB table view is more mature
- Interactive legend (hover to highlight) — v2
- Legend position preference (bottom-left vs bottom-right) — if users complain
- Custom tag entries — if users want legend for their own tags
