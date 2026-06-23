/** A handle to a workspace: enough for the adapter to load it again later.
 *  `id` is the adapter's internal key (file path, file-handle token, cloud
 *  file ID, etc.); `name` is a human-facing label (filename, workspace title).
 *  `version` is optional — cheap future-proofing for server-side optimistic
 *  concurrency. File-based adapters ignore it. */
export interface WorkspaceRef {
  id: string
  name: string
  version?: string
}

/** A workspace loaded from storage, ready to hand to the parser.
 *  `content` is the raw DSL (Structurizr plain-text).
 *  `sidecarJson` is the optional `.c4hero.json` sidecar in the same directory.
 *  `ref` is a handle to reload / overwrite this workspace later. */
export interface StoredWorkspace {
  content: string
  sidecarJson?: string
  ref: WorkspaceRef
}

/** A workspace the user wants to persist. `content` is always required.
 *  When `ref` is present the adapter should overwrite that version; when absent
 *  it should save to a new location (e.g. Save-As / first-time picker).
 *  `sidecarJson` is optional — not all workspaces have sidecar data.
 *  `suggestedName` is a hint for the save dialog (filename without path). */
export interface SaveRequest {
  content: string
  sidecarJson?: string
  ref?: WorkspaceRef
  suggestedName?: string
}

/** Abstraction over where workspace bytes live. Implementations: LocalFileStore
 *  (browser File System Access API), LocalFolderStore, future RemoteStore
 *  (HTTP API for cloud-workspace SaaS). Every adapter reads/writes the same
 *  `.dsl` bytes — same parser, same serializer. Only the transport differs. */
export interface WorkspaceStore {
  /** Discriminator — the factory picks by this, the UI can branch on it. */
  readonly id: 'local-file' | 'local-folder' | 'remote'

  /** What the adapter can do — the UI reads this instead of checking for the
   *  specific File System Access API. A local-file adapter has all three; a
   *  remote backend may not support an OS "browse" but does persist + list. */
  readonly capabilities: {
    browse: boolean       // can open a file-system / workspace picker
    interactivePick: boolean // can show a native picker (dialog)
    persist: boolean      // can save back (false for read-only viewers)
  }

  /** Enumerate known workspaces. Returns [] when the adapter doesn't have a
   *  listable catalog (e.g. a single-file store with no recents). */
  list(): Promise<WorkspaceRef[]>

  /** Open a workspace from a user-facing picker (OS file dialog, workspace
   *  browser, etc.). Returns null when the user cancels the picker. The
   *  returned `ref` can be used to `save()` back to the same location. */
  open(): Promise<StoredWorkspace | null>

  /** Load a workspace by its reference — no picker, no prompt. Used for
   *  re-opening from recents or from the `ref` returned by a previous `open`. */
  load(ref: WorkspaceRef): Promise<StoredWorkspace>

  /** Persist a workspace. When `req.ref` is present the adapter overwrites that
   *  location; when absent it should prompt for a new location (Save-As / OS
   *  file picker for the first save). Returns the new/updated ref + ok flag. */
  save(req: SaveRequest): Promise<{ ref: WorkspaceRef; ok: boolean }>
}

// ─── TODO (cloud-storage / mini-SaaS) ────────────────────────────────────────
// When scaling from local-first to a cloud tier, implement a RemoteStore
// adapter that talks to a lightweight backend metadata service:
//
//   RemoteStore implements WorkspaceStore {
//     id: 'remote',
//     capabilities: { browse: false, interactivePick: false, persist: true },
//     list():   GET /workspaces → WorkspaceRef[]
//     open():   <browser-side workspace picker, then…> load(ref)
//     load(r):  GET /workspaces/:id/file → StoredWorkspace
//     save(r):  PUT /workspaces/:id/file → { ref, ok }
//   }
//
// The backend is a thin metadata layer (user accounts, workspace listing,
// sharing, permissions) — the actual `.dsl` + `.c4hero.json` bytes live in
// cloud object storage (S3 / R2 / etc.), same format, no DB model. The file
// stays the single source of truth; the backend just indexes it.
//
// LocalFileStore stays the default (free tier, no signup, files on your
// device). RemoteStore is the opt-in SaaS tier. Both are wired through the
// factory (`src/lib/storage/index.ts`), and neither changes the parser or
// serializer — the `.dsl` remains pure, round-trippable Structurizr.
