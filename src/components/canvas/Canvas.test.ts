import { describe, expect, it } from 'vitest'
import { buildTableEdges, buildEdges } from './canvasBuilders'
import type { TableDef, Workspace, FkEdgeDef } from '@/types/model'

/**
 * Canvas.onReconnect reads (oldEdge.data as { isFk?: boolean })?.isFk
 * to decide whether an edge is a FK edge. These tests verify that:
 *  - FK edges FROM buildTableEdges carry data.isFk === true
 *  - Model relationship edges FROM buildEdges do NOT carry data.isFk
 *
 * If buildTableEdges changes the data shape, onReconnect silently breaks.
 * These tests catch that.
 */

const NO_FILTERS = { tags: [], statuses: [], techs: [], teams: [] }

describe('Canvas.onReconnect — FK edge detection contract', () => {
  const manualEdge: FkEdgeDef = {
    id: 'fe1', sourceTableId: 't2', targetTableId: 't1', sourceColumnId: 'col1',
  }

  it('FK edges from buildTableEdges carry data.isFk === true', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'customers', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      { id: 't2', name: 'orders', columns: [{ id: 'col1', name: 'customer_id', type: 'int' }] },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges).toHaveLength(1)
    expect(edges[0].data.isFk).toBe(true)
  })

  it('auto-resolved FK edges also carry data.isFk === true', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'customers', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      { id: 't2', name: 'orders', columns: [
        { name: 'id', type: 'int', isPrimaryKey: true },
        { name: 'customer_id', type: 'int', isForeignKey: true },
      ]},
    ]
    const edges = buildTableEdges('db1', tables, undefined)
    expect(edges).toHaveLength(1)
    expect(edges[0].data.isFk).toBe(true)
  })

  it('model relationship edges do NOT carry data.isFk', () => {
    const ws: Workspace = {
      name: 'test',
      model: {
        people: [
          { id: 'user', type: 'person', name: 'User', tags: [], properties: {} },
        ],
        softwareSystems: [
          {
            id: 'sys', type: 'softwareSystem', name: 'Sys', tags: [], properties: {},
            containers: [],
          },
        ],
        relationships: [
          { id: 'rel1', sourceId: 'sys', destinationId: 'user', tags: ['Relationship'], properties: {} },
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
    const view = {
      type: 'systemLandscape' as const,
      key: 'landscape',
      elements: [{ id: 'sys' }, { id: 'user' }],
      relationships: [{ id: 'rel1' }],
    }
    const nodes = [
      { id: 'sys', type: 'softwareSystem', position: { x: 0, y: 0 }, data: { element: ws.model.softwareSystems[0] } },
      { id: 'user', type: 'person', position: { x: 200, y: 0 }, data: { element: ws.model.people[0] } },
    ]
    const edges = buildEdges(ws, view, nodes, NO_FILTERS)
    expect(edges).toHaveLength(1)
    expect(edges[0].data.isFk).toBeUndefined()
  })
})
