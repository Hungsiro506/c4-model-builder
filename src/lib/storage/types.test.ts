import { describe, it, expect } from 'vitest'
import type { WorkspaceRef, StoredWorkspace, SaveRequest, WorkspaceStore } from './types'

// Stage 1 — contract spec. The interface itself is TypeScript-only (no runtime
// object to assert), so these tests validate the type shapes through concrete
// dummy implementations and type-narrowing.

describe('WorkspaceRef', () => {
  it('accepts id + name + optional version', () => {
    const ref: WorkspaceRef = { id: 'ws-1', name: 'my-workspace.dsl', version: '3' }
    expect(ref.id).toBe('ws-1')
    expect(ref.name).toBe('my-workspace.dsl')
    expect(ref.version).toBe('3')
  })

  it('version is optional (undefined is valid)', () => {
    const ref: WorkspaceRef = { id: 'ws-1', name: 'my-workspace.dsl' }
    expect(ref.version).toBeUndefined()
  })
})

describe('StoredWorkspace', () => {
  it('holds content + optional sidecarJson + a ref', () => {
    const sw: StoredWorkspace = {
      content: 'workspace "test" { model {} views {} }',
      sidecarJson: '{"expandedElementIds":[]}',
      ref: { id: 'ws-1', name: 'test.dsl' },
    }
    expect(sw.content).toBeTruthy()
    expect(sw.sidecarJson).toBeTruthy()
    expect(sw.ref.id).toBe('ws-1')
  })

  it('sidecarJson is optional', () => {
    const sw: StoredWorkspace = {
      content: 'workspace "test" { model {} views {} }',
      ref: { id: 'ws-2', name: 'test.dsl' },
    }
    expect(sw.sidecarJson).toBeUndefined()
  })
})

describe('SaveRequest', () => {
  it('holds content + optional sidecar + optional ref + suggestedName', () => {
    const req: SaveRequest = {
      content: 'workspace "test" { model {} views {} }',
      sidecarJson: '{"expandedElementIds":[]}',
      ref: { id: 'ws-1', name: 'test.dsl', version: '2' },
      suggestedName: 'my-workspace.dsl',
    }
    expect(req.content).toBeTruthy()
    expect(req.ref?.id).toBe('ws-1')
    expect(req.suggestedName).toBe('my-workspace.dsl')
  })

  it('works with content only (bare save)', () => {
    const req: SaveRequest = { content: 'workspace "bare" { model {} views {} }' }
    expect(req.ref).toBeUndefined()
    expect(req.sidecarJson).toBeUndefined()
    expect(req.suggestedName).toBeUndefined()
  })
})

describe('WorkspaceStore — contract (dummy adapter)', () => {
  it('the interface methods are callable and return the expected shapes', async () => {
    // A full dummy adapter exercises every method at runtime.
    const dummy: WorkspaceStore = {
      id: 'local-file',
      capabilities: { browse: true, interactivePick: true, persist: true },
      list: async () => [{ id: 'ws-1', name: 'a.dsl' }],
      open: async () => ({ content: 'w "A" { model {} views {} }', ref: { id: 'ws-1', name: 'a.dsl' } }),
      load: async (ref) => ({ content: 'w "A" { model {} views {} }', ref }),
      save: async (req) => ({ ref: req.ref ?? { id: 'new', name: req.suggestedName ?? 'untitled.dsl' }, ok: true }),
    }

    expect(dummy.id).toBe('local-file')
    expect(dummy.capabilities.browse).toBe(true)

    const list = await dummy.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('a.dsl')

    const ws = await dummy.open()
    expect(ws).not.toBeNull()
    expect(ws!.content).toBeTruthy()
    expect(ws!.ref.id).toBe('ws-1')

    const loaded = await dummy.load({ id: 'x', name: 'x.dsl' })
    expect(loaded.content).toBeTruthy()

    const saved = await dummy.save({ content: 'w "B" { }' })
    expect(saved.ok).toBe(true)
    expect(saved.ref.id).toBe('new')
  })

  it('open may return null (user cancelled)', async () => {
    const cancellable: WorkspaceStore = {
      id: 'local-file',
      capabilities: { browse: true, interactivePick: true, persist: true },
      list: async () => [],
      open: async () => null,
      load: async () => ({ content: '', ref: { id: 'x', name: 'x.dsl' } }),
      save: async () => ({ ref: { id: 'x', name: 'x.dsl' }, ok: false }),
    }
    expect(await cancellable.open()).toBeNull()
  })
})
