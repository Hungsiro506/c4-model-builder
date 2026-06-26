import { afterEach, describe, it, expect, vi } from 'vitest'
import { extractSidecar, applySidecar, parseSidecar, serializeSidecar, sidecarName } from './sidecar'
import type { Workspace } from '@/types/model'

function makeWorkspace(): Workspace {
  return {
    name: 'Test',
    model: {
      people: [
        { id: 'alice', type: 'person', name: 'Alice', tags: ['Element', 'Person'], properties: {} },
      ],
      softwareSystems: [],
      relationships: [
        {
          id: 'rel-1',
          sourceId: 'alice',
          destinationId: 'sys1',
          description: 'uses',
          tags: ['Relationship'],
          properties: {},
        },
      ],
      groups: [],
    },
    views: {
      systemLandscapeViews: [
        {
          type: 'systemLandscape',
          key: 'sl1',
          title: 'Landscape',
          elements: [{ id: 'alice' }],
          relationships: [],
        },
      ],
      systemContextViews: [],
      containerViews: [],
      componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── extractSidecar ──────────────────────────────────────────────────

describe('extractSidecar', () => {
  it('returns null when workspace has no sidecar data', () => {
    const ws = makeWorkspace()
    const result = extractSidecar(ws)
    expect(result).toBeNull()
  })

  it('does NOT include status in sidecar (status is now in DSL)', () => {
    const ws = makeWorkspace()
    ws.model.people[0].status = 'Live'
    // status/owner are serialized in the DSL — extractSidecar should not duplicate them
    const result = extractSidecar(ws)
    expect(result).toBeNull()
    // If there were also a relationship with lineStyle we'd get a result, but no elements key
  })

  it('does NOT include lineStyle in sidecar (lineStyle is now in DSL)', () => {
    const ws = makeWorkspace()
    ws.model.relationships[0].lineStyle = 'Curved'
    // lineStyle is serialized in the DSL — extractSidecar should not duplicate it.
    // The sidecar reader still applies it for backward-compat migration.
    const result = extractSidecar(ws)
    expect(result).toBeNull()
  })

  it('captures pinned view elements', () => {
    const ws = makeWorkspace()
    ws.views.systemLandscapeViews[0].elements[0].pinned = true
    const result = extractSidecar(ws)
    expect(result).not.toBeNull()
    expect(result!.views?.['sl1']?.elements?.['alice']?.pinned).toBe(true)
  })

  it('version is always 1 when there is sidecar data', () => {
    const ws = makeWorkspace()
    ws.views.systemLandscapeViews[0].elements[0].pinned = true
    const result = extractSidecar(ws)
    expect(result!.version).toBe(1)
  })

  it('captures dragged expand-in-place child positions', () => {
    const ws = makeWorkspace()
    ws.views.systemLandscapeViews[0].expandedLayout = [{ id: 'child1', x: 50, y: 75 }]
    const result = extractSidecar(ws)
    expect(result!.views?.['sl1']?.expanded?.['child1']).toEqual({ x: 50, y: 75 })
  })

  it('skips expanded children missing x or y', () => {
    const ws = makeWorkspace()
    ws.views.systemLandscapeViews[0].expandedLayout = [{ id: 'child1', x: 50 }]
    const result = extractSidecar(ws)
    expect(result).toBeNull()
  })
})

// ─── applySidecar ────────────────────────────────────────────────────

describe('applySidecar', () => {
  it('applies status to a person when DSL did not set it (migration fallback)', () => {
    const ws = makeWorkspace()
    applySidecar(ws, { version: 1, elements: { alice: { status: 'Deprecated' } } })
    expect(ws.model.people[0].status).toBe('Deprecated')
  })

  it('does not override status already set by DSL (DSL is authoritative)', () => {
    const ws = makeWorkspace()
    ws.model.people[0].status = 'Live' // simulates DSL parse result
    applySidecar(ws, { version: 1, elements: { alice: { status: 'Deprecated' } } })
    expect(ws.model.people[0].status).toBe('Live') // DSL value wins
  })

  it('applies lineStyle to a relationship', () => {
    const ws = makeWorkspace()
    applySidecar(ws, { version: 1, relationships: { 'rel-1': { lineStyle: 'Orthogonal' } } })
    expect(ws.model.relationships[0].lineStyle).toBe('Orthogonal')
  })

  it('applies pinned flag to a view element', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      views: { sl1: { elements: { alice: { pinned: true } } } },
    })
    expect(ws.views.systemLandscapeViews[0].elements[0].pinned).toBe(true)
  })

  it('applies finite pinned coordinates to a view element', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      views: { sl1: { elements: { alice: { pinned: true, x: 120, y: 240 } } } },
    })
    expect(ws.views.systemLandscapeViews[0].elements[0]).toMatchObject({ pinned: true, x: 120, y: 240 })
  })

  it('ignores non-finite pinned coordinates defensively', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      views: { sl1: { elements: { alice: { pinned: true, x: Number.NaN, y: Infinity } } } },
    })
    expect(ws.views.systemLandscapeViews[0].elements[0].pinned).toBe(true)
    expect(ws.views.systemLandscapeViews[0].elements[0].x).toBeUndefined()
    expect(ws.views.systemLandscapeViews[0].elements[0].y).toBeUndefined()
  })

  it('restores expand-in-place child positions into view.expandedLayout', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      views: { sl1: { expanded: { child1: { x: 50, y: 75 } } } },
    })
    expect(ws.views.systemLandscapeViews[0].expandedLayout).toEqual([{ id: 'child1', x: 50, y: 75 }])
  })

  it('ignores non-finite expanded child coordinates defensively', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      views: { sl1: { expanded: { child1: { x: Number.NaN, y: 10 } } } },
    })
    expect(ws.views.systemLandscapeViews[0].expandedLayout).toBeUndefined()
  })

  it('is a no-op when version !== 1', () => {
    const ws = makeWorkspace()
    applySidecar(ws, { version: 99 as 1, elements: { alice: { status: 'Removed' } } })
    // Status should NOT be applied
    expect(ws.model.people[0].status).toBeUndefined()
  })

  it('rejects invalid status values not in the union type', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      elements: { alice: { status: 'Injected' as 'Live' } },
    })
    expect(ws.model.people[0].status).toBeUndefined()
  })

  it('rejects invalid lineStyle values not in the union type', () => {
    const ws = makeWorkspace()
    applySidecar(ws, {
      version: 1,
      relationships: { 'rel-1': { lineStyle: 'Injected' as 'Curved' } },
    })
    expect(ws.model.relationships[0].lineStyle).toBeUndefined()
  })

  it('does not apply unknown/disallowed element keys', () => {
    const ws = makeWorkspace()
    const sidecar = {
      version: 1 as const,
      elements: {
        alice: {
          status: 'Live' as const,
          // @ts-expect-error — testing runtime protection against extra keys
          maliciousKey: 'injected',
        },
      },
    }
    applySidecar(ws, sidecar)
    expect(ws.model.people[0].status).toBe('Live')
    // @ts-expect-error — confirming maliciousKey was not applied
    expect(ws.model.people[0].maliciousKey).toBeUndefined()
  })
})

