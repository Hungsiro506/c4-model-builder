import type { WorkspaceStore } from './types'
import { LocalFileStore } from './localFileStore'
import { LocalFolderStore } from './localFolderStore'

export type { WorkspaceStore, WorkspaceRef, StoredWorkspace, SaveRequest } from './types'
export { LocalFileStore } from './localFileStore'
export { LocalFolderStore } from './localFolderStore'

/** Supported adapter identifiers — maps to the `WorkspaceStore.id` values. */
export type WorkspaceStoreId = WorkspaceStore['id']

/** Create a new adapter instance by its discriminator. "remote" is reserved for
 *  the cloud-storage tier (not yet implemented — see the TODO in types.ts). */
export function createWorkspaceStore(id: WorkspaceStoreId): WorkspaceStore {
  switch (id) {
    case 'local-file':
      return new LocalFileStore()
    case 'local-folder':
      return new LocalFolderStore()
    default:
      throw new Error(`Unknown WorkspaceStore id: ${id}`)
  }
}

// ─── Active-store singleton ────────────────────────────────────────────────
//
// A single, mutable reference to the current adapter. In a full DI setup this
// would live in a context or container, but for a browser-only zustand app a
// module-level singleton is simple, testable, and avoids threading a prop
// through 15 components.

let _active: WorkspaceStore = createWorkspaceStore('local-file')

/** The currently-active storage adapter. Defaults to `LocalFileStore` (local-file
 *  is the free tier). Callers read this to save/load/open workspaces. */
export function getActiveStore(): WorkspaceStore {
  return _active
}

/** Swap the active adapter at runtime (e.g. switching from file → folder mode,
 *  or from local → cloud tier in the future). Tests use this to isolate. */
export function replaceActiveStore(store: WorkspaceStore): void {
  _active = store
}
