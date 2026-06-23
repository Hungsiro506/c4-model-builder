import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalFolderStore } from './localFolderStore'

// Stage 3 — unit spec for the LocalFolderStore adapter (wraps folderIO).

vi.mock('@/lib/folderIO', () => ({
  hasFolderAccess: vi.fn(() => true),
  getCurrentDirHandle: vi.fn(),
  setDirHandle: vi.fn(),
  openFolder: vi.fn(),
  readDSLFile: vi.fn(),
  writeDSLFile: vi.fn(),
  writeSidecarFile: vi.fn(),
  listDSLFiles: vi.fn(),
  restoreDirHandle: vi.fn(),
  restoreDirHandleByName: vi.fn(),
  slugifyName: vi.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-')),
}))

import {
  openFolder,
  readDSLFile,
  writeDSLFile,
  writeSidecarFile,
  listDSLFiles,
} from '@/lib/folderIO'

describe('LocalFolderStore', () => {
  let store: LocalFolderStore

  beforeEach(() => {
    vi.clearAllMocks()
    store = new LocalFolderStore()
  })

  it('has the correct id and capabilities', () => {
    expect(store.id).toBe('local-folder')
    expect(store.capabilities).toEqual({ browse: true, interactivePick: true, persist: true })
  })

  describe('list()', () => {
    it('returns the .dsl filenames as WorkspaceRefs', async () => {
      vi.mocked(listDSLFiles).mockResolvedValue(['a.dsl', 'b.dsl'])
      const refs = await store.list()
      expect(refs).toEqual([
        { id: 'local-folder:a.dsl', name: 'a.dsl' },
        { id: 'local-folder:b.dsl', name: 'b.dsl' },
      ])
    })

    it('returns empty array when no directory handle is held', async () => {
      vi.mocked(listDSLFiles).mockResolvedValue([])
      expect(await store.list()).toEqual([])
    })
  })

  describe('open()', () => {
    it('opens a folder and returns the first .dsl file content', async () => {
      vi.mocked(openFolder).mockResolvedValue({ dirHandle: {} as never, dslFiles: ['main.dsl'] })
      vi.mocked(readDSLFile).mockResolvedValue({
        content: 'workspace "W" { }',
        sidecarJson: '{"k":"v"}',
      })
      const result = await store.open()
      expect(result).toEqual({
        content: 'workspace "W" { }',
        sidecarJson: '{"k":"v"}',
        ref: { id: 'local-folder:main.dsl', name: 'main.dsl' },
      })
    })

    it('returns null when the folder is empty (no .dsl files)', async () => {
      vi.mocked(openFolder).mockResolvedValue({ dirHandle: {} as never, dslFiles: [] })
      expect(await store.open()).toBeNull()
    })

    it('returns null when the user cancels', async () => {
      vi.mocked(openFolder).mockResolvedValue(null)
      expect(await store.open()).toBeNull()
    })
  })

  describe('load()', () => {
    it('reads a specific .dsl file by ref', async () => {
      vi.mocked(readDSLFile).mockResolvedValue({ content: 'workspace "Z" { }' })
      const result = await store.load({ id: 'local-folder:z.dsl', name: 'z.dsl' })
      expect(readDSLFile).toHaveBeenCalledWith('z.dsl')
      expect(result?.content).toBe('workspace "Z" { }')
    })
  })

  describe('save()', () => {
    it('writes content to the filename in the ref', async () => {
      vi.mocked(writeDSLFile).mockResolvedValue(true)
      const result = await store.save({
        content: 'workspace "W" { }',
        ref: { id: 'local-folder:w.dsl', name: 'w.dsl' },
      })
      expect(writeDSLFile).toHaveBeenCalledWith('w.dsl', 'workspace "W" { }')
      expect(result.ok).toBe(true)
      expect(result.ref.name).toBe('w.dsl')
    })

    it('writes sidecar alongside content', async () => {
      vi.mocked(writeDSLFile).mockResolvedValue(true)
      await store.save({
        content: 'workspace "W" { }',
        sidecarJson: '{"k":"v"}',
        ref: { id: 'local-folder:w.dsl', name: 'w.dsl' },
      })
      expect(writeSidecarFile).toHaveBeenCalledWith('w.dsl', '{"k":"v"}')
    })

    it('reports ok: false when write fails', async () => {
      vi.mocked(writeDSLFile).mockResolvedValue(false)
      const result = await store.save({ content: '' })
      expect(result.ok).toBe(false)
    })
  })
})
