import { describe, expect, it } from 'vitest'
import { buildNodes, isDatabaseContainer, tableNodeId, getTableNodeSize, buildTableNode, buildParentMap, resolveTableFKs, buildTableEdges } from './canvasBuilders'
import type { HighlightFilters } from '@/lib/highlight'
import { THEMES } from '@/lib/themes'
import type { ElementStyle, Workspace, Container, SoftwareSystem, Person, Component, TableDef, ModelElement } from '@/types/model'

const NO_FILTERS: HighlightFilters = {
  tags: [],
  statuses: [],
  techs: [],
  teams: [],
}

function workspace(styles: ElementStyle[], tags = ['Element', 'Person']): Workspace {
  return {
    name: 'Theme test',
    model: {
      people: [
        { id: 'user', type: 'person', name: 'User', tags, properties: {} },
      ],
      softwareSystems: [],
      relationships: [],
      groups: [],
    },
    views: {
      systemLandscapeViews: [
        {
          type: 'systemLandscape',
          key: 'landscape',
          elements: [{ id: 'user' }],
          relationships: [],
        },
      ],
      systemContextViews: [],
      containerViews: [],
      componentViews: [],
      configuration: { styles: { elements: styles, relationships: [] } },
    },
  }
}

function personStyle(styles: ElementStyle[]) {
  return styles.find((style) => style.tag === 'Person')!
}

function renderedStyle(styles: ElementStyle[], theme = THEMES.structurizr, tags?: string[]) {
  const ws = workspace(styles, tags)
  const [node] = buildNodes(
    ws,
    ws.views.systemLandscapeViews[0],
    () => {},
    NO_FILTERS,
    new Map(),
    new Set(),
    theme,
  )
  return node.data.style as ElementStyle
}

describe('buildNodes theme styles', () => {
  it('lets the active theme replace legacy built-in styles copied from another app palette', () => {
    const style = renderedStyle([personStyle(THEMES.readability)])
    expect(style.background).toBe(personStyle(THEMES.structurizr).background)
    expect(style.stroke).toBe(personStyle(THEMES.structurizr).stroke)
  })

  it('lets the active theme replace bundled template tag colors', () => {
    const style = renderedStyle([
      { tag: 'Bank Staff', background: '#1e2832', color: '#94a3b8', stroke: '#475569' },
    ], THEMES.light, ['Element', 'Person', 'Bank Staff'])
    expect(style.background).toBe(personStyle(THEMES.light).background)
    expect(style.stroke).toBe(personStyle(THEMES.light).stroke)
  })

  it('preserves non-color fields from bundled template tag styles', () => {
    const style = renderedStyle([
      { tag: 'Database', background: '#1e1a40', color: '#c4b5fd', stroke: '#7c3aed', shape: 'Cylinder' },
    ], THEMES.light, ['Element', 'Person', 'Database'])
    expect(style.background).toBe(personStyle(THEMES.light).background)
    expect(style.shape).toBe('Cylinder')
  })

  it('keeps custom built-in type styles that are not one of the app palettes', () => {
    const customStyle: ElementStyle = { tag: 'Person', background: '#123456', color: '#ffffff', stroke: '#abcdef' }
    const style = renderedStyle([customStyle])
    expect(style.background).toBe('#123456')
    expect(style.stroke).toBe('#abcdef')
  })

  it('keeps custom tag styles above the active theme', () => {
    const vipStyle: ElementStyle = { tag: 'VIP', background: '#441155', color: '#ffeeff', stroke: '#dd77ff' }
    const style = renderedStyle([vipStyle], THEMES.structurizr, ['Element', 'Person', 'VIP'])
    expect(style.background).toBe('#441155')
    expect(style.stroke).toBe('#dd77ff')
  })
})

describe('isDatabaseContainer', () => {
  const base = { id: 'c1', name: 'Test', properties: {} }

  it('returns true for a Container with "Database" tag', () => {
    const db: Container = { ...base, type: 'container', tags: ['Element', 'Container', 'Database'], components: [] }
    expect(isDatabaseContainer(db)).toBe(true)
  })

  it('returns false for a Container without "Database" tag', () => {
    const svc: Container = { ...base, type: 'container', tags: ['Element', 'Container'], components: [] }
    expect(isDatabaseContainer(svc)).toBe(false)
  })

  it('returns false for a SoftwareSystem', () => {
    const sys: SoftwareSystem = { ...base, type: 'softwareSystem', tags: ['Element', 'Software System'], containers: [] }
    expect(isDatabaseContainer(sys)).toBe(false)
  })

  it('returns false for a Person', () => {
    const p: Person = { ...base, type: 'person', tags: ['Element', 'Person'] }
    expect(isDatabaseContainer(p)).toBe(false)
  })

  it('returns false for a Component', () => {
    const comp: Component = { ...base, type: 'component', tags: ['Element', 'Component'] }
    expect(isDatabaseContainer(comp)).toBe(false)
  })
})

describe('tableNodeId', () => {
  it('returns synthetic id combining container and table id', () => {
    expect(tableNodeId('db-1', 't-users')).toBe('__table__db-1__t-users')
  })
})

