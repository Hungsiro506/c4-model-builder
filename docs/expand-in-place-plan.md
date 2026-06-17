# Expand-in-place (semantic zoom) — build plan

Context doc for AI-assisted development. Keep this current as the feature lands.

## Problem

Authoring C4 "current vs proposed" change docs in Excalidraw means redrawing the
same picture at every level (context → container → component). To "dive deeper" you
copy the whole drawing and hand-edit it, then keep the change-coloring consistent
across all levels manually. Error-prone and slow.

Goal: one model you can **zoom into in place** — click a system to expand it into its
containers while every other element stays put. No copy-paste per level.

## Scope (locked)

- **Build:** zoom / expand-in-place + edge handling across levels.
- **Do NOT build:** change-coloring. Already supported — Structurizr tags + styles.
  Verified: element styles parsed in `src/lib/dsl/parser-styles.ts` (`applyStyleProperty`),
  relationship styles (`applyRelStyleProperty`, supports color/thickness/dashed),
  tag cascade applied in `src/components/canvas/canvasBuilders.ts` (`getElementStyle`,
  relationship style at the edge builder). Tag elements/edges `new`/`updated`/`existing`
  + add styles → colored. Because tags live on model elements, color persists across zoom.
- **No dual current/proposed canvas.** Single model only.

## Key decisions (and why)

- **Expand state lives in the sidecar** (`<workspace>.c4hero.json`), not the `.dsl`.
  Why: `.dsl` must stay pure round-trippable Structurizr. Field: `expandedElementIds`.
- **Gesture = the existing `+` / zoom button** on a node (`src/components/canvas/nodes/BaseC4Node.tsx`,
  `ZoomButton`, currently wired to `onDrillIn`). Repoint its handler to expand-in-place.
  Why: surface already exists; avoids double-click (taken by old drill) and its bugs.
- **Old drill (swap-view) stays** as-is (`src/store/slices/navigation-slice.ts` `drillInto`).
  Expand-in-place is an additional path, not a replacement.
- **Edge rule = nearest visible ancestor.** For each model relationship a→b, draw an edge
  between the nearest visible ancestor of a and of b; drop self-pairs; dedupe keeping the
  finest. Arrow count then adapts to expansion automatically.
- **Bundling = bundle ×N (default).** When >1 visible nodes connect to a single collapsed
  box, draw one summary edge with a count badge, anchored at the collapsed box. Bundle edges
  are synthetic (computed, not in the model): read-only, click to drill into the list.
  Authoring only connects visible nodes, binds to the exact element under cursor.
- **Layout = 1D gap-shift (v1).** Expanded box grows by Δ; shift nodes after it along the
  dagre axis by Δ. Far nodes unaffected. Cheap, predictable, keeps siblings stable.
  Upgrade path if too coarse on dense canvases: constraint layout (webcola/elk). Not now.

## Staged plan (each stage = one commit = rollback checkpoint)

0. Branch + baseline. Tagged `axon.dsl` renders colored (verifies color support live).
1. `gapShift(nodes, expandedBox, Δ)` layout math.
2. Expand state in store + sidecar (`expandedElementIds`), toggle + persist.
3a. Composite render: expanded children drawn inside the box (overlap OK).
3b. Edge re-target (nearest visible ancestor) + bundle.
4. Apply gap-shift so siblings stay stable.

Stages ordered so each works standalone; stuck at N → reset to N-1.

## Tests — E2E only (Playwright), TDD

Rationale: code is iterated quickly; E2E tests behavior and survives refactors.
Harness: `e2e/fixtures/workspace.ts` (`parseAndLoad`, `getCanvasNodeBoxById`,
`getNodeCount`, `getEdgeCount`, node = `.react-flow__node[data-id]`, edge = `.react-flow__edge`).
New hook needed: expand a node by id (no expand-in-place hook exists yet).

Cases (`e2e/expand-in-place/expand.spec.ts`):
1. Baseline context: load axon → expected system-node count + edge count.
2. Colors apply: new = new color, existing = gray, new edge colored.
3. Expand keeps siblings: expand EDCA → other system boxes unchanged (±2px). [core]
4. Expand adds children in place, inside the box's bounds.
5. Edge re-target, one side expanded → lands on collapsed box (or 1 bundle ×N).
6. Both expanded → finest edges between children.
7. Color persists across zoom. [core — the real workflow]
8. Collapse → children gone, siblings restored to baseline.
9. Expand draws a boundary box wrapping the children.
10. Nested expand (system → container) keeps both boundaries nested, no overlap.
11. Real UI gestures: zoom button expands; boundary-header button collapses.

## Persistence — deliberately deferred

Expand state is **not** persisted. On reopen everything starts collapsed at the
system level (store inits `expandedElementIds: []`; `loadWorkspace` does not set it).
The user re-expands from scratch each session — matches expectation, keeps the `.dsl`
pure and the sidecar minimal.

Future seam (if persistence is ever wanted): add `expandedElementIds` to `SidecarView`
in `src/lib/sidecar.ts` and hydrate the store slice on load. No DSL changes — expand
state is layout metadata, so it rides the sidecar like positions/viewport.

## Open items (not yet decided)

- Manual node positions × expand state: gap-shift assumes auto-layout coords; behavior
  when the user has dragged nodes is untested.
- Deep nesting visuals (component inside container inside system) may get cramped.
- Database container: expand to show tables (inline chips) + separate ER view — separate
  feature, not in this plan.

## Progress log

### 2026-06-17 — cross-level guard, edge fixes, move-while-expanded

- **Cross-level connection guard** (`src/lib/connectionValidation.ts`): block drawing a
  relationship between endpoints at different C4 levels (e.g. a container shown via
  expand-in-place dragged onto a top-level system). `elementLevel` (person/system=0,
  container=1, component=2); `canConnectElements` strips the `__expand_boundary__` prefix
  and requires equal levels. Wired into `Canvas.isValidConnection` + `onConnect`/`onReconnect`
  backstops. Equal-level connections are intentionally allowed (by design).
- **Gemini review fixes**: `collapseElement` now also drops expanded descendants from
  `expandedElementIds` (no stale resurfacing on re-expand); expand-boundary `zIndex` is
  `-5 + depth` so nested boxes stack correctly.
- **Edge level-equalization** (`buildCompositeEdges`): an equal-level child→child relationship
  (e.g. `a1→b1`) folds the deeper side up when only one parent is expanded, so it renders as
  `A→B-wrapper` instead of a broken cross-level `A→b1`. Both expanded → finest `a1→b1` stays.
- **Move while expanded** (long-term, sidecar-persisted):
  - `View.expandedLayout?: ElementInView[]` — absolute positions of dragged expand-in-place
    children. View-scoped, persisted in the sidecar, never serialized to the DSL.
  - `sidecar.ts`: `SidecarView.expanded` (+ guard); extract from / apply to `view.expandedLayout`.
  - `view-slice.ts`: `updateExpandedChildPosition(nodeId, x, y)` upserts into the active view's
    `expandedLayout` (expanded children aren't in `view.elements`, so `updateNodePosition`
    no-ops for them).
  - `Canvas.tsx`: after `expandComposite`, saved positions override the recomputed subtree
    layout; `onNodeDragStop` routes expanded-child drags to the new action via
    `isExpandedChildNode`.
  - **Drag the whole expanded box**: the populated expand boundary is now `draggable` via its
    `.c4-overlay-drag-handle` header; `onNodeDragStart` collects the visible descendants
    (`getExpandBoundaryMemberIds`) and translates them as a unit, persisting each via
    `updateExpandedChildPosition`.
  - Resolves the "manual positions × expand state" open item above for the drag case.
- **Scope validation**: removed the software-system-scope "internals for only one system" error
  — multiple systems may define internals in a single workspace.
- Tests: unit `connectionValidation`, `sidecar` (expandedLayout round-trip), `scopeValidation`;
  E2E `cross-level-connection`, `edge-retarget`, `move-while-expanded` (child drag + box drag,
  both surviving collapse/re-expand). Full suite green (1128 unit, 20 expand-in-place E2E).
