import { describe, expect, it } from 'vitest'
import { buildNodes, isDatabaseContainer, tableNodeId, getTableNodeSize, buildTableNode, buildParentMap } from './canvasBuilders'
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

  it('returns a React Flow node of type "table"', () => {
    const td: TableDef = { id: 't1', name: 'Users', columns: [] }
    const container: ModelElement = {
      id: 'c1', type: 'container', name: 'DB', tags: ['Element', 'Container', 'Database'],
      properties: {}, components: [],
    }
    const node = buildTableNode(td, 'c1', container, { x: 10, y: 20 }, ctx)
    expect(node.type).toBe('table')
    expect(node.id).toBe('__table__c1__t1')
    expect(node.position).toEqual({ x: 10, y: 20 })
    expect(node.data.tableDef).toBe(td)
    expect(node.data.containerId).toBe('c1')
    expect(node.data.style).toBeUndefined() // no style in empty index
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
