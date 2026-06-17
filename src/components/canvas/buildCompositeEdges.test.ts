import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { Workspace } from '@/types/model'
import { buildCompositeEdges } from './canvasBuilders'
import type { HighlightFilters } from '@/lib/highlight'

const NO_FILTERS: HighlightFilters = { tags: [], statuses: [], techs: [], teams: [] }

/** Content node carrying a model element (so buildCompositeEdges sees it as visible). */
function contentNode(id: string, type: string, name: string, x: number, y: number): Node {
  return {
    id,
    type,
    position: { x, y },
    measured: { width: 200, height: 100 },
    data: { element: { id, type, name, tags: [], properties: {} } },
  } as unknown as Node
}

/** Workspace: person Developer + systems A, B, C (C has one container c1).
 *  Relationships: A→B, Developer→A, A→C. */
function ws(): Workspace {
  return {
    name: 'edge-retarget',
    model: {
      people: [{ id: 'dev', type: 'person', name: 'Developer', tags: [], properties: {} }],
      softwareSystems: [
        { id: 'sysA', type: 'softwareSystem', name: 'A', tags: [], properties: {}, containers: [] },
        { id: 'sysB', type: 'softwareSystem', name: 'B', tags: [], properties: {}, containers: [] },
        {
          id: 'sysC', type: 'softwareSystem', name: 'C', tags: [], properties: {},
          containers: [{ id: 'c1', type: 'container', name: 'C1', tags: [], properties: {}, components: [] }],
        },
      ],
      relationships: [
        { id: 'r1', sourceId: 'sysA', destinationId: 'sysB', tags: [], properties: {} },
        { id: 'r2', sourceId: 'dev', destinationId: 'sysA', tags: [], properties: {} },
        { id: 'r3', sourceId: 'sysA', destinationId: 'sysC', tags: [], properties: {} },
      ],
      groups: [],
    },
    views: {
      systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  } as unknown as Workspace
}

describe('buildCompositeEdges — expanded endpoint re-target', () => {
  it('keeps A→C as A→c1 when C is expanded (its node replaced by its container)', () => {
    // C expanded → C's node is gone, replaced by its child c1.
    const nodes = [
      contentNode('dev', 'person', 'Developer', 0, 0),
      contentNode('sysA', 'softwareSystem', 'A', 300, 0),
      contentNode('sysB', 'softwareSystem', 'B', 600, 0),
      contentNode('c1', 'container', 'C1', 300, 300),
    ]

    const edges = buildCompositeEdges(ws(), nodes, NO_FILTERS)
    const pairs = edges.map((e) => `${e.source}->${e.target}`).sort()

    // A→C must survive, re-targeted onto the visible container c1.
    expect(pairs).toContain('sysA->c1')
    // The other relationships are unaffected.
    expect(pairs).toContain('sysA->sysB')
    expect(pairs).toContain('dev->sysA')
    // No phantom edge between unrelated nodes.
    expect(pairs).not.toContain('dev->sysB')
  })
})
