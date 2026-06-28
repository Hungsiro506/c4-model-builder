# Database Table View — Feature Doc

Context doc for AI-assisted development. Records what was built and **why**.
Keep current as the feature changes.

> Status: **PR A merged** (2026-06-25). Branch `feat/db-table-view-foundation` (PR #18).
> **PR B1 merged** (2026-06-25). Branch `feat/db-table-view-b1` (PR #23).
> **PR B2 merged** (2026-06-25). Branch `feat/db-table-view-b2` (PR #24).
> **PR B2.5 merged** (2026-06-26). Branch `feat/db-table-view-b2.5` (PR #25).
> **PR table-drag submitted** (2026-06-26). Branch `feat/table-drag` (PR #26).
> PR B3 deferred (Mermaid overlay). PR FK-edge-interact submitted (2026-06-28). Branch `feat/fk-edge-interact` (PR #27).

## Problem

Database containers in C4 diagrams (Container + `"Database"` tag) expand to show
nothing useful — they typically have zero components. Architects need to model
database schemas (tables, columns, foreign keys) as part of their architecture
documentation, not just draw a cylinder and move on.

## Scope (locked)

- **Database container expands in-place** on the main canvas — tables render as
  nodes inside the expanded boundary. Sibling C4 nodes are gap-shifted.
- **Tables defined in the sidecar** (`<workspace>.c4hero.json`), never in the
  Structurizr DSL. DSL stays pure and round-trippable.
- **Mermaid ERD text editor** as a full-canvas overlay. Toggle with the
  "Mermaid Editor" button in the RightPanel Tables tab.
- **Bidirectional sync (via re-apply):** editing Mermaid text and applying it
  replaces table definitions. Visual edits (via RightPanel inspector) update
  tables directly.
- **FK edges** between tables are not yet drawn (deferred).
- **Undo** does not cover table edits (same tier as node positions).

## Key decisions (and why)

1. **Tables in sidecar, not in model.** Why: the Structurizr DSL has no concept
   of database tables. Adding a `Table` model element would either pollute the
   DSL or require a parallel persistence path. Sidecar storage follows the
   established pattern for positions and expand state.

2. **Database stays a Container with `"Database"` tag.** Why: Structurizr
   represents databases as containers with a `Database` tag. No new model
   element needed. The expand pipeline detects the tag and switches to table
   rendering.

3. **Mermaid ERD as the text format.** Why: Mermaid ERD is widely used,
   well-documented, and already supported by GitHub, Notion, and many tools.
   It's also the foundation for a future general-purpose Mermaid diagram
   integration.

4. **Full-canvas overlay for Mermaid text, not a side panel.** Why: ERD text
   can be long and benefits from full screen real estate. The overlay pattern
   keeps the main canvas uncluttered when not actively editing text.

5. **TableNode is a custom React Flow node, not BaseC4Node.** Why: tables
   aren't C4 model elements — they don't have status dots, scope violations,
   tag-based highlighting, or the full BaseC4Node machinery. A dedicated
   component is simpler and more maintainable.

6. **No undo for table edits (v1).** Why: undo snapshots the workspace object.
   tableData is separate store state. Extending undo to cover tableData requires
   a larger refactor of the undo stack — same problem as node positions. Listed
   as a deferred item.

## Key files

- `src/types/model.ts` — `ColumnDef`, `TableDef` interfaces
- `src/lib/mermaidParser.ts` — `parseMermaidERD()`, `resolveForeignKeys()`
- `src/lib/mermaidGenerator.ts` — `generateMermaidERD()`
- `src/lib/sidecar.ts` — `tables` field in `SidecarData`, `extractSidecar()` /
  `applySidecar()` updated
- `src/lib/workspaceDocument.ts` — `parseWorkspaceDocument()` returns `tableData`
- `src/store/slices/table-slice.ts` — table CRUD actions + Mermaid overlay state
- `src/store/workspace-types.ts` — `tableData`, `mermaidText`, table action signatures
- `src/store/workspace.ts` — store composition with table slice
- `src/store/slices/lifecycle-slice.ts` — `loadWorkspace` / `closeWorkspace` for tableData
- `src/hooks/useAutoSave.ts` — passes `tableData` to `extractSidecar`
- `src/components/canvas/nodes/TableNode.tsx` — React Flow node for tables
- `src/components/canvas/nodes/index.ts` — `table` node type registered
- `src/components/canvas/canvasBuilders.ts` — `isDatabaseContainer()`,
  `tableNodeId()`, `getTableNodeSize()`, `buildTableNode()`, `buildParentMap()` update
- `src/lib/expandComposite.ts` — `ExpandContext` with `tableData`, `layoutSubtree`
  sources table children for Database containers
- `src/components/canvas/Canvas.tsx` — wires `tableData` into expand pipeline,
  Mermaid overlay rendering
- `src/components/canvas/MermaidOverlay.tsx` — full-canvas Mermaid ERD editor
- `src/components/layout/RightPanel.tsx` — "Tables" tab for Database containers

## Tests

- `src/lib/mermaidParser.test.ts` — 28 tests: parse, generate, round-trip, edge cases
- `src/lib/sidecar.test.ts` — 9 table-specific tests added
- `src/components/canvas/nodes/TableNode.test.tsx` — 6 render tests
- `src/store/workspace.test.ts` — 14 table-slice CRUD tests added

## Open items (deferred)

- ~~FK edge rendering between table nodes~~ (done, PR #25)
- ~~Table node dragging inside DB container~~ (done, PR #26)
- ~~FK edge path adjustment (drag endpoints to different handles)~~ — done, PR #27
- Undo support for table edits
- SQL DDL import / `DatabaseProvider` interface
- Table highlight/fade participation
- Per-table/column drag-to-reorder in visual editor
- Mermaid text live preview (sync while typing)
- Full bidirectional sync (visual edits update Mermaid text live)

## Split plan (3 clean PRs from current spike)

Current branch `feat/db-table-view` (PR #16) is a working spike. Split into:

### PR A — Foundation
Types + Mermaid parser + sidecar schema + store slice. No UI.
- `src/types/model.ts`: `ColumnDef`, `TableDef`
- `src/lib/mermaidParser.ts` + `mermaidGenerator.ts`
- `src/lib/sidecar.ts`: `tables` field + guards + extract/apply
- `src/lib/workspaceDocument.ts`: pipe `tableData`
- `src/store/slices/table-slice.ts`: CRUD actions
- `src/store/workspace-types.ts`: `tableData` + `mermaidText` state
- `src/store/slices/lifecycle-slice.ts`: load/close `tableData`
- `src/hooks/useAutoSave.ts`: persist `tableData`

### PR B1 — System expand "+" → Container / Database dropdown
- `src/components/canvas/nodes/BoundaryNode.tsx`: "+" button opens dropdown
- `src/components/canvas/canvasBuilders.ts`: `isDatabaseContainer()` helper
- System "+" shows Container | Database (L1→L2); Container "+" shows Component (L2→L3)
- Adds Database containers from expand mode without view switching

### PR B2 — Database expand: Table rendering + canvas-driven editing
- `src/components/canvas/nodes/TableNode.tsx`: renders table name + columns on canvas
- `src/lib/expandComposite.ts`: `ExpandContext.tableData`, `layoutSubtree` sources tables for DB containers
- `src/components/canvas/Canvas.tsx`: wire `tableData` into expand pipeline
- `src/components/layout/RightPanel.tsx`: column editor when a table is selected (no "Tables" tab)
- `src/components/canvas/nodes/index.ts`: register `"table"` node type
- "+" on DB boundary adds Tables only (existing Components still render, back compat)
- Click table node → RightPanel shows column editor (name, columns, types)
- No Mermaid overlay, no RightPanel "Tables" tab (single creation path: canvas "+")

### PR B2.5 — Foreign key edges between tables (planned)
- FK resolver: parse `isForeignKey` columns → build source→target table.column pairs
- `buildTableEdges()` in `canvasBuilders.ts`: connect `__table__cid__t1` → `__table__cid__t2`
- Dagre routing: add FK edges to dagre graph in `layoutSubtree` so layout accounts for them
- Edge rendering: straight/curved thin dashed edges, distinct from model relationship edges
- Column editor: FK toggle + target table.column picker (replaces plain `isForeignKey` boolean)
- Self-contained: edge builder + FK resolver + small editor tweak, ~2–3 files

### PR B3 — Mermaid ERD editor (deferred, minor)
- `src/components/canvas/MermaidOverlay.tsx`: full-canvas ERD text editor
- Toggle button in table column editor
- Self-contained: one file + one `<MermaidOverlay />` in Canvas + one store toggle
- Zero coupling to B2 — add/remove without touching other files

### Design decisions (from spike)
- Tables in sidecar, never DSL (through-line constraint)
- Database stays Container with `"Database"` tag, not new model type
- Boundary detects DB via `isDatabase` flag from `buildExpandBoundaryNodes`
- Panels scroll horizontally when content overflows (`overflow-auto`)
- `?? []` outside zustand selector to avoid infinite re-render
- No dropdown `useState` inside React Flow nodes (causes re-render loops)

## Progress log

### 2026-06-25 — PR B2 merged (PR #24)
- Database expand: Table rendering + canvas-driven column editing.
- TableNode renders table name + columns with PK/FK indicators on canvas.
- DB boundary "+" shows "Table" (adds to sidecar tableData).
- Click table node → FloatingInspector shows TableEditor (name, type, PK toggle).
- expandComposite sources tables from tableData for DB containers.
- Canvas wires tableData through expand/boundary/edge pipelines.
- FloatingInspector visibility includes table selection.
- 20 new tests. To be squash-merged as `feat: add database table view with canvas-driven editing`.

### 2026-06-25 — PR B1 merged (PR #23)
- System expand "+" → Container / Database dropdown.
- `isDatabaseContainer()` helper in `canvasBuilders.ts`.
- SoftwareSystem boundary (L1→L2): dropdown shows Container | Database.
- Container boundary (L2→L3): dropdown shows Component only.
- Component excluded from System "+" — Components are L3, belong inside Containers.
- 11 new tests. Squash-merged as `feat: add Database container from expand dropdown`.

### 2026-06-25 — PR A merged (PR #18)
- Foundation layer: types, Mermaid parser/generator, sidecar tables, table-slice store.
- 46 new tests. No UI. squash-merged as `feat: add database table view foundation layer`.

### 2026-06-25 — spike complete, split plan locked (PR #16)
- All pieces working end-to-end. 15+ commits on `feat/db-table-view`.
- Split into 3 clean PRs for review and merge.

### 2026-06-24 — feature shipped (branch `feat/db-table-view`)

- 7 commits: types+parser, sidecar, store slice, TableNode component,
  expand pipeline integration, Mermaid overlay, RightPanel table editor
- Mockup: `docs/mockups/db-diagram-panel.html`
- Plan: see SCALING-DESIGN.md §3 (Database table view)

### 2026-06-26 — PR B2.5 merged (PR #25)
- FK resolver: naming-convention matching (`customer_id` → `customers.id`)
- `buildTableEdges()`: React Flow edges with thin dashed indigo style + FK column labels
- `FkEdge.tsx`: dedicated edge component
- Dagre wiring: FK edges participate in layout so tables arrange by FK relationships
- FK toggle per column in TableEditor (indigo badge next to PK)
- 9 new tests. To be squash-merged as `feat: add foreign key edges between database tables`.

### Implementation decisions (from PR #25)

1. **FK edges are editor-only, no drag-to-connect.** Drag-to-connect was tried then removed
   — the UX is fiddly on small table nodes. Column editor dropdowns are simpler and more
   explicit. TableNode has hidden handles only for ReactFlow edge routing (error #008).

2. **Auto-resolution disabled.** Naming convention (`customer_id` → `customers.id`) was
   initially built but removed. User must explicitly pick target table from dropdown.
   `resolveTableFKs()` still exists but is unused in the rendering pipeline.

3. **Column IDs use `crypto.randomUUID()` (UUID v7), not `nanoid`.** Table/column/FK-edge
   IDs are sidecar-only (never in DSL), so hyphens are safe. Model-level element IDs still
   use `nanoid` (no hyphens, valid DSL identifiers).

4. **FK matching uses column IDs only, never names.** Column names can have whitespace
   and follow no pattern. `col.id` is the only lookup key.

5. **`FkEdgeDef` stored as `fkEdges: Record<string, FkEdgeDef[]>` keyed by containerId.**
   Same pattern as `tableData`. Persisted in sidecar under `fkEdges` field. Container-scoped
   — same table name in different DB containers = different tables, no overlap.

6. **No FK cascade on table/column delete.** Reading `s.fkEdges` inside immer `set()`
   callbacks caused a ~20s E2E performance regression even when the field was empty `{}`.
   Immer draft reads create proxy overhead — harmless but expensive in aggregate. Orphaned
   FK edges are silent no-ops: `buildTableEdges` skips them when source/target tables
   don't exist.

7. **FK toggle just marks the column.** Edge only created when user picks target table
   from dropdown (or via `addFkEdge`). This avoids auto-creating edges with wrong targets.

8. **`sourceHandle`/`targetHandle` required on every FK edge.** ReactFlow needs handles
   to exist on source/target nodes for edge routing (error #008). TableNode provides
   invisible `bottom-source`/`top-target` handles — no UI, just routing anchors.

### 2026-06-26 — PR table-drag submitted (PR #26)
- Table nodes now draggable inside expanded Database container boundaries
- `buildTableNode`: `draggable: true`
- `isExpandedChildNode`: recognizes `node.type === 'table'` so drag positions persist
- Positions saved to `view.expandedLayout` (sidecar-persistent, survive reload)
- FK edges set `reconnectable: false` — non-interactive for now
- 1 unit test added. To be squash-merged as `feat: make table nodes draggable`.
