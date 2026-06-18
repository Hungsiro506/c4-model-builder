import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { Workspace } from '@/types/model'
import { buildCompositeEdges, EXPAND_BOUNDARY_PREFIX } from './canvasBuilders'
import type { HighlightFilters } from '@/lib/highlight'

const NO_FILTERS: HighlightFilters = { tags: [], statuses: [], techs: [], teams: [] }

/** Wrapper boundary overlay node for an expanded element. */
function boundaryNode(elementId: string, x: number, y: number): Node {
  return {
    id: `${EXPAND_BOUNDARY_PREFIX}${elementId}`,
    type: 'boundary',
    position: { x, y },
    measured: { width: 280, height: 200 },
    data: { name: elementId, typeLabel: 'Software System', collapsible: true, elementId },
  } as unknown as Node
}

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
  it('keeps A→C as A→C-boundary when C is expanded (parent-level edge stays on the wrapper)', () => {
    // C expanded → C's node is gone, replaced by its child c1 + a wrapper box.
    const nodes = [
      contentNode('dev', 'person', 'Developer', 0, 0),
      contentNode('sysA', 'softwareSystem', 'A', 300, 0),
      contentNode('sysB', 'softwareSystem', 'B', 600, 0),
      contentNode('c1', 'container', 'C1', 300, 300),
      boundaryNode('sysC', 280, 280),
    ]

    const edges = buildCompositeEdges(ws(), nodes, NO_FILTERS)
    const pairs = edges.map((e) => `${e.source}->${e.target}`).sort()

    // A→C survives but stays at the parent level — it attaches to C's wrapper
    // boundary, NOT its child container c1.
    expect(pairs).toContain(`sysA->${EXPAND_BOUNDARY_PREFIX}sysC`)
    expect(pairs).not.toContain('sysA->c1')
    // The other relationships are unaffected.
    expect(pairs).toContain('sysA->sysB')
    expect(pairs).toContain('dev->sysA')
    // No phantom edge between unrelated nodes.
    expect(pairs).not.toContain('dev->sysB')
  })
})

/** Workspace: systems A (container a1) and B (container b1), with an
 *  equal-level container relationship a1→b1. */
function wsContainerRel(): Workspace {
  return {
    name: 'equal-level',
    model: {
      people: [],
      softwareSystems: [
        {
          id: 'sysA', type: 'softwareSystem', name: 'A', tags: [], properties: {},
          containers: [{ id: 'a1', type: 'container', name: 'A1', tags: [], properties: {}, components: [] }],
        },
        {
          id: 'sysB', type: 'softwareSystem', name: 'B', tags: [], properties: {},
          containers: [{ id: 'b1', type: 'container', name: 'B1', tags: [], properties: {}, components: [] }],
        },
      ],
      relationships: [
        { id: 'r1', sourceId: 'a1', destinationId: 'b1', tags: [], properties: {} },
      ],
      groups: [],
    },
    views: {
      systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [],
      configuration: { styles: { elements: [], relationships: [] } },
    },
  } as unknown as Workspace
}

describe('buildCompositeEdges — level-equalized resolution', () => {
  it('a1→b1 shows as A→B-boundary when A is collapsed but B is expanded', () => {
    // A collapsed: a1 absent, sysA is a visible content node.
    // B expanded: b1 visible content node + B wrapper boundary.
    const nodes = [
      contentNode('sysA', 'softwareSystem', 'A', 0, 0),
      contentNode('b1', 'container', 'B1', 600, 0),
      boundaryNode('sysB', 580, -20),
    ]

    const edges = buildCompositeEdges(wsContainerRel(), nodes, NO_FILTERS)
    const pairs = edges.map((e) => `${e.source}->${e.target}`)

    // The equal-level container edge folds the deeper (B) side up to match the
    // collapsed (A) side: A → B-wrapper, NOT a cross-level A → b1.
    expect(pairs).toEqual([`sysA->${EXPAND_BOUNDARY_PREFIX}sysB`])
    expect(pairs).not.toContain('sysA->b1')
  })

  it('a1→b1 stays finest (a1→b1) when BOTH A and B are expanded', () => {
    const nodes = [
      contentNode('a1', 'container', 'A1', 0, 0),
      contentNode('b1', 'container', 'B1', 600, 0),
      boundaryNode('sysA', -20, -20),
      boundaryNode('sysB', 580, -20),
    ]

    const edges = buildCompositeEdges(wsContainerRel(), nodes, NO_FILTERS)
    const pairs = edges.map((e) => `${e.source}->${e.target}`)

    expect(pairs).toEqual(['a1->b1'])
  })
})
