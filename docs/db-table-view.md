# Database Table View — Feature Doc

Context doc for AI-assisted development. Records what was built and **why**.
Keep current as the feature changes.

> Status: **Draft / Spike** (2026-06-25). Branch `feat/db-table-view` (PR #16).
> All core pieces prototyped and working. Plan to split into 3 clean PRs.

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

- FK edge rendering between table nodes
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
- Adds Database containers from expand mode without view switching

### PR B2 — Database expand "+" → Table / Component dropdown + full UX
- `src/components/canvas/nodes/TableNode.tsx`: renders table + columns
- `src/lib/expandComposite.ts`: `ExpandContext.tableData`, `layoutSubtree` for DB
- `src/components/canvas/Canvas.tsx`: wire `tableData` into expand pipeline
- `src/components/layout/RightPanel.tsx`: `DatabaseTablesTab`
- `src/components/canvas/MermaidOverlay.tsx`: full-canvas ERD editor
- `src/components/layout/FloatingInspector.tsx`: wider panel

### Design decisions (from spike)
- Tables in sidecar, never DSL (through-line constraint)
- Database stays Container with `"Database"` tag, not new model type
- Boundary detects DB via `isDatabase` flag from `buildExpandBoundaryNodes`
- Panels scroll horizontally when content overflows (`overflow-auto`)
- `?? []` outside zustand selector to avoid infinite re-render
- No dropdown `useState` inside React Flow nodes (causes re-render loops)

## Progress log

### 2026-06-25 — spike complete, split plan locked (PR #16)
- All pieces working end-to-end. 15+ commits on `feat/db-table-view`.
- Split into 3 clean PRs for review and merge.

### 2026-06-24 — feature shipped (branch `feat/db-table-view`)

- 7 commits: types+parser, sidecar, store slice, TableNode component,
  expand pipeline integration, Mermaid overlay, RightPanel table editor
- Mockup: `docs/mockups/db-diagram-panel.html`
- Plan: see SCALING-DESIGN.md §3 (Database table view)
