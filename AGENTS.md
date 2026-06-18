# AGENTS.md

Onboarding map for AI coding agents (Claude Code, Cursor, etc.). `CLAUDE.md` is a
symlink to this file. Keep it short and accurate — over-long or stale context causes
hallucination.

## What this is

c4hero — a local-first visual editor for C4 architecture diagrams. Edit visually, save as
**Structurizr DSL**. Pure frontend, no backend, no signup. Apache-2.0.

**Core invariant — DSL purity:** the `.dsl` file stays pure, round-trippable Structurizr.
All non-DSL metadata (node positions, layout direction, viewport, expand state) rides in a
sidecar `<workspace>.c4hero.json`. Never put non-Structurizr data in the `.dsl`.

## Stack

React 19 + TypeScript + Vite 8. Tailwind 4. State: zustand + immer (sliced store).
Canvas: React Flow (`@xyflow/react`). Auto-layout: dagre (`@dagrejs/dagre`).
Tests: Vitest (unit) + Playwright (E2E). Node >=22, npm >=10.

## Architecture (rendering pipeline)

```
DSL → parse → Workspace model → dagre auto-layout → React Flow render
```

Deterministic, no AI/ML. Manual node positions override dagre and persist in the sidecar.

## Key files / seams

- `src/lib/dsl/` — DSL parser + serializer (`parser.ts`, `serializer.ts`, `parser-views.ts`,
  `parser-styles.ts`, `parser-relationship.ts`, `parser-model.ts`). Heavy round-trip tests here.
- `src/types/model.ts` — the `Workspace` model (people, software systems → containers →
  components, relationships, views, styles).
- `src/lib/workspaceDocument.ts` — `parseWorkspaceDocument({content, sidecarJson})`, the
  codec choke point (DSL string + sidecar JSON in, Workspace out).
- `src/lib/canvasLayout.ts` — dagre layout.
- `src/components/canvas/canvasBuilders.ts` — builds React Flow nodes/edges from the model;
  applies tag styles (`getElementStyle`, relationship styles at the edge builder).
- `src/store/slices/` — zustand slices (navigation, element, relationship, view, undo, etc.).
- `src/lib/fileIO.ts` — File System Access API transport (single file). `folderIO.ts` =
  folder collections (Chromium only; Firefox/Safari fall back to single-file).
- `src/lib/impliedRelationships.ts` — computes implied (parent-level) relationships.

## Commands

- `npm run dev` — dev server, http://localhost:3004 (strictPort)
- `npm test` — Vitest unit/integration
- `npm run test:e2e` — Playwright E2E (auto-starts dev server; needs `npx playwright install chromium` once)
- `npm run check` — lint + typecheck + test + build (the full gate)

## Conventions

- Styling/coloring is done via Structurizr tags + `styles { ... }`, parsed in
  `parser-styles.ts`. Tag an element/relationship, add a style for that tag → colored.
- Tests: prefer DSL round-trip tests for parser/serializer changes; Playwright E2E for
  canvas/interaction behavior. E2E harness: `e2e/fixtures/workspace.ts`.
- Test hooks are exposed on `window` (e.g. `__testParseAndLoad`, `__testGetWorkspace`).

## Active work

- `docs/expand-in-place-plan.md` — semantic-zoom / expand-in-place feature (in progress).
