import { describe, it, expect } from 'vitest'
import { serializeDSL, parseDSL } from '@/lib/dsl'
import type { Workspace } from '@/types/model'

// Option 1 guard: changeState is a native tag (round-trips), and the built-in
// colour style is render-only — it must NEVER leak into the serialized DSL.
// Unset things must serialize exactly as before (no New/Existing/Updated leak).

function makeWs(systemTags: string[], relTags: string[]): Workspace {
  return {
    name: 'test',
    model: {
      people: [{ id: 'alice', type: 'person', name: 'Alice', tags: ['Person'], properties: {} }],
      softwareSystems: [
        { id: 'api', type: 'softwareSystem', name: 'API', tags: systemTags, properties: {}, containers: [] },
      ],
      relationships: [
        { id: 'rel-1', sourceId: 'alice', destinationId: 'api', description: 'Uses', tags: relTags, properties: {} },
      ],
      groups: [],
    },
    views: {
      systemLandscapeViews: [],
      systemContextViews: [],
      containerViews: [],
      componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  }
}

describe('changeState tag round-trip', () => {
  it('element change tag survives serialize → parse', () => {
    const ws = makeWs(['Software System', 'New'], ['Relationship'])
    const dsl = serializeDSL(ws)
    expect(dsl).toContain('"New"')
    const { workspace, errors } = parseDSL(dsl)
    expect(errors).toEqual([])
    expect(workspace.model.softwareSystems.find((s) => s.name === 'API')?.tags).toContain('New')
  })

  it('relationship change tag survives serialize → parse', () => {
    const ws = makeWs(['Software System'], ['Relationship', 'Modified'])
    const { workspace, errors } = parseDSL(serializeDSL(ws))
    expect(errors).toEqual([])
    expect(workspace.model.relationships[0]?.tags).toContain('Modified')
  })

  it('built-in change colour style is render-only — no style block emitted', () => {
    const ws = makeWs(['Software System', 'New'], ['Relationship', 'Removed'])
    const dsl = serializeDSL(ws)
    // The tag is written, but no `element "New" { background ... }` style block.
    expect(dsl).not.toMatch(/element\s+"(New|Modified|Unchanged|Removed)"/)
    expect(dsl).not.toMatch(/relationship\s+"(New|Modified|Unchanged|Removed)"/)
  })

  it('unset change adds nothing — DSL identical to a plain workspace', () => {
    const plain = serializeDSL(makeWs(['Software System'], ['Relationship']))
    expect(plain).not.toMatch(/"(New|Modified|Unchanged|Removed)"/)
  })
})
