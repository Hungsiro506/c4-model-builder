import { describe, it, expect } from 'vitest'
import { createWorkspaceStore, getActiveStore, replaceActiveStore } from './index'
import { LocalFileStore } from './localFileStore'
import { LocalFolderStore } from './localFolderStore'

// Stage 4 — factory spec.

describe('createWorkspaceStore', () => {
  it('returns a LocalFileStore for "local-file"', () => {
    const store = createWorkspaceStore('local-file')
    expect(store).toBeInstanceOf(LocalFileStore)
    expect(store.id).toBe('local-file')
  })

  it('returns a LocalFolderStore for "local-folder"', () => {
    const store = createWorkspaceStore('local-folder')
    expect(store).toBeInstanceOf(LocalFolderStore)
    expect(store.id).toBe('local-folder')
  })

  it('throws for an unknown adapter id', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => createWorkspaceStore('remote' as any)).toThrow(/unknown/i)
  })
})

describe('getActiveStore', () => {
  it('returns a singleton (stored as a global for now)', async () => {
    // The first call stores it; subsequent calls return the same instance.
    const a = getActiveStore()
    const b = getActiveStore()
    expect(a).toBe(b) // same singleton
    expect(a).toBeInstanceOf(LocalFileStore) // default
  })

  it('replaceActiveStore swaps the singleton', () => {
    const prev = getActiveStore()
    const next = createWorkspaceStore('local-folder')
    replaceActiveStore(next)
    expect(getActiveStore()).toBe(next)
    expect(getActiveStore()).not.toBe(prev)
    // Restore default
    replaceActiveStore(createWorkspaceStore('local-file'))
  })
})