describe('getTableNodeSize', () => {
  const HEADER_H = 36
  const ROW_H = 20

  it('returns minimal size for table with no columns', () => {
    const empty: TableDef = { id: 't1', name: 'empty', columns: [] }
    const size = getTableNodeSize(empty)
    expect(size.width).toBe(220)
    expect(size.height).toBe(HEADER_H + ROW_H + 8) // minimum 1 row placeholder
  })

  it('scales height with column count', () => {
    const manyCols: TableDef = {
      id: 't1', name: 'big',
      columns: [
        { name: 'id', type: 'int', isPrimaryKey: true },
        { name: 'name', type: 'varchar' },
        { name: 'email', type: 'varchar' },
      ],
    }
    const size = getTableNodeSize(manyCols)
    expect(size.width).toBe(220)
    expect(size.height).toBe(HEADER_H + 3 * ROW_H + 8)
  })
})

describe('buildTableNode', () => {
  const ctx = { styleIndex: new Map(), active: false }
  const container: ModelElement = {
    id: 'c1', type: 'container', name: 'DB', tags: ['Element', 'Container', 'Database'],
    properties: {}, components: [],
  }

  it('returns a React Flow node of type "table"', () => {
    const td: TableDef = { id: 't1', name: 'Users', columns: [] }
    const node = buildTableNode(td, 'c1', container, { x: 10, y: 20 }, ctx)
    expect(node.type).toBe('table')
    expect(node.id).toBe('__table__c1__t1')
    expect(node.position).toEqual({ x: 10, y: 20 })
    expect(node.data.tableDef).toBe(td)
    expect(node.data.containerId).toBe('c1')
    expect(node.data.style).toBeUndefined()
  })

  it('table node is draggable', () => {
    const td: TableDef = { id: 't1', name: 'Users', columns: [] }
    const node = buildTableNode(td, 'c1', container, { x: 0, y: 0 }, ctx)
    expect(node.draggable).toBe(true)
  })
})

describe('buildParentMap with tableData', () => {
  it('includes table → container mapping for Database containers', () => {
    const ws: Workspace = {
      name: 'test',
      model: {
        people: [],
        softwareSystems: [{
          id: 'sys1', type: 'softwareSystem', name: 'System', tags: [], properties: {},
          containers: [{
            id: 'db1', type: 'container', name: 'DB', tags: ['Element', 'Container', 'Database'],
            properties: {}, components: [{ id: 'comp1', type: 'component', name: 'C', tags: [], properties: {} }],
          }],
        }],
        relationships: [],
        groups: [],
      },
      views: {
        systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [],
        configuration: { styles: { elements: [], relationships: [] } },
      },
    }
    const tableData = { 'db1': [{ id: 't1', name: 'Users', columns: [] }] }
    const map = buildParentMap(ws, tableData)

    // Existing model parent
    expect(map.get('comp1')).toBe('db1')
    // Table parent
    expect(map.get('__table__db1__t1')).toBe('db1')
    // System has no parent
    expect(map.get('sys1')).toBeUndefined()
  })

  it('does not crash when tableData is undefined', () => {
    const ws: Workspace = {
      name: 'test',
      model: {
        people: [],
        softwareSystems: [{
          id: 'sys1', type: 'softwareSystem', name: 'System', tags: [], properties: {},
          containers: [{
            id: 'svc1', type: 'container', name: 'API', tags: ['Element', 'Container'],
            properties: {}, components: [],
          }],
        }],
        relationships: [],
        groups: [],
      },
      views: {
        systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [],
        configuration: { styles: { elements: [], relationships: [] } },
      },
    }
    const map = buildParentMap(ws, undefined)
    // Non-DB containers still map to their system, no component children
    expect(map.get('svc1')).toBe('sys1')
    expect(map.size).toBe(1) // container→system, no components
  })
})

// ─── resolveTableFKs ──────────────────────────────────────────────────

describe('resolveTableFKs', () => {
  it('returns empty array for empty table list', () => {
    expect(resolveTableFKs([])).toEqual([])
  })

  it('returns empty when no columns have isForeignKey', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'orders', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      { id: 't2', name: 'items', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    expect(resolveTableFKs(tables)).toEqual([])
  })

  it('matches customer_id FK to customers.id PK via naming convention', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const pairs = resolveTableFKs(tables)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual({
      sourceTableId: 't2',
      sourceColumnId: expect.any(String),
      targetTableId: 't1',
      targetColumnId: expect.any(String),
    })
  })

  it('matches user_id FK to users.id PK (handles irregular plural)', () => {
    const tables: TableDef[] = [
      {
        id: 'u1', name: 'users', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 'p1', name: 'posts', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'user_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const pairs = resolveTableFKs(tables)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].sourceTableId).toBe('p1')
    expect(pairs[0].targetTableId).toBe('u1')
  })

  it('returns empty when no PK exists on matching target table', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int' }, // not PK
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    expect(resolveTableFKs(tables)).toEqual([])
  })

  it('resolves multiple FK columns in one table', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'products', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't3', name: 'order_items', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'order_id', type: 'int', isForeignKey: true },
          { name: 'product_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const pairs = resolveTableFKs(tables)
    expect(pairs).toHaveLength(2)
    const sourceIds = pairs.map(p => p.sourceTableId)
    expect([...new Set(sourceIds)]).toEqual(['t3'])
  })

  it('does not match FK when target table name has no PK column named "id"', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'customer_pk', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    // customer_id → customers.{id}? No — customers has customer_pk, not id
    // So the naming convention doesn't match. Should be empty.
    const pairs = resolveTableFKs(tables)
    // customer_id can't match customers.customer_pk via naming convention
    expect(pairs).toEqual([])
  })
})

// ─── buildTableEdges ───────────────────────────────────────────────────

describe('buildTableEdges', () => {
  const manualEdge = { id: 'fe1', sourceTableId: 't2', targetTableId: 't1', sourceColumnId: 'col1' }

  it('returns empty array when no FK relationships exist', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'customers', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      { id: 't2', name: 'orders', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    expect(buildTableEdges('db1', tables)).toEqual([])
  })

  it('skips FK edge when source table does not exist in tables list', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'customers', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      // 'orders' table (t2) is missing — was deleted
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges).toHaveLength(0)
  })

  it('skips FK edge when target table does not exist in tables list', () => {
    const tables: TableDef[] = [
      { id: 't2', name: 'orders', columns: [{ id: 'col1', name: 'customer_id', type: 'int' }] },
      // 'customers' table (t1) is missing — was deleted
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges).toHaveLength(0)
  })

  it('builds React Flow edge with relationship type and correct source/target', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges).toHaveLength(1)
    const edge = edges[0]
    expect(edge.source).toBe('__table__db1__t2')
    expect(edge.target).toBe('__table__db1__t1')
    expect(edge.type).toBe('relationship')
    expect(edge.data.isFk).toBe(true)
  })

  it('sets FK relationshipStyle with indigo dashed thin appearance', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    const relStyle = edges[0].data.relationshipStyle
    expect(relStyle).toMatchObject({
      color: expect.any(String),
      thickness: 1.5,
      dashed: true,
    })
  })

  it('sets FK column name as relationship description for edge label', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges[0].data.relationship).toMatchObject({ description: 'customer_id' })
  })

  it('uses computeHandlePair for dynamic handles when positions provided', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    // Source (t2) left of target (t1) → dx > 0 means right-b-source / left-b-target
    const posMap = new Map<string, { x: number; y: number }>()
    posMap.set('__table__db1__t2', { x: 0, y: 100 })
    posMap.set('__table__db1__t1', { x: 400, y: 100 })
    const edges = buildTableEdges('db1', tables, [manualEdge], posMap)
    expect(edges).toHaveLength(1)
    expect(edges[0].sourceHandle).toBe('right-b-source')
    expect(edges[0].targetHandle).toBe('left-b-target')
  })

  it('falls back to bottom/top handles when positions not provided', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges).toHaveLength(1)
    expect(edges[0].sourceHandle).toBe('bottom-b-source')
    expect(edges[0].targetHandle).toBe('top-b-target')
  })

  it('FK edges are selectable and reconnectable', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, [manualEdge])
    expect(edges[0].selectable).toBe(true)
    expect(edges[0].reconnectable).toBe(true)
  })

  it('auto-resolves FK edges from isForeignKey columns via naming convention', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const edges = buildTableEdges('db1', tables, undefined)
    expect(edges).toHaveLength(1)
    expect(edges[0].id).toContain('__fk_auto__')
    expect(edges[0].source).toBe('__table__db1__t2')
    expect(edges[0].target).toBe('__table__db1__t1')
    expect(edges[0].data.relationship).toMatchObject({ description: 'customer_id' })
  })

  it('defaults FK edge lineStyle to Orthogonal (ERD convention)', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    // Auto edge → Orthogonal
    const autoEdges = buildTableEdges('db1', tables, [manualEdge])
    expect(autoEdges[0].data.relationship.lineStyle).toBe('Orthogonal')
  })

  it('manual FK edge reads lineStyle from FkEdgeDef', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { id: 'col1', name: 'customer_id', type: 'int' },
        ],
      },
    ]
    const manualWithStyle = { ...manualEdge, lineStyle: 'Straight' as const }
    const edges = buildTableEdges('db1', tables, [manualWithStyle])
    expect(edges[0].data.relationship.lineStyle).toBe('Straight')
  })

  it('manual FK edges override auto-resolved edges for same pair', () => {
    const tables: TableDef[] = [
      {
        id: 't1', name: 'customers', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2', name: 'orders', columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const manualOverride = { id: 'fe1', sourceTableId: 't2', targetTableId: 't1', sourceColumnId: 'col-custom' }
    const edges = buildTableEdges('db1', tables, [manualOverride])
    expect(edges).toHaveLength(1)
    expect(edges[0].id).toContain('__fk_manual__')
  })
})