// ─── parseSidecar ────────────────────────────────────────────────────

describe('parseSidecar', () => {
  it('returns null for invalid JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseSidecar('not valid json {')
    expect(result).toBeNull()
  })

  it('returns null when version is not 1', () => {
    const json = JSON.stringify({ version: 2, elements: {} })
    expect(parseSidecar(json)).toBeNull()
  })

  it('returns null for null/missing version', () => {
    expect(parseSidecar(JSON.stringify({ elements: {} }))).toBeNull()
  })

  it('returns null for empty string', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseSidecar('')).toBeNull()
  })

  it('returns a valid SidecarData for correct JSON', () => {
    const data = { version: 1, elements: { alice: { status: 'Live' } } }
    const result = parseSidecar(JSON.stringify(data))
    expect(result).not.toBeNull()
    expect(result!.version).toBe(1)
    expect(result!.elements?.['alice']?.status).toBe('Live')
  })

  it('returns null when top-level collections are arrays', () => {
    expect(parseSidecar(JSON.stringify({ version: 1, elements: [] }))).toBeNull()
    expect(parseSidecar(JSON.stringify({ version: 1, relationships: [] }))).toBeNull()
    expect(parseSidecar(JSON.stringify({ version: 1, views: [] }))).toBeNull()
  })

  it('returns null for invalid element metadata', () => {
    expect(parseSidecar(JSON.stringify({ version: 1, elements: { alice: { status: 'Injected' } } }))).toBeNull()
    expect(parseSidecar(JSON.stringify({ version: 1, elements: { alice: { owner: 42 } } }))).toBeNull()
  })

  it('returns null for invalid relationship metadata', () => {
    expect(parseSidecar(JSON.stringify({ version: 1, relationships: { 'rel-1': { lineStyle: 'Diagonal' } } }))).toBeNull()
  })

  it('returns null for invalid view element metadata', () => {
    expect(parseSidecar(JSON.stringify({
      version: 1,
      views: { sl1: { elements: { alice: { pinned: true, x: Number.NaN } } } },
    }))).toBeNull()
    expect(parseSidecar(JSON.stringify({
      version: 1,
      views: { sl1: { elements: { alice: { pinned: 'yes' } } } },
    }))).toBeNull()
  })

  it('returns null for invalid expanded child metadata', () => {
    expect(parseSidecar(JSON.stringify({
      version: 1,
      views: { sl1: { expanded: { child1: { x: 'nope', y: 10 } } } },
    }))).toBeNull()
    expect(parseSidecar(JSON.stringify({
      version: 1,
      views: { sl1: { expanded: [] } },
    }))).toBeNull()
  })
})

