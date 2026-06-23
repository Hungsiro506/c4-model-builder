AGENTS.md

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

# Project Rules

These are hard-won from building changeState, inline-edge, storage-seam, and
e2e-flakes. Every AI session must follow them.

## Verify Discipline

1. **After every change run the full suite**: `npm test` (all ~1185 unit tests, not
   just the targeted file) + `npm run typecheck` + `npm run lint`.
2. **When touching canvas/shared UI components, also run `npm run test:e2e`.**
3. **Run commands with node on PATH**: prepend
   `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` in every PowerShell call.
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