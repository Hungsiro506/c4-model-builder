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
9. Persist: reload restores `expandedElementIds` (Stage 2).

## Open items (not yet decided)

- Manual node positions × expand state: gap-shift assumes auto-layout coords; behavior
  when the user has dragged nodes is untested.
- Deep nesting visuals (component inside container inside system) may get cramped.
- Database container: expand to show tables (inline chips) + separate ER view — separate
  feature, not in this plan.
