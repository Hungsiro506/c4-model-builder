# c4hero Capability Map

What c4hero **does today** — the functional capabilities a user has when they open the app.
Written for both humans and AI agents: read it as "here is everything the product currently
supports." When planning to scale, use it to judge what to reuse, change, or remove.

- **Companion docs:** [`FEATURES.md`](FEATURES.md) (narrative overview), `CLAUDE.md` (architecture).
- **`Where` column** points at the implementing file — the starting point for reuse or change.
- **Maintenance:** when a capability ships or changes, update its row.

---

## 1. Model — what you can describe

| Capability | Where |
|---|---|
| Create People, Software Systems, Containers, Components | `src/types/model.ts`, `src/store/slices/` |
| Define relationships between elements (description, technology, sync/async, line style, URL, tags) | `src/store/slices/relationship-slice.ts` |
| Group elements together (ad-hoc clusters across types) | `src/types/model.ts`, `src/components/layout/right-panel/GroupProperties.tsx` |
| Mark a Person or System as Internal / External | `src/components/layout/RightPanel.tsx`, `src/lib/dsl/parser-model.ts` |
| Set element status: Live / Planned / Deprecated / Removed | `src/components/canvas/nodes/StatusDot.tsx`, `src/components/layout/RightPanel.tsx` |
| Record owner / team, technology, URL on elements | `src/components/layout/right-panel/fields.tsx` |
| Parent-level relationships shown automatically (implied) | `src/lib/impliedRelationships.ts` |

---

## 2. Views — how you look at the model

| Capability | Where |
|---|---|
| System Landscape, System Context, Container, Component views | `src/lib/dsl/parser-views.ts`, `src/types/model.ts` |
| Default views generated automatically when none are defined | `src/lib/dsl/auto-views.ts` |
| Create, rename, switch, and list views | `src/components/views/CreateViewDialog.tsx`, `src/components/layout/FloatingViewsPanel.tsx`, `src/components/layout/ViewSwitcher.tsx` |
| Drill into a system → its containers → its components, with back navigation | `src/store/slices/navigation-slice.ts` |
| Boundaries auto-drawn around a system/container and its members in child views | `src/components/canvas/canvasBuilders.ts` |

---

## 3. Expand-in-place (semantic zoom)

| Capability | Where |
|---|---|
| Expand a system to show its containers inline, without leaving the view | `src/lib/expandComposite.ts`, `src/store/slices/navigation-slice.ts` |
| Expand a container to show its components inline; nested expansion | `src/lib/expandComposite.ts` |
| Siblings stay in place and are pushed clear of the expanded wrapper | `src/lib/expandLayout.ts`, `src/components/canvas/Canvas.tsx` |
| Drag expanded children and the whole expanded box; positions are remembered | `src/lib/sidecar.ts` |

---

## 4. Styling & color

| Capability | Where |
|---|---|
| Color and style elements **by tag only** (no direct per-element/per-edge color): background, text color, shape, border, opacity, font size | `src/components/layout/highlighter/TagManagerDialog.tsx`, `src/components/layout/FloatingBottomStrip.tsx` |
| Color picker: type a hex or named color, or pick a preset swatch, or clear it (no spectrum/wheel/eyedropper) | `src/components/layout/tagStyleControls.tsx` |
| Choose from 12 canvas color themes | `src/components/settings/CanvasSettingsDialog.tsx` |
| Pick element shapes (Box, Cylinder, Person, Hexagon, and more) | `src/components/layout/tagStyleConstants.ts` |
| Relationship line appearance follows interaction style (sync solid / async dashed) | `src/components/layout/RightPanel.tsx`, `src/components/canvas/edges/RelationshipEdge.tsx` |

---

## 5. Editing — the inspector

| Capability | Where |
|---|---|
| Edit an element: name, location, status, owner, URL, technology, description, tags | `src/components/layout/RightPanel.tsx` |
| See an element's incoming/outgoing relationships | `src/components/layout/RightPanel.tsx` (Relations tab) |
| Edit a relationship: description, technology, interaction style, line style (curved/straight/orthogonal), URL, tags | `src/components/layout/RightPanel.tsx` |
| Edit a group: name and members | `src/components/layout/right-panel/GroupProperties.tsx` |
| Create relationships by dragging from one node to another; reconnect endpoints | `src/store/slices/relationship-slice.ts` |

---

## 6. Canvas & interaction

| Capability | Where |
|---|---|
| Add elements (quick-add by type, or pull existing-but-hidden elements in) | `src/components/layout/AddElementPanel.tsx` |
| Auto-arrange layout; choose direction (top-bottom / bottom-top / left-right / right-left) | `src/components/layout/FloatingToolRail.tsx` |
| Zoom in/out, zoom to fit, pan, minimap (always / auto / never) | `src/components/layout/FloatingZoomHud.tsx`, `src/components/settings/CanvasSettingsDialog.tsx` |
| Snap nodes to a 32px grid | `src/components/canvas/Canvas.tsx`, `src/components/settings/CanvasSettingsDialog.tsx` |
| Multi-select and batch align / distribute / group / delete / duplicate | `src/components/layout/MultiSelectBar.tsx` |
| Presentation mode (full-screen, chrome hidden) | `src/lib/commands.ts` |
| Onboarding canvas guide | `src/components/canvas/CanvasGuide.tsx` |

---

## 7. Finding things & commands

| Capability | Where |
|---|---|
| Search elements and views (with type/tag filters) | `src/components/search/SearchDialog.tsx` |
| Command palette — every action, with shortcuts shown | `src/components/command-palette/CommandPalette.tsx`, `src/lib/commands.ts` |
| Keyboard shortcuts for create / edit / view / navigation / file actions | `src/hooks/useKeyboardShortcuts.ts` |
| Highlight subgraphs by Tag / Status / Technology / Team (stacking filters, dim non-matches) | `src/components/layout/highlighter/BottomHighlighterBar.tsx`, `src/lib/highlight.ts` |

---

## 8. Files & export

| Capability | Where |
|---|---|
| Edit visually, save as Structurizr DSL (round-trips cleanly) | `src/lib/dsl/`, `src/lib/workspaceDocument.ts` |
| Open a folder of `.dsl` files and pick a workspace (Chromium); single-file mode elsewhere | `src/lib/folderIO.ts`, `src/lib/fileIO.ts` |
| Remembers recent folders/files; auto-save and crash recovery | `src/lib/fileIO.ts`, `src/hooks/useAutoSave.ts` |
| Export the current view as PNG (dark/light) or SVG; export/copy DSL | `src/components/dialogs/ExportDialog.tsx` |
| Layout, positions, and expand state saved alongside the `.dsl` in a sidecar file | `src/lib/sidecar.ts` |
