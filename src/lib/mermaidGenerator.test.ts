import { describe, it, expect } from 'vitest'
import { generateMermaidERD } from './mermaidGenerator'
import { parseMermaidERD } from './mermaidParser'
import type { TableDef } from '@/types/model'

describe('generateMermaidERD', () => {
  it('generates erDiagram header', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'USERS', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    const result = generateMermaidERD(tables)
    expect(result.startsWith('erDiagram')).toBe(true)
  })

  it('generates table block with columns', () => {
    const tables: TableDef[] = [
      {
        id: 't1',
        name: 'CUSTOMER',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string', description: 'contact email' },
        ],
      },
    ]
    const result = generateMermaidERD(tables)
    expect(result).toContain('CUSTOMER {')
    expect(result).toContain('int id PK')
    expect(result).toContain('string name')
    expect(result).toContain('string email "contact email"')
    expect(result).toContain('}')
  })

  it('generates FK flag on columns', () => {
    const tables: TableDef[] = [
      {
        id: 't1',
        name: 'ORDERS',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const result = generateMermaidERD(tables)
    expect(result).toContain('int id PK')
    expect(result).toContain('int customer_id FK')
  })

  it('generates both PK and FK on composite key columns', () => {
    const tables: TableDef[] = [
      {
        id: 't1',
        name: 'ORDER_ITEMS',
        columns: [
          { name: 'order_id', type: 'int', isPrimaryKey: true, isForeignKey: true },
          { name: 'product_id', type: 'int', isPrimaryKey: true, isForeignKey: true },
          { name: 'quantity', type: 'int' },
        ],
      },
    ]
    const result = generateMermaidERD(tables)
    expect(result).toContain('int order_id PK FK')
    expect(result).toContain('int product_id PK FK')
    expect(result).toContain('int quantity')
  })

  it('generates multiple tables separated by blank lines', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'CUSTOMER', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
      { id: 't2', name: 'ORDER', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    const result = generateMermaidERD(tables)
    expect(result).toContain('CUSTOMER {')
    expect(result).toContain('ORDER {')
  })

  it('generates empty erDiagram for empty tables array', () => {
    const result = generateMermaidERD([])
    expect(result).toBe('erDiagram\n')
  })

  it('round-trips through parse → generate → parse produces equivalent tables', () => {
    const original = `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email "contact email"
  }
  ORDER {
    int id PK
    int customer_id FK
    date order_date
  }`

    const parsed = parseMermaidERD(original)
    const generated = generateMermaidERD(parsed.tables)
    const reparsed = parseMermaidERD(generated)

    expect(reparsed.tables).toHaveLength(parsed.tables.length)
    for (let i = 0; i < parsed.tables.length; i++) {
      expect(reparsed.tables[i].name).toBe(parsed.tables[i].name)
      expect(reparsed.tables[i].columns).toHaveLength(parsed.tables[i].columns.length)
      for (let j = 0; j < parsed.tables[i].columns.length; j++) {
        expect(reparsed.tables[i].columns[j].name).toBe(parsed.tables[i].columns[j].name)
        expect(reparsed.tables[i].columns[j].type).toBe(parsed.tables[i].columns[j].type)
        expect(reparsed.tables[i].columns[j].isPrimaryKey).toBe(parsed.tables[i].columns[j].isPrimaryKey)
        expect(reparsed.tables[i].columns[j].isForeignKey).toBe(parsed.tables[i].columns[j].isForeignKey)
        expect(reparsed.tables[i].columns[j].description).toBe(parsed.tables[i].columns[j].description)
      }
    }
  })

  it('handles tables with underscores and numbers in names', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'ORDER_ITEMS_V2', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    const result = generateMermaidERD(tables)
    expect(result).toContain('ORDER_ITEMS_V2 {')
  })
})
