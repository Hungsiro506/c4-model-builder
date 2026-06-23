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

- `docs/SCALING-DESIGN.md` — the vision + 4-pillar roadmap. Pillars 1 (expand-in-place
  L2→L3) and 2 (storage seam) shipped. Pillars 3–4 + L4 code zoom + DB table view are
  design-phase.
- `docs/CAPABILITIES.md` — functional inventory of what's built.
- `docs/movable-edges-plan.md` — **parked feature:** drag-to-bend edges (Excalidraw-style).
  Read BEFORE touching edge interaction code. Captures 4 failed approaches.

## Project Rules

Hard-won from building the shipped features. Every AI session must follow them.

### Verify Discipline

1. After every change run the full suite: `npm test` (not just the targeted file) +
   `npm run typecheck` + `npm run lint`.
2. When touching canvas/shared UI components, also run `npm run test:e2e`.
3. Never edit a passing existing test just to make it green — only update it when the
   functionality genuinely changed, and say why.

### TDD (Test-Driven Development)

- Write the failing test first (E2E or unit). Watch it go red for the right reason.
- Then write the code to green. NOT "minimal code" — write clean, extensible, maintainable
  code so bugs are easy to fix later.
- E2E: Playwright specs under `e2e/<feature>/`. Harness: `e2e/fixtures/workspace.ts`.
  Dev server auto-starts via playwright.config.
- If unsure a spec actually bites, break the code on purpose, see the test fail, revert.

### Branching & Commits

- **Feature branches off `main`** — one per feature, independent, disjoint files.
  Merge in any order, no conflicts. `integration` is a local preview only (never merge it).
- **Squash-merge + Conventional Commit PR titles** (`feat:`, `fix:`, `ci:`, `docs:`,
  `feat!:`). The release workflow reads these for the version bump + changelog.
- Commit checkpoints — each stage is its own commit for easy rollback.

### Design & Documentation

- Discuss before coding on any non-trivial change. Lock the design first, then build.
- Every feature gets a doc in `docs/` (Problem → Decisions → Why → Tests → Open items →
  Progress log). Model on `docs/expand-in-place-plan.md`. See `docs/changestate.md`,
  `docs/inline-edge-label.md`, `docs/storage-seam.md`.
