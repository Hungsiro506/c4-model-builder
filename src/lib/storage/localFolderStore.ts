import type { WorkspaceStore, WorkspaceRef, StoredWorkspace, SaveRequest } from './types'
import {
  openFolder,
  readDSLFile,
  writeDSLFile,
  writeSidecarFile,
  listDSLFiles,
} from '@/lib/folderIO'

/** Folder-mode adapter (browser File System Access API directory picker).
 *
 *  Wraps the existing `folderIO.ts` primitives — same calls, same behaviour.
 *  Works with the current directory handle (module-global in folderIO).
 *  `WorkspaceRef.id` for this adapter follows the pattern `local-folder:<filename>`.
 */
export class LocalFolderStore implements WorkspaceStore {
  readonly id = 'local-folder' as const
  readonly capabilities = { browse: true, interactivePick: true, persist: true }

  /** List .dsl files in the currently-open directory as WorkspaceRefs. */
  async list(): Promise<WorkspaceRef[]> {
    const files = await listDSLFiles()
    return files.map((name) => ({
      id: `local-folder:${name}`,
      name,
    }))
  }

  /** Open a workspace in folder mode: browse to a directory, then load the
   *  first .dsl file found. Returns null when the picker is cancelled or the
   *  folder has no .dsl files. */
  async open(): Promise<StoredWorkspace | null> {
    const folder = await openFolder()
    if (!folder || folder.dslFiles.length === 0) return null

    const firstFile = folder.dslFiles[0]
    const file = await readDSLFile(firstFile)
    if (!file?.content) return null

    return {
      content: file.content,
      sidecarJson: file.sidecarJson,
      ref: { id: `local-folder:${firstFile}`, name: firstFile },
    }
  }

  /** Re-open a specific .dsl file from the current folder by ref. */
  async load(ref: WorkspaceRef): Promise<StoredWorkspace> {
    const file = await readDSLFile(ref.name)
    return {
      content: file?.content ?? '',
      sidecarJson: file?.sidecarJson,
      ref: { id: `local-folder:${ref.name}`, name: ref.name },
    }
  }

  /** Persist a workspace: writes the DSL content to the named file in the
   *  current directory, plus the sidecar alongside (best-effort). */
  async save(req: SaveRequest): Promise<{ ref: WorkspaceRef; ok: boolean }> {
    const name = req.ref?.name ?? req.suggestedName ?? 'untitled.dsl'
    const ok = await writeDSLFile(name, req.content)

    if (ok && req.sidecarJson) {
      void writeSidecarFile(name, req.sidecarJson)
    }

    return {
      ref: { id: `local-folder:${name}`, name },
      ok,
    }
  }
}
