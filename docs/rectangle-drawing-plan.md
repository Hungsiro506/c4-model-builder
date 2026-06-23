# Free-form rectangle drawing — feature plan

Context doc for AI-assisted development. The feature is **not yet built** —
this doc scopes it so the next session can start without re-researching.

## Goal

Draw a rectangle on the canvas (Excalidraw / FigJam frame), then assign elements
to it — a visual wrapper that persists. Different from the existing Group feature
(select-first, group-later): this is **draw-first, assign-later**.

## What exists today

- **Groups** — select elements → right-click → Group → a `GroupNode` box wraps them.
  Groups are in the model (`model.groups[]`) and rendered as overlay nodes.
- **Boundaries** — auto-drawn around container/component members in scoped views.
  System-owned, not user-drawn.
- **The panel** — `AddElementPanel.tsx` has a "Create new" section with chips.
  A draw tool could be added here.

## What to build

1. **Draw tool** — a toggle in the toolbar / tool rail. When active, mouse-down on
   canvas starts drawing a rectangle; mouse-up finishes it.
2. **Creation** — the drawn rect becomes a new `Group` with no members initially.
   The `GroupNode` renders the box.
3. **Assignment** — drag an element into the box, or select the box and click
   "add to group," or elements whose centers fall inside the rect on draw-end
   are auto-assigned.
4. **Persistence** — groups already round-trip in the DSL. No new storage needed.

## Key decisions (open — discuss with the user)

- **Auto-assign on draw?** If elements are inside the drawn rect, auto-add them
  or leave the rect empty and let the user assign manually?
- **Tool placement:** toolbar icon (like Multi-select), or a palette chip in
  AddElementPanel?
- **Visual style:** same as existing group nodes (dashed border, label), or a
  distinct style (solid, different color)?
- **Nesting:** can a rect contain another rect?

## Key files

- `src/components/canvas/canvasBuilders.ts` — `buildGroupNodes` draws group boxes
- `src/components/canvas/Canvas.tsx` — mouse handlers, `onPaneClick`,
  `onSelectionChange`
- `src/components/layout/AddElementPanel.tsx` — create-new palette
- `src/types/model.ts` — `Group` type (`id`, `name`, `elementIds`)
- `src/store/slices/group-slice.ts` — group CRUD

## Related

- `docs/SCALING-DESIGN.md` §10 — Canvas & Edge UX (free-form rectangle)
- `docs/expand-in-place-plan.md` — expand-in-place feature doc (same format)

## Progress log

### 2026-06-22 — scoped, not started

- Requirement identified during product review. Deferred to after movable-edges.
- This doc created as a handoff for the next session.
