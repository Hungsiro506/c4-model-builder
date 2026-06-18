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
| Group elements together (ad-hoc clusters across types) | `model.ts`, `right-panel/GroupProperties.tsx` |
| Mark a Person or System as Internal / External | `RightPanel.tsx`, `parser-model.ts` |
| Set element status: Live / Planned / Deprecated / Removed | `nodes/StatusDot.tsx`, `RightPanel.tsx` |
| Record owner / team, technology, URL on elements | `right-panel/fields.tsx` |
| Parent-level relationships shown automatically (implied) | `src/lib/impliedRelationships.ts` |

---

## 2. Views — how you look at the model

| Capability | Where |
|---|---|
| System Landscape, System Context, Container, Component views | `parser-views.ts`, `model.ts` |
| Default views generated automatically when none are defined | `src/lib/dsl/auto-views.ts` |
| Create, rename, switch, and list views | `CreateViewDialog.tsx`, `FloatingViewsPanel.tsx`, `ViewSwitcher.tsx` |
| Drill into a system → its containers → its components, with back navigation | `navigation-slice.ts` |
| Boundaries auto-drawn around a system/container and its members in child views | `canvasBuilders.ts` |

---

## 3. Expand-in-place (semantic zoom)

| Capability | Where |
|---|---|
| Expand a system to show its containers inline, without leaving the view | `src/lib/expandComposite.ts`, `navigation-slice.ts` |
| Expand a container to show its components inline; nested expansion | `expandComposite.ts` |
| Siblings stay in place and are pushed clear of the expanded wrapper | `src/lib/expandLayout.ts`, `Canvas.tsx` |
| Drag expanded children and the whole expanded box; positions are remembered | `src/lib/sidecar.ts` |

---

## 4. Styling & color

| Capability | Where |
|---|---|
| Color and style elements **by tag only** (no direct per-element/per-edge color): background, text color, shape, border, opacity, font size | `TagManagerDialog.tsx`, `FloatingBottomStrip.tsx` |
| Color picker: type a hex or named color, or pick a preset swatch, or clear it (no spectrum/wheel/eyedropper) | `tagStyleControls.tsx` |
| Choose from 12 canvas color themes | `CanvasSettingsDialog.tsx` |
| Pick element shapes (Box, Cylinder, Person, Hexagon, and more) | `tagStyleConstants.ts` |
| Relationship line appearance follows interaction style (sync solid / async dashed) | `RightPanel.tsx`, `edges/RelationshipEdge.tsx` |

---

## 5. Editing — the inspector

| Capability | Where |
|---|---|
| Edit an element: name, location, status, owner, URL, technology, description, tags | `RightPanel.tsx` |
| See an element's incoming/outgoing relationships | `RightPanel.tsx` (Relations tab) |
| Edit a relationship: description, technology, interaction style, line style (curved/straight/orthogonal), URL, tags | `RightPanel.tsx` |
| Edit a group: name and members | `right-panel/GroupProperties.tsx` |
| Create relationships by dragging from one node to another; reconnect endpoints | `relationship-slice.ts` |

---

## 6. Canvas & interaction

| Capability | Where |
|---|---|
| Add elements (quick-add by type, or pull existing-but-hidden elements in) | `AddElementPanel.tsx` |
| Auto-arrange layout; choose direction (top-bottom / bottom-top / left-right / right-left) | `FloatingToolRail.tsx` |
| Zoom in/out, zoom to fit, pan, minimap (always / auto / never) | `FloatingZoomHud.tsx`, `CanvasSettingsDialog.tsx` |
| Snap nodes to a 32px grid | `Canvas.tsx`, `CanvasSettingsDialog.tsx` |
| Multi-select and batch align / distribute / group / delete / duplicate | `MultiSelectBar.tsx` |
| Presentation mode (full-screen, chrome hidden) | `commands.ts` |
| Onboarding canvas guide | `CanvasGuide.tsx` |

---

## 7. Finding things & commands

| Capability | Where |
|---|---|
| Search elements and views (with type/tag filters) | `SearchDialog.tsx` |
| Command palette — every action, with shortcuts shown | `CommandPalette.tsx`, `src/lib/commands.ts` |
| Keyboard shortcuts for create / edit / view / navigation / file actions | `src/hooks/useKeyboardShortcuts.ts` |
| Highlight subgraphs by Tag / Status / Technology / Team (stacking filters, dim non-matches) | `BottomHighlighterBar.tsx`, `src/lib/highlight.ts` |

---

## 8. Files & export

| Capability | Where |
|---|---|
| Edit visually, save as Structurizr DSL (round-trips cleanly) | `src/lib/dsl/`, `workspaceDocument.ts` |
| Open a folder of `.dsl` files and pick a workspace (Chromium); single-file mode elsewhere | `folderIO.ts`, `fileIO.ts` |
| Remembers recent folders/files; auto-save and crash recovery | `fileIO.ts`, `useAutoSave` hook |
| Export the current view as PNG (dark/light) or SVG; export/copy DSL | `ExportDialog.tsx` |
| Layout, positions, and expand state saved alongside the `.dsl` in a sidecar file | `src/lib/sidecar.ts` |
