# Pluggable storage (WorkspaceStore) — feature doc

Context doc for AI-assisted development. Records what was built and **why**.

## Problem

c4hero reads/writes workspaces through direct browser API calls (`fileIO.ts`'s `openDSLFile`, `saveDSLFile`, `writeSidecarToHandle`) scattered across several components. The module-global file handles couple the UI to the browser File System Access API, so swapping storage (folder mode, a future cloud tier) means rewriting call sites — not just the transport.

Goal: one `WorkspaceStore` interface that abstracts *where workspace bytes live*. File today, folder, cloud later — the rest of the app doesn't know or care.

## Scope (locked)

- **Build:** `WorkspaceStore` interface + two adapters (`LocalFileStore`, `LocalFolderStore`) + factory + rewire of the primary open/save call sites.
- **Keep untouched:** crash recovery (`saveToLocalStorage`/`loadFromLocalStorage`), recents (`getRecentFiles`/`addRecentFile`), and the auto-save file-handle path (`useAutoSave`'s `writeToCurrentHandle`) are separate services — not in the interface.
- **No behaviour change.** Same inputs/outputs, same format, tests stay green. Pure refactor.

## Key decisions (and why)

- **Interface at the *bytes* layer, not the *meaning* layer.** Every adapter reads/writes the same `.dsl` content string. Same parser, same serializer. Only transport differs. Why: the through-line constraint — the `.dsl` must stay pure, round-trippable Structurizr; the interface just changes where those bytes live.
- **`capabilities` object replaces `hasFileSystemAccess()` checks.** The UI asks the adapter what it can do (`browse`, `interactivePick`, `persist`) instead of probing the browser. Why: a remote/cloud adapter doesn't have a file picker but still reads/writes. The UI adapts.
- **Singleton active store.** Module-level `getActiveStore()`/`replaceActiveStore()` instead of threading a prop through 15 components. Why: the app is zustand-based, no DI container; singleton is simple, testable (`replaceActiveStore` for test isolation), and hides the transport switch from leaf components.
- **File mode is the default; cloud is opt-in.** `LocalFileStore` is the free tier (no signup, files on device). A future `RemoteStore` adds a SaaS tier — same contract, same DSL format, no migration.
- **Rewire is targeted.** Only the primary open/save call sites (`WelcomeScreen.handleOpenFile`, `commands.ts` Ctrl+S save) were swapped. Auto-save (file-handle internals), crash recovery (localStorage), and recents are separate services — left as-is.

## Key files

- `src/lib/storage/types.ts` — `WorkspaceStore`, `WorkspaceRef`, `StoredWorkspace`, `SaveRequest` + cloud-extension TODO.
- `src/lib/storage/localFileStore.ts` — wraps `fileIO.ts` behind the interface.
- `src/lib/storage/localFolderStore.ts` — wraps `folderIO.ts` behind the interface.
- `src/lib/storage/index.ts` — factory + singleton.

## Tests

- Unit (28): types contract (8), LocalFileStore delegation (10), LocalFolderStore delegation (10), factory + singleton (5). All mock-based.
- Full suite: 1185 unit + 203 E2E green, lint clean. No regressions.

## Open items

- **Cloud/remote adapter** — `RemoteStore` implementing `WorkspaceStore` for an HTTP-backed cloud tier. Documented as a TODO in `types.ts`. The adapter already supports `id: 'remote'`; the factory throws for it until implemented.
- **IndexedDB handle persistence** — `LocalFileStore.load()` currently delegates to a fresh file picker (no persistent `FileSystemFileHandle` across sessions). IndexedDB-based re-prompt-permission can replace this without changing callers — same interface.
- **Auto-save abstraction** — `useAutoSave.ts` still writes via fileIO's internal handles directly. Abstracting it under the interface would need incremental-copy or dirty-flag integration; not needed for the current transport.

## Progress log

### 2026-06-22 — stages 1–6 shipped (branch `feat/storage-seam`, PR #10)

- Interface types + tests (stage 1).
- `LocalFileStore` wrapping fileIO (stage 2).
- `LocalFolderStore` wrapping folderIO (stage 3).
- Factory + singleton (stage 4).
- Rewired `WelcomeScreen.handleOpenFile` and `commands.ts` Ctrl+S save (stage 5).
- Feature doc (stage 6).
- Pure refactor under green — full suite stayed at 1185/1185 unit + 203 E2E.