// ─── serializeSidecar / parseSidecar round-trip ───────────────────────

describe('serializeSidecar / parseSidecar round-trip', () => {
  it('serializes and deserializes sidecar data correctly', () => {
    const ws = makeWorkspace()
    // status, owner, and lineStyle are all in DSL now — none are extracted to sidecar
    ws.model.relationships[0].lineStyle = 'Straight'
    ws.views.systemLandscapeViews[0].elements[0].pinned = true

    const sidecar = extractSidecar(ws)!
    const json = serializeSidecar(sidecar)
    const parsed = parseSidecar(json)

    expect(parsed).not.toBeNull()
    expect(parsed!.version).toBe(1)
    expect(parsed!.elements).toBeUndefined()      // status/owner no longer in sidecar
    expect(parsed!.relationships).toBeUndefined() // lineStyle no longer in sidecar
    expect(parsed!.views?.['sl1']?.elements?.['alice']?.pinned).toBe(true)
  })

  it('produces valid JSON string', () => {
    extractSidecar(makeWorkspace())
    // Nothing to serialize → null, so use manual data
    const json = serializeSidecar({ version: 1, elements: { alice: { status: 'Live' } } })
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

// ─── sidecarName ────────────────────────────────────────────────────

describe('sidecarName', () => {
  it('converts diagram.dsl → diagram.c4hero.json', () => {
    expect(sidecarName('diagram.dsl')).toBe('diagram.c4hero.json')
  })

  it('converts workspace.dsl → workspace.c4hero.json', () => {
    expect(sidecarName('workspace.dsl')).toBe('workspace.c4hero.json')
  })

  it('handles uppercase .DSL extension', () => {
    expect(sidecarName('workspace.DSL')).toBe('workspace.c4hero.json')
  })

  it('handles names without .dsl extension gracefully', () => {
    const result = sidecarName('myfile.txt')
    // Should not crash; appends .c4hero.json
    expect(typeof result).toBe('string')
  })

  it('handles just .dsl extension', () => {
    expect(sidecarName('.dsl')).toBe('workspace.c4hero.json')
  })

  it('sanitizes unsafe sidecar base names', () => {
    expect(sidecarName('../CON.dsl')).toBe('__CON.c4hero.json')
    expect(sidecarName('line\nbreak.dsl')).toBe('line_break.c4hero.json')
  })
})

// ─── Tables in sidecar ─────────────────────────────────────────────────

describe('tables in extractSidecar / applySidecar', () => {
  it('extractSidecar includes tables when tableData is provided', () => {
    const ws = makeWorkspace()
    const tableData = {
      'db-container-1': [
        { id: 't1', name: 'users', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      ],
    }
    const result = extractSidecar(ws, tableData)
    expect(result).not.toBeNull()
    expect(result!.tables).toBeDefined()
    expect(result!.tables!['db-container-1']).toHaveLength(1)
    expect(result!.tables!['db-container-1'][0].name).toBe('users')
  })

  it('extractSidecar does NOT include tables when tableData is empty', () => {
    const ws = makeWorkspace()
    const result = extractSidecar(ws, {})
    // Empty tableData should not flag hasData
    expect(result).toBeNull()
  })

  it('extractSidecar does NOT include tables when tableData is undefined', () => {
    const ws = makeWorkspace()
    const result = extractSidecar(ws, undefined)
    expect(result).toBeNull()
  })

  it('extractSidecar includes tables alongside other sidecar data', () => {
    const ws = makeWorkspace()
    ws.views.systemLandscapeViews[0].elements[0].pinned = true
    const tableData = {
      'db-1': [
        { id: 't1', name: 'orders', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      ],
    }
    const result = extractSidecar(ws, tableData)
    expect(result!.views).toBeDefined()
    expect(result!.tables).toBeDefined()
  })

  it('extractSidecar serializes column FK and description', () => {
    const ws = makeWorkspace()
    const tableData = {
      'db-1': [
        {
          id: 't1',
          name: 'orders',
          columns: [
            { name: 'id', type: 'int', isPrimaryKey: true },
            { name: 'customer_id', type: 'int', isForeignKey: true },
            { name: 'notes', type: 'text', description: 'order notes' },
          ],
        },
      ],
    }
    const result = extractSidecar(ws, tableData)
    const cols = result!.tables!['db-1'][0].columns
    expect(cols[0]).toEqual({ name: 'id', type: 'int', isPrimaryKey: true })
    expect(cols[1]).toEqual({ name: 'customer_id', type: 'int', isForeignKey: true })
    expect(cols[2]).toEqual({ name: 'notes', type: 'text', description: 'order notes' })
  })

  it('extractSidecar serializes table description', () => {
    const ws = makeWorkspace()
    const tableData = {
      'db-1': [
        { id: 't1', name: 'users', description: 'All users', columns: [] },
      ],
    }
    const result = extractSidecar(ws, tableData)
    expect(result!.tables!['db-1'][0].description).toBe('All users')
  })

  it('applySidecar returns tables from valid sidecar', () => {
    const ws = makeWorkspace()
    const sidecar = {
      version: 1 as const,
      tables: {
        'db-1': [
          { id: 't1', name: 'users', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
        ],
      },
    }
    const { tableData } = applySidecar(ws, sidecar)
    expect(tableData).not.toBeNull()
    expect(tableData!['db-1']).toHaveLength(1)
    expect(tableData!['db-1'][0].name).toBe('users')
  })

  it('applySidecar returns null tableData when sidecar has no tables', () => {
    const ws = makeWorkspace()
    const { tableData } = applySidecar(ws, { version: 1 })
    expect(tableData).toBeNull()
  })

  it('tables round-trip through extractSidecar → serialize → parse → applySidecar', () => {
    const ws = makeWorkspace()
    const tableData = {
      'db-1': [
        {
          id: 't1',
          name: 'users',
          columns: [
            { name: 'id', type: 'int', isPrimaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string', description: 'user email' },
          ],
        },
      ],
    }

    const sidecar = extractSidecar(ws, tableData)!
    const json = serializeSidecar(sidecar)
    const parsed = parseSidecar(json)!
    const { tableData: tables } = applySidecar(ws, parsed)

    expect(tables!['db-1']).toHaveLength(1)
    expect(tables!['db-1'][0].name).toBe('users')
    expect(tables!['db-1'][0].columns).toHaveLength(3)
    expect(tables!['db-1'][0].columns[0]).toMatchObject({ name: 'id', type: 'int', isPrimaryKey: true })
  })

  it('parseSidecar returns null for invalid tables shape', () => {
    // tables should be Record<string, SidecarTable[]>, not a single array
    expect(parseSidecar(JSON.stringify({
      version: 1,
      tables: [
        { id: 't1', name: 'users', columns: [] },
      ],
    }))).toBeNull()
  })

  it('parseSidecar returns null for table with missing required fields', () => {
    // TableDef requires id, name, columns
    expect(parseSidecar(JSON.stringify({
      version: 1,
      tables: {
        'db-1': [{ name: 'users', columns: [] }], // missing id
      },
    }))).toBeNull()
  })

  it('parseSidecar returns null for column with missing required fields', () => {
    // ColumnDef requires name, type
    expect(parseSidecar(JSON.stringify({
      version: 1,
      tables: {
        'db-1': [{ id: 't1', name: 'users', columns: [{ type: 'int' }] }], // missing name
      },
    }))).toBeNull()
  })

  it('parseSidecar returns null for column with invalid PK type', () => {
    expect(parseSidecar(JSON.stringify({
      version: 1,
      tables: {
        'db-1': [{ id: 't1', name: 'users', columns: [{ name: 'id', type: 'int', isPrimaryKey: 'yes' }] }],
      },
    }))).toBeNull()
  })
})

describe('serializeSidecar / parseSidecar round-trip with tables', () => {
  it('serializes and deserializes tables correctly', () => {
    const sidecar = {
      version: 1 as const,
      tables: {
        'db-container-1': [
          {
            id: 't_users',
            name: 'users',
            description: 'User accounts',
            columns: [
              { name: 'id', type: 'int', isPrimaryKey: true },
              { name: 'email', type: 'varchar(255)' },
              { name: 'department_id', type: 'int', isForeignKey: true },
            ],
          },
        ],
      },
    }
    const json = serializeSidecar(sidecar)
    const parsed = parseSidecar(json)
    expect(parsed).not.toBeNull()
    expect(parsed!.tables!['db-container-1']).toHaveLength(1)
    expect(parsed!.tables!['db-container-1'][0]).toMatchObject({
      id: 't_users',
      name: 'users',
      description: 'User accounts',
    })
  })
})
