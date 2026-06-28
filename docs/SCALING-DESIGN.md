# c4hero Scaling Design

> Status: **Active development** (last updated 2026-06-22). Pillars 1 (expand-in-place)
> and 2 (storage seam) are shipped. Pillars 3–4 are design-phase. New UX improvements
> are being scoped in §10 (Canvas & Edge UX).
>
> This document captures the vision, the decisions, and — most importantly — *why* we
> made them, so the work can be picked up and extended later.
>
> **Design references:** [Excalidraw](https://excalidraw.com) (inline edge editing,
> free-form rectangle, movable edges, per-element interaction model),
> [Structurizr](https://structurizr.com) (DSL round-trip, C4 notation, tag-based
> styling), [Mermaid](https://mermaid.js.org) (diagram-as-code for future sequence
> views), [TOGAF / ArchiMate](https://pubs.opengroup.org/architecture/archimate2-doc/chap11.html)
> (gap-analysis vocabulary for change-state).

---

## 1. The vision

c4hero today is a local-first visual editor for the C4 model that saves plain Structurizr
DSL. The goal is to scale it from a *diagram editor* into an *architecture-intelligence
platform* — something that not only lets you draw architecture, but reads your codebase and
runtime to keep the picture true.

Four pillars make up that scale-up. Each is designed to be **interface-driven** so it can
grow or swap implementations independently:

1. **Expand-in-place zoom** — drill into the architecture on one canvas without losing context.
2. **Pluggable storage** — read/write workspaces from files now, an API later, with no rewrite.
3. **Code-from-source generation** — point at a repo, get C4 + code-level diagrams.
4. **Dynamic / sequence views** — click a flow, see how it actually works step by step.

## 2. The through-line constraint (read this first)

**The on-disk `.dsl` must stay pure, round-trippable Structurizr DSL.**

Everything that is *not* standard Structurizr (expand/collapse state, code maps, generated
graphs) rides in the **sidecar JSON** (`<workspace>.c4hero.json`) or in separate
artifacts/providers — it is **never** hacked into the DSL.

**Why this matters:** c4hero's entire differentiator is *"your architecture lives in your
repo as portable plain-text Structurizr, no vendor lock-in."* The `.dsl` opens in
Structurizr Lite/Studio and every other tool in that ecosystem. If we break round-trip to
shove in proprietary data, we lose the one thing that makes c4hero worth choosing. So:

- Sidecar / artifacts / providers for anything proprietary.
- Only extend the DSL parser/serializer for things that are *genuinely standard Structurizr*
  (e.g. adding `dynamic` view support is fine — it's in the spec).

---

## 3. Pillar 1 — Expand-in-place zoom ⚡ *partially built — L2→L3 done, L4 (code) + DB table view pending*

### What
The app starts at the context diagram. Clicking one system expands it **in place** into its
containers (inside a boundary); every other system stays a box in the same spot. It recurses:
system → container → component → code. Multiple can be open; all can collapse back.

This is **semantic zoom on one shared canvas**, deliberately *not* C4's "separate diagram per
level."

### Why
The current behaviour (`drillInto` in `src/store/slices/navigation-slice.ts`) swaps the entire
view and discards the higher level, which is disorienting. Keeping the surrounding context
visible while zooming is the whole point of the request.

### Design
- **`lib/hierarchy.ts` (new):** `buildHierarchy(workspace, providers)` → `{ nodeById,
  parentOf, childrenOf }`. The `parentOf` map already half-exists in
  `lib/impliedRelationships.ts` — extract and share it. Pure, no React, fully testable.
- **`visibleAncestor(id, expandedSet, parentOf)`:** the load-bearing rule. Walk the root→id
  chain, descend while ancestors are expanded, return the deepest visible node.
- **Edge resolver — "nearest visible ancestor":** for every model relationship `a → b`, draw
  an edge between `visibleAncestor(a)` and `visibleAncestor(b)`; drop self-pairs; dedupe
  keeping the finest-grained. This auto-retargets edges as systems expand (e.g. `User → EDCA`
  becomes `User → WebApp` once EDCA opens). It works because the model stores real
  relationships at every level plus computed implied ones.
- **`buildCompositeView(workspace, baseView, expandedSet)`:** recursive; swaps box →
  boundary+children for each expanded id; outputs a synthetic `{ elements, relationships }`
  fed to the existing builders in `components/canvas/canvasBuilders.ts`. Level-agnostic, so
  code is just depth 4.
- **State:** `expandedElementIds: Set<string>` per view, stored in the **sidecar**, added to
  `store/slices/ui-slice.ts` and `lib/sidecar.ts`.
- **Layout = strategy interface.** v1 naive grid (as in the mockup); v2 dagre-per-boundary.
  Deep + multi-expand getting cramped is the known hard problem.

### Build order
1. `hierarchy.ts` + `visibleAncestor` + tests.
2. Edge resolver + tests.
3. `buildCompositeView` + wire into the canvas.
4. Expand/collapse UI + sidecar persistence.
5. Code level via a `CodeProvider`.

Steps 1–4 are shipped. **Step 5 (code level) is deferred** — requires a
`CodeProvider` from Pillar 3 (code-from-source generation). Also deferred:
- **Database table view** — expand a Database container to show its table
  schema inline (similar to code level but schema-first). Needs a
  `DatabaseProvider` that reads table definitions from the model or from
  an external schema source.
- **L4 Code zoom** — expand a Component to show its code-level diagram
  (classes, functions, files). This is Pillar 1 step 5 + Pillar 3 combined.

---

## 4. Pillar 2 — Pluggable storage (`WorkspaceStore`) ✅ *built*

### What
One interface that abstracts *where workspace bytes live*. File-system today, an HTTP API
later, with no change to the parser, serializer, or store.

### Why
Storage only ever moves two strings + metadata: `content` (the raw `.dsl`) and `sidecarJson`.
The codec choke point already exists (`lib/workspaceDocument.ts` →
`parseWorkspaceDocument`). What blocks swapping is that `lib/fileIO.ts` uses stateful module
globals and that `lifecycle-slice.ts` / `commands.ts` call it directly. Hiding transport
behind an interface removes that coupling so a backend can slot in later **without a rewrite**.

> Decision (2026-06-16): we are **not** building a backend yet — only the seam. Local-first
> stays the default tier; any future backend is an opt-in addition, not a replacement. This
> protects the "no signup, files stay on your device" promise.

### Design (`lib/storage/types.ts`)
```ts
interface WorkspaceRef   { id: string; name: string; version?: string }
interface StoredWorkspace { content: string; sidecarJson?: string; ref: WorkspaceRef }
interface SaveRequest     { content: string; sidecarJson?: string; ref?: WorkspaceRef; suggestedName?: string }

interface WorkspaceStore {
  readonly id: 'local-file' | 'local-folder' | 'remote'
  readonly capabilities: { browse: boolean; interactivePick: boolean; persist: boolean }
  list(): Promise<WorkspaceRef[]>           // [] when !browse
  open(): Promise<StoredWorkspace | null>   // OS picker; null if cancelled
  load(ref: WorkspaceRef): Promise<StoredWorkspace>
  save(req: SaveRequest): Promise<{ ref: WorkspaceRef; ok: boolean }>
}
```
- Keep `version` now — cheap future-proofing for API optimistic concurrency; files ignore it.
- `capabilities` generalises today's `hasFileSystemAccess()` branching — UI asks the adapter.
- `list()` serves folder collections now and a future "my workspaces" API list.
- Module-global file handles become **private instance state** inside `LocalFileStore`.

### Refactor plan (pure refactor, tests stay green)
1. `lib/storage/types.ts`.
2. `LocalFileStore` wrapping existing `fileIO`.
3. `LocalFolderStore` wrapping `folderIO` (do file first, prove the seam, then folder).
4. `lib/storage/index.ts` factory picks the adapter by capability.
5. Rewire `lifecycle-slice` + `commands.ts` `save` to call `activeStore.save(...)`.
6. Leave recents + crash-recovery as separate services for now.

This is the recommended **first** build: smallest, lowest risk, unblocks the rest.

---

## 5. Pillar 3 — Code-from-source generation

### What
Read a codebase → generate the C4 model and a code-level (C4 L4) graph.

### Why / the two problems raised
- **Language diversity** and **monorepo scale** (a monorepo can be enormous).
- Source loading must be flexible — GitHub, a folder path, a zip, anything.

### Design — two orthogonal interfaces
- **`SourceProvider`** — codebase as a lazy virtual filesystem: `list(glob?):
  AsyncIterable<SourceFile>` (streaming, not load-all), `read(path)`, `stat(path)`,
  `capabilities`. Implementations: `LocalFolderSource` (File System Access / node fs),
  `GitHubSource` (contents API or tarball, sparse — no full clone), `GitCloneSource`,
  `ZipSource`.
- **`LanguageAnalyzer`** — per-language plugin, matched by extension/detection:
  `matches(file)`, `analyze(files, ctx) → PartialGraph`. TS via ts-morph, Go via go/packages,
  Python via ast. A polyglot monorepo just runs several analyzers over one tree.

Pipeline: `SourceProvider → discovery (manifests + languages) → analyzer registry → partial
graphs → merge/aggregate → CodeGraph artifact (cached) → CodeProvider` (the same consumer the
zoom feature uses for the code level).

### Handling monorepo scale — never brute-force the whole repo
1. **Scope-by-binding** — each component carries `properties.sourcePath` (round-trips in DSL);
   analyse only mapped subtrees.
2. **Lazy / on-expand** — generate a component's code graph when the user expands it. The
   expand-in-place model makes this natural.
3. **Manifest-driven discovery** — read `package.json` workspaces / `go.mod` /
   `pnpm-workspace` / nx/turbo / Bazel; packages become natural container/component
   candidates. (Bonus feature: point at a monorepo → auto-seed the C4 model.)
4. **Content-hash incremental cache** — re-analyse only changed files.
5. **Aggregate aggressively** — file-level nodes by default, expand-to-symbol on demand.
6. **Parallel per package, bounded concurrency.**

### Where it runs
Small/single repo → client-side via `LocalFolderSource`. Large monorepo → off-browser CLI
(`npx c4hero-codegen`) or backend worker. `SourceProvider` hides local-fs vs remote, so the
same pipeline runs in both.

### Honest limits
Static call graphs are approximate — they miss dynamic dispatch, reflection, DI, and runtime
wiring. Label the output "static structure," not ground truth. Keep code level **generated,
not hand-drawn**: it matches C4's intent for L4 and avoids the DSL-portability problem (the
artifact is separate from the `.dsl`).

---

## 6. Pillar 4 — Dynamic / sequence views

### What
Click a flow/relationship on the canvas → a sequence diagram pops up showing the internal
workflow (e.g. "create data" → call DB, publish to Kafka, in order).

### Why this is well-grounded
This is the **C4 dynamic view** — the 5th diagram type — which is ordered, numbered
interactions, i.e. a sequence/collaboration diagram. Structurizr supports `dynamic { ... }`
views with ordered relationships, so the data is **portable and round-trippable** and stays
inside our through-line constraint.

> Caveat: c4hero does not model dynamic views yet (the parser/serializer only handle
> systemLandscape / systemContext / container / component). Adding `dynamic` means parser +
> serializer + a new renderer — but no portability cost, because it's standard Structurizr.

### Mechanic
Bind a relationship (or element) to a dynamic view; clicking the edge opens that view rendered
as a sequence diagram (lifelines = C4 elements, ordered messages = relationships).

### Two genuinely hard parts
1. **Rendering.** Sequence layout (lifelines + vertical time axis) is not a box-and-line
   graph. React Flow is graph-oriented; a sequence view wants a dedicated SVG/layout engine.
   This is the one truly new render engine in the whole roadmap.
2. **Where the steps come from — a fidelity ladder:**
   - **Authored** — user writes the dynamic view. Standard, accurate, manual. Cheapest.
   - **Static-generated** — derived from the code graph (Pillar 3). Approximate; misses
     async/order/branches.
   - **Trace-generated (the moat)** — import OpenTelemetry / Jaeger traces. Real runtime
     sequences (actual DB calls, Kafka publishes, in real order) mapped onto C4 elements via
     `service.name → element`. Static analysis cannot reliably give ordering or async — traces
     give truth.

### Why trace import is strategic
No competitor (Structurizr, diagrams.net) renders runtime behaviour mapped to C4. This is the
deepest differentiator — and the deepest scope (new view type + new renderer + trace
ingestion).

Architecturally it fits the same pattern: a `SequenceProvider` (authored | static | traces)
mirrors the `CodeProvider` plug-in.

---

## 7. Strategic tension (acknowledged, not resolved)

Pillars 3 and 4 move c4hero from "static architecture pictures" toward "living architecture
from your actual system." That is a different product, with a different moat **and a higher
trust/privacy bar** — reading customer source code and runtime traces is a much bigger ask
than editing a local `.dsl`. We have not decided how far to walk that line.

## 8. Open decisions (none locked)

- Build order across the four pillars.
- Code-level storage: sidecar vs DSL `properties` vs generated-only.
- Sequence-view fidelity to start with: authored vs trace-driven.
- Backend: opt-in tier vs a larger pivot.

## 9. Current architecture (for orientation)

Rendering is deterministic, no AI/ML:
`DSL → parse (lib/dsl/parser.ts) → Workspace model (src/types/model.ts) → dagre layout
(lib/canvasLayout.ts) → React Flow render (components/canvas/canvasBuilders.ts)`. Manual node
positions override dagre and persist in the sidecar. The app is a pure frontend static app
with no backend today. Local dev requires Node ≥ 22; dev server runs on
`http://localhost:3004`.

---

## 10. Canvas & Edge UX (minor improvements)

Small, high-impact UX features that don't change the architecture. Each is
independent, built off `main`, and scoped for a single small PR.

### Movable edges (drag midpoint to bend)

**What:** hover an edge → a midpoint handle appears → drag to bend the bezier
curve (Excalidraw-style). Endpoints stay fixed at their nodes. React Flow ships
this natively (`edgeUpdaterRadius`); we just enable it.

**Scope:** one config addition + an E2E spec. The reconnect-endpoint gesture
(already working) is separate and stays unchanged.

### Arrange selected only

**What:** auto-arrange today applies to the whole view. Extend it to a selected
subset: select N nodes, run "auto-arrange," and only those nodes are re-laid-out
(their non-selected siblings stay put).

**Scope:** extend the existing dagre layout call to accept a node-id subset.
Small change to `lib/canvasLayout.ts` + the toolbar/command-palette action.

### Free-form rectangle (draw a wrapper, then assign)

**What:** the user draws a rectangle on the canvas (Excalidraw frame / Figma
auto-layout frame), then assigns elements to it — the wrapper box stays drawn
around them. Different from the existing Group feature (which selects elements
first): draw-first, assign-later.

**Note:** Groups and boundaries already exist in the model (`Group` +
`BoundaryNode`). This is a creation-UX variant, not a new data model. The
existing group/boundary primitives are reused.

**Scope:** a draw tool on the canvas + group-creation from the drawn rect.

### Per-element / per-edge color picker

**What:** pick a colour directly on a particular element or edge, without going
through the tag manager.

**⚠️ Design tension.** The current architecture colours everything **by tag**
(tags carry styles; elements inherit via the tag cascade in `getElementStyle`).
Per-element colour breaks that model. A middle ground: "create an auto-private
tag for this element" under the hood — the element gets a unique tag, and the
colour rides the existing cascade. This keeps the architecture unchanged while
exposing a simple per-element picker.

**Status:** not scoped for build yet. Needs a dedicated design doc to resolve
the tag-only vs per-element tension.

---

## 11. Progress log

### 2026-06-22

- **Pillar 2 (storage seam) shipped** — `WorkspaceStore` interface + `LocalFileStore` +
  `LocalFolderStore` + factory + rewire. Local-first default; cloud extension
  documented as a TODO in `src/lib/storage/types.ts`. PR #10.
- **Canvas & edge UX scoped** — movable edges, arrange selected, free-form rectangle,
  per-element color (design-discussion deferred). Added as §10.
