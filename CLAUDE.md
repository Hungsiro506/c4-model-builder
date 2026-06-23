AGENTS.md

# Project Rules

These are hard-won from building changeState, inline-edge, storage-seam, and
e2e-flakes. Every AI session must follow them.

## Verify Discipline

1. **After every change run the full suite**: `npm test` (all ~1185 unit tests, not
   just the targeted file) + `npm run typecheck` + `npm run lint`.
2. **When touching canvas/shared UI components, also run `npm run test:e2e`.**
3. **Run commands with `rtk` prefix** — the PreToolUse hook auto-wires it, but explicit
   `rtk` in your tool calls ensures the filter runs. Node/npm must be on PATH (install
   via your OS package manager if missing).
4. Never edit a passing existing test just to make it green — only update it when the
   functionality genuinely changed, and say why.

## TDD (Test-Driven Development)

- Write the failing test first (E2E or unit). Watch it go red for the right reason.
- Then write the code to green. NOT "minimal code" — write clean, extensible,
  maintainable code so bugs are easy to fix later.
- For E2E: Playwright specs under `e2e/<feature>/`. Helper: `e2e/fixtures/workspace.ts`
  (`WorkspaceHelper` class). Dev server auto-starts via playwright.config.
- If unsure a spec actually bites, break the code on purpose, see the test fail, revert.

## Branching & Commits

- **Feature branches off `main`** — one per feature, independent, disjoint files.
  Merge in any order, no conflicts. `integration` branch is a local preview only
  (merge all features together; never merge it to main).
- **Squash-merge + Conventional Commit PR titles** (`feat:`, `fix:`, `ci:`, `docs:`,
  `feat!:`). The release workflow reads these for the version bump + changelog.
- **Commit checkpoints** — each stage is its own commit for easy rollback.

## Design & Documentation

- **Discuss before coding** on any non-trivial change. Lock the design first,
  then build.
- **Every feature gets a doc** in `docs/` (Problem → Decisions → Why → Tests →
  Open items → Progress log). Model on `docs/expand-in-place-plan.md`.
  See `docs/changestate.md`, `docs/inline-edge-label.md`, `docs/storage-seam.md`.
- **Reference docs**: `docs/SCALING-DESIGN.md` (the vision + pillars roadmap),
  `docs/CAPABILITIES.md` (what's built). Read these first when planning work.

## Key Files

| Layer | Files |
|---|---|
| Store | `src/store/workspace-types.ts`, `src/store/workspace.ts`, `src/store/slices/` |
| Model types | `src/types/model.ts` |
| Canvas builders | `src/components/canvas/canvasBuilders.ts` |
| Canvas + edges | `src/components/canvas/Canvas.tsx`, `src/components/canvas/edges/RelationshipEdge.tsx` |
| Right panel | `src/components/layout/RightPanel.tsx` |
| Add-element panel | `src/components/layout/AddElementPanel.tsx` |
| Tag manager | `src/components/layout/highlighter/TagManagerDialog.tsx` |
| DSL parser/serializer | `src/lib/dsl/` |
| Storage (Pillar 2) | `src/lib/storage/` |
| Commands (Ctrl+S etc) | `src/lib/commands.ts` |
| E2E fixture | `e2e/fixtures/workspace.ts` |
<!-- /project-rules -->