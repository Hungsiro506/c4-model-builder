import type { WorkspaceStore, WorkspaceRef, StoredWorkspace, SaveRequest } from './types'
import {
  openDSLFile,
  saveDSLFile,
  writeSidecarToHandle,
} from '@/lib/fileIO'

/** File System Access API adapter (browser local-only).
 *
 *  Wraps the existing `fileIO.ts` primitives behind the `WorkspaceStore`
 *  contract so callers never talk to the browser API directly. Every call
 *  delegates to the current fileIO implementation — same behaviour, behind
 *  the interface.
 *
 *  Thread-safety note: fileIO state (currentFileHandle, currentSidecarHandle)
 *  is module-global and NOT scoped to this instance. Single-instance only
 *  (the factory in `index.ts` creates one). */
export class LocalFileStore implements WorkspaceStore {
  readonly id = 'local-file' as const
  readonly capabilities = { browse: true, interactivePick: true, persist: true }

  /** Single-file store has no listable catalog (recents live alongside,
   *  not inside the adapter — see `fileIO.ts::getRecentFiles`). */
  async list(): Promise<WorkspaceRef[]> {
    return []
  }

  /** Open a workspace via the browser file picker (or a fallback
   *  `<input type=file>` when the File System Access API isn't available). */
  async open(): Promise<StoredWorkspace | null> {
    const file = await openDSLFile()
    if (!file?.content) return null
    return {
      content: file.content,
      sidecarJson: file.sidecarJson,
      ref: { id: 'local-file', name: file.name },
    }
  }

  /** Re-open a previously-opened workspace. For local-file storage this
   *  delegates to `open()` (there's no persistent-handle store), so the
   *  user sees the file picker again. `ref` is used as a hint only. */
  async load(ref: WorkspaceRef): Promise<StoredWorkspace> {
    // In a future enhancement we could store FileSystemFileHandle references
    // in IndexedDB and re-prompt for permission here instead of showing a
    // fresh picker. For now, delegate to open() and accept the fresh picker.
    const file = await openDSLFile()
    if (file?.content) {
      return {
        content: file.content,
        sidecarJson: file.sidecarJson,
        ref: { id: 'local-file', name: file.name },
      }
    }
    // Degrade gracefully — return a shell with the known name.
    return { content: '', ref }
  }

  /** Persist a workspace. When a `ref` is present the adapter uses its
   *  `name` as the suggested file name (overwriting the existing handle
   *  if one is held); without a ref it prompts for a new file location.
   *  Sidecar JSON is written alongside on a best-effort basis. */
  async save(req: SaveRequest): Promise<{ ref: WorkspaceRef; ok: boolean }> {
    const suggestedName = req.ref?.name ?? req.suggestedName
    const ok = await saveDSLFile(req.content, suggestedName)

    if (ok && req.sidecarJson) {
      // Best-effort sidecar write — failures are non-blocking (the DSL is
      // the source of truth; the sidecar is layout metadata only).
      void writeSidecarToHandle(req.sidecarJson)
    }

    return {
      ref: { id: 'local-file', name: suggestedName ?? 'untitled.dsl' },
      ok,
    }
  }
}
