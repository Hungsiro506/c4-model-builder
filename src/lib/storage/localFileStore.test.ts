import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalFileStore } from './localFileStore'

// Stage 2 — unit spec for the LocalFileStore adapter. We mock fileIO so the
// adapter's delegation logic is testable without a real browser.

vi.mock('@/lib/fileIO', () => ({
  openDSLFile: vi.fn(),
  saveDSLFile: vi.fn(),
  writeToCurrentHandle: vi.fn(),
  writeSidecarToHandle: vi.fn(),
  getCurrentFileHandle: vi.fn(),
  hasFileSystemAccess: vi.fn(() => true),
  hasDirectoryAccess: vi.fn(() => true),
  saveToLocalStorage: vi.fn(),
  loadFromLocalStorage: vi.fn(),
  clearLocalStorage: vi.fn(),
}))

import {
  openDSLFile,
  saveDSLFile,
  writeSidecarToHandle,
} from '@/lib/fileIO'

describe('LocalFileStore', () => {
  let store: LocalFileStore

  beforeEach(() => {
    vi.clearAllMocks()
    store = new LocalFileStore()
  })

  it('has the correct id and capabilities', () => {
    expect(store.id).toBe('local-file')
    expect(store.capabilities).toEqual({ browse: true, interactivePick: true, persist: true })
  })

  describe('list()', () => {
    it('returns an empty array (single-file store has no catalog)', async () => {
      expect(await store.list()).toEqual([])
    })
  })

  describe('open()', () => {
    it('returns StoredWorkspace when the file picker succeeds', async () => {
      vi.mocked(openDSLFile).mockResolvedValue({
        content: 'workspace "X" { model {} views {} }',
        name: 'x.dsl',
        sidecarJson: '{"expandedElementIds":[]}',
      })
      const result = await store.open()
      expect(result).toEqual({
        content: 'workspace "X" { model {} views {} }',
        sidecarJson: '{"expandedElementIds":[]}',
        ref: { id: 'local-file', name: 'x.dsl' },
      })
      expect(openDSLFile).toHaveBeenCalledOnce()
    })

    it('returns null when the user cancels', async () => {
      vi.mocked(openDSLFile).mockResolvedValue(null)
      expect(await store.open()).toBeNull()
    })

    it('returns null when content is missing (defensive)', async () => {
      vi.mocked(openDSLFile).mockResolvedValue({ name: 'empty.dsl' } as never)
      expect(await store.open()).toBeNull()
    })
  })

  describe('load()', () => {
    it('re-opens via the picker with the ref as a hint', async () => {
      vi.mocked(openDSLFile).mockResolvedValue({
        content: 'workspace "Z" { model {} views {} }',
        name: 'z.dsl',
      })
      const result = await store.load({ id: 'local-file', name: 'z.dsl' })
      expect(result).toEqual({
        content: 'workspace "Z" { model {} views {} }',
        ref: { id: 'local-file', name: 'z.dsl' },
      })
    })
  })

  describe('save()', () => {
    it('saves to the existing ref name', async () => {
      vi.mocked(saveDSLFile).mockResolvedValue(true)
      const result = await store.save({
        content: 'workspace "W" { }',
        ref: { id: 'local-file', name: 'w.dsl' },
      })
      expect(saveDSLFile).toHaveBeenCalledWith('workspace "W" { }', 'w.dsl')
      expect(result.ok).toBe(true)
      expect(result.ref.name).toBe('w.dsl')
    })

    it('calls save with suggestedName when no ref', async () => {
      vi.mocked(saveDSLFile).mockResolvedValue(true)
      const result = await store.save({ content: 'workspace "W" { }', suggestedName: 'hello.dsl' })
      expect(saveDSLFile).toHaveBeenCalledWith('workspace "W" { }', 'hello.dsl')
      expect(result.ref.name).toBe('hello.dsl')
    })

    it('reports ok: false when write fails', async () => {
      vi.mocked(saveDSLFile).mockResolvedValue(false)
      const result = await store.save({ content: 'workspace "W" { }' })
      expect(result.ok).toBe(false)
    })

    it('writes sidecar alongside content (best-effort)', async () => {
      vi.mocked(saveDSLFile).mockResolvedValue(true)
      await store.save({
        content: 'workspace "W" { }',
        sidecarJson: '{"key":"value"}',
        ref: { id: 'local-file', name: 'w.dsl' },
      })
      expect(writeSidecarToHandle).toHaveBeenCalledWith('{"key":"value"}')
    })
  })
})
