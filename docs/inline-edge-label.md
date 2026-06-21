# Inline edge-label editing — feature doc

Context doc for AI-assisted development. Records what was built and **why**.

## Problem

To set a relationship's description you had to select the edge and type in the right-hand properties panel — a round-trip that breaks flow when you're sketching. Nodes already support inline rename (double-click → edit in place, `InlineName`); edges didn't.

Goal: edit an arrow's description **right on the canvas**, Excalidraw-style.

## Scope

- **Build:** double-click an edge (the line *or* its label) → inline text editor at the label midpoint → Enter/blur saves, Esc cancels. Works on a **bare** edge (no description yet) too.
- **Edit description only.** Technology + other fields stay in the right panel — keeps the inline surface simple.
- Single-click still = select (unchanged). Right panel still works as before.

## Key decisions (and why)

- **Edit-toggle in the store, draft local.** `editingRelationshipId` lives in `ui-slice` (set by `Canvas.onEdgeDoubleClick` and the label's own `onDoubleClick`); the draft text + focus are local to `RelationshipEdge`.
  - Why store, not pure-local: edges are rebuilt frequently (layout/overlay passes); a store flag survives those rebuilds, and a single id naturally allows only one editor at a time. `onPaneClick` clears it.
- **Trigger via React Flow `onEdgeDoubleClick`** for the bare-edge case (the line is an SVG path with no label to click). The rendered label also gets its own `onDoubleClick` so double-clicking existing text works (the label is a portal `div`, outside the edge SVG, so RF's handler doesn't cover it).
- **Writes through `updateRelationship`** — so undo/redo + autosave work for free, same as the panel.
- **Esc-cancel guard.** Clearing the edit unmounts the input, which can fire `onBlur` → would save the discarded draft. A `skipBlurRef` makes the unmount blur a no-op on cancel.
- **Empty description clears it** (`description: trimmed || undefined`) — no empty-string residue in the DSL.

## Key files

- `src/components/canvas/edges/RelationshipEdge.tsx` — inline `<input>` + commit/cancel + label dblclick.
- `src/components/canvas/Canvas.tsx` — `onEdgeDoubleClick` → set editing; `onPaneClick` clears it.
- `src/store/slices/ui-slice.ts`, `src/store/workspace-types.ts` — `editingRelationshipId` + `setEditingRelationship`.

## Tests (TDD, E2E)

`e2e/inline-edge-label/inline-edge-label.spec.ts`:
1. Double-click a bare edge → editor opens → type → saves to `relationship.description` + label shows it.
2. Esc cancels without saving.
3. Double-click an existing label → edits in place.

Note: edges render as thin (often zero-width-bbox) SVG paths, so the spec double-clicks the **midpoint between the two node centres** with the raw mouse rather than the path locator.

Verified: 3 E2E + full unit suite (1135) green, typecheck + lint clean.

## Open items

- Inline editing of **technology** chips deferred (panel only for now).
- Bundled/composite edges (expand-in-place) write to the finest underlying relationship; not specially handled.

## Progress log

### 2026-06-21 — shipped (branch `feat/inline-edge-label`)

- Double-click edge/label → inline description editor; store-backed toggle; undo/redo via `updateRelationship`; Esc-cancel blur guard.
- Built independently of the in-flight `feat/changestate` PR — disjoint files (no shared-file edits), so no merge conflict in either order.
