# Movable / bendable edges — feature plan

Context doc for AI-assisted development. Captures the research, attempts, and
learnings from the 2026-06-22 session so the next developer doesn't repeat them.

> Status: **attempted, reverted, parked** — working click-to-toggle was built (curved
> ⇄ straight), but true Excalidraw-style drag-to-bend needs a different approach.

## Goal

Edges should be **draggable to bend** like Excalidraw — grab the middle of an arrow and
drag to curve it. Today edges are fixed; the bezier path is computed from source/target
positions and can only be changed by reconnecting endpoint handles.

## What was built (and worked)

- **Click-to-toggle:** clicking the edge body toggles between `Curved` and `Straight`
  line style. Used a 300ms click-timer to distinguish single-click (toggle) from
  double-click (inline editor).
- **Live store subscription:** the edge subscribed to `useWorkspaceStore` for live
  relationship data (`lineStyle`) because `data.relationship` from React Flow props is
  frozen at edge-build time and never updates on store changes. Required for the toggle
  to produce a visible path change.
- **E2E green:** 5/5 (inline-edge 4/4 + click-to-toggle). Full suite 1185 unit green.

## What was attempted (and failed)

### Attempt 1: SVG circles as drag handles
Rendered `<circle>` elements at the bezier midpoint inside the edge SVG. Dragging
offset a module-level `Map<string, {dx,dy}>` (edgeBends.ts), and a custom bezier
computation applied the offset to control points.

**Problem:** the circles were rendered BEFORE `BaseEdge` in SVG DOM order, so they
painted behind the visible edge line. Moving them after BaseEdge fixed the z-order but
the SVG coordinate system for the `cx`/`cy` attributes didn't match the EdgeLabelRenderer
coordinate system that labels use.

### Attempt 2: EdgeLabelRenderer divs as handles
Rendered HTML `<div>` circles inside `EdgeLabelRenderer` (same portal the edge labels
use) at `(labelX, labelY)` from `getBezierPath`.

**Problem:** the divs used a different coordinate space than expected — they scattered
randomly across the canvas instead of sitting on the edges. The `labelX`/`labelY` from
`getBezierPath` works for labels (which also use EdgeLabelRenderer), but my computed
`hx`/`hy` from `sourceX + (targetX-sourceX)*frac` didn't work. Root cause unclear.

### Attempt 3: Make the edge body itself draggable
Added `onMouseDown` to the invisible 24px-wide SVG hit path. On drag, offset bezier
control points.

**Problem:** `onMouseDown` with `stopPropagation` prevented React Flow from handling
edge selection and double-click. Without `stopPropagation`, React Flow consumed the
event and our handler never ran. The click-timer approach solved the single-vs-double
problem but the drag (mousemove after mousedown) couldn't coexist with React Flow's
own edge interaction handling.

### Attempt 4: Excalidraw-style dot on selection
A visible dot appeared at the midpoint only when the edge was selected. Click the dot
to toggle style.

**Problems:**
- At z-index 5 in EdgeLabelRenderer, the dot sat BEHIND the label (z-index 10). Fine
  for visibility but blocked clicks when the label was wide.
- When the inline editor opened, the dot overlaid it.
- Offset the dot above the label (labelY - 18) solved the label overlap but looked odd.

## Key technical blockers

1. **React Flow custom edges have no built-in edge updater.** Only built-in edge types
   (BezierEdge, SmoothStepEdge, etc.) get the draggable midpoint circle
   (`edgeUpdaterRadius`). Custom edges rendered via `BaseEdge` must implement their own.

2. **Coordinate space mismatch.** `EdgeLabelRenderer` renders into a portal `<div>`
   above the SVG. Labels position correctly because they use `labelX`/`labelY` from
   React Flow's path functions (`getBezierPath`, etc.). But computing positions from
   raw edge props (`sourceX`, `sourceY`) doesn't match — unknown whether it's the
   snap-to-node offset, viewport transform, or pixelRatio.

3. **React Flow event handling vs custom handlers.** React Flow's edge click/selection
   fires at the `<g>` level. Adding `onMouseDown` to inner SVG elements with
   `stopPropagation` prevents selection. Without it, React Flow consumes the event.

4. **Edge data is frozen at build time.** `canvasBuilders.ts` constructs edges once;
   relationship data in `data.relationship` never refreshes. A live
   `useWorkspaceStore` subscription is needed to see `lineStyle` changes.

## Recommended approach for the next attempt

### Option A: Switch to React Flow built-in edge types
Use `BezierEdge` instead of custom `RelationshipEdge`. Render labels+editor via
EdgeLabelRenderer as before. Built-in edges get the edge updater for free
(`edgeUpdaterRadius` on `<ReactFlow>`). Tradeoff: less control over edge rendering.

### Option B: Use smoothstep edges with waypoints
Switch `lineStyle === 'Curved'` edges to use `getSmoothStepPath` with `borderRadius`.
React Flow's smoothstep edges support waypoints natively — drag the midpoint to add a
bend point. The `onReconnect` handler already exists in Canvas.tsx for persisting
handle changes.

### Option C: Source/target handle cycling
When the user clicks the midpoint, cycle through handle positions
(`bottom-b-*` → `left-b-*` → `top-b-*` → `right-b-*`). Changing the handle position
changes the bezier path direction. This is the simplest approach that produces visible
path changes without custom bezier math. Already prototyped (click-to-toggle was a
special case of cycling between two styles).

### Option D: Pause until React Flow built-in support
React Flow may add edge-updater support for custom edges in a future version. Track
`@xyflow/react` releases.

## Key files

- `src/components/canvas/edges/RelationshipEdge.tsx` — custom edge component
- `src/components/canvas/canvasBuilders.ts` — edge assembly (`buildEdges`,
  `assembleEdges`)
- `src/components/canvas/Canvas.tsx` — ReactFlow wrapper, `onEdgeDoubleClick`,
  `onReconnect`
- `src/lib/edgeBends.ts` — module-level bend-offset store (was added, then removed)
- `e2e/movable-edges/` — E2E specs (was added, then removed)

## Related

- `docs/inline-edge-label.md` — double-click to edit description (shipped, works)
- `docs/SCALING-DESIGN.md` §10 — Canvas & Edge UX improvements

## Progress log

### 2026-06-22 — attempted, reverted, parked

- 4 approaches tried (SVG circles, EdgeLabelRenderer handles, edge-body drag,
  select-to-reveal dot). Click-to-toggle (curved ⇄ straight) was the only working
  increment.
- Reverted PR #13 to main baseline. This doc captures the learnings.
- Recommended: start with Option C (handle cycling) or Option A (built-in edge types)
  in a fresh session.
