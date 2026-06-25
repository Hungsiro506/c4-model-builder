import { describe, it, expect } from 'vitest'
import { parseMermaidERD, resolveForeignKeys, type ParsedMermaidERD } from './mermaidParser'
import type { TableDef } from '@/types/model'

// ─── parseMermaidERD ───────────────────────────────────────────────────

describe('parseMermaidERD', () => {
  it('parses a single table with columns', () => {
    const input = `erDiagram
  CUSTOMER {
    int id PK
    string name
    string email "contact email"
  }`

    const result = parseMermaidERD(input)
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('CUSTOMER')
    expect(result.tables[0].columns).toHaveLength(3)
    expect(result.tables[0].columns[0]).toEqual({
      name: 'id',
      type: 'int',
      isPrimaryKey: true,
    })
    expect(result.tables[0].columns[1]).toEqual({
      name: 'name',
      type: 'string',
    })
    expect(result.tables[0].columns[2]).toEqual({
      name: 'email',
      type: 'string',
      description: 'contact email',
    })
  })

  it('parses a column with FK flag', () => {
    const input = `erDiagram
  ORDERS {
    int id PK
    int customer_id FK
  }`

    const result = parseMermaidERD(input)
    expect(result.tables[0].columns[1]).toMatchObject({
      name: 'customer_id',
      type: 'int',
      isForeignKey: true,
    })
  })

  it('parses a column with both PK and FK', () => {
    const input = `erDiagram
  ORDER_ITEMS {
    int order_id PK FK
    int product_id PK FK
    int quantity
  }`

    const result = parseMermaidERD(input)
    expect(result.tables[0].columns[0]).toMatchObject({
      name: 'order_id',
      type: 'int',
      isPrimaryKey: true,
      isForeignKey: true,
    })
    expect(result.tables[0].columns[1]).toMatchObject({
      name: 'product_id',
      type: 'int',
      isPrimaryKey: true,
      isForeignKey: true,
    })
  })

  it('parses multiple tables', () => {
    const input = `erDiagram
  CUSTOMER {
    int id PK
    string name
  }
  ORDER {
    int id PK
    int customer_id FK
    date order_date
  }`

    const result = parseMermaidERD(input)
    expect(result.tables).toHaveLength(2)
    expect(result.tables[0].name).toBe('CUSTOMER')
    expect(result.tables[1].name).toBe('ORDER')
  })

  it('parses relationship lines with cardinality and label', () => {
    const input = `erDiagram
  CUSTOMER ||--o{ ORDER : "places"
  ORDER ||--|{ LINE_ITEM : contains`

    const result = parseMermaidERD(input)
    expect(result.relationships).toHaveLength(2)
    expect(result.relationships[0]).toEqual({
      sourceTable: 'CUSTOMER',
      destTable: 'ORDER',
      cardinality: '||--o{',
      label: 'places',
    })
    expect(result.relationships[1]).toEqual({
      sourceTable: 'ORDER',
      destTable: 'LINE_ITEM',
      cardinality: '||--|{',
      label: 'contains',
    })
  })

  it('parses relationship lines without labels', () => {
    const input = `erDiagram
  CUSTOMER ||--o{ ORDER : ""`

    const result = parseMermaidERD(input)
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0].label).toBeUndefined()
  })

  it('handles many-to-many cardinality', () => {
    const input = `erDiagram
  STUDENT }o--o{ COURSE : enrolls`

    const result = parseMermaidERD(input)
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0].cardinality).toBe('}o--o{')
  })

  it('handles one-to-one and one-to-zero-or-one cardinalities', () => {
    const input = `erDiagram
  USER ||--|| PROFILE : "has one"
  EMPLOYEE ||--o| PARKING_SPOT : "assigned"`

    const result = parseMermaidERD(input)
    expect(result.relationships).toHaveLength(2)
    expect(result.relationships[0].cardinality).toBe('||--||')
    expect(result.relationships[1].cardinality).toBe('||--o|')
  })

  it('supports table names with underscores and numbers', () => {
    const input = `erDiagram
  ORDER_ITEMS_V2 {
    int id PK
  }`

    const result = parseMermaidERD(input)
    expect(result.tables[0].name).toBe('ORDER_ITEMS_V2')
  })

  it('returns empty tables array for input with no table blocks', () => {
    const result = parseMermaidERD('erDiagram')
    expect(result.tables).toEqual([])
    expect(result.relationships).toEqual([])
  })

  it('returns empty tables for empty string', () => {
    const result = parseMermaidERD('')
    expect(result.tables).toEqual([])
  })

  it('ignores empty lines and comment-like lines', () => {
    const input = `erDiagram

  %% This is a comment
  CUSTOMER {
    int id PK
  }`

    const result = parseMermaidERD(input)
    expect(result.tables).toHaveLength(1)
  })

  it('handles column types with parentheses like varchar(255)', () => {
    const input = `erDiagram
  USERS {
    int id PK
    varchar(255) name
    decimal(10,2) price
  }`

    const result = parseMermaidERD(input)
    expect(result.tables[0].columns[1]).toMatchObject({
      name: 'name',
      type: 'varchar(255)',
    })
    expect(result.tables[0].columns[2]).toMatchObject({
      name: 'price',
      type: 'decimal(10,2)',
    })
  })

  it('handles quoted table names (backtick-quoted)', () => {
    const input = 'erDiagram\n' +
      '  `ORDER` {\n' +
      '    int id PK\n' +
      '  }'

    const result = parseMermaidERD(input)
    expect(result.tables[0].name).toBe('ORDER')
  })

  it('handles table descriptions', () => {
    const input = `erDiagram
  CUSTOMER {
    int id PK
    string name
  }`

    const result = parseMermaidERD(input)
    // Table description is just the table name for now
    expect(result.tables[0].name).toBe('CUSTOMER')
  })

  it('generates unique IDs for parsed tables', () => {
    const input = `erDiagram
  CUSTOMER {
    int id PK
  }
  ORDER {
    int id PK
  }`

    const result = parseMermaidERD(input)
    const ids = result.tables.map(t => t.id)
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it('parses table with PK and FK on different columns', () => {
    const input = `erDiagram
  ORDERS {
    int id PK
    int customer_id FK
    int shipping_address_id FK
    date order_date
  }`

    const result = parseMermaidERD(input)
    const pkCols = result.tables[0].columns.filter(c => c.isPrimaryKey)
    const fkCols = result.tables[0].columns.filter(c => c.isForeignKey)
    expect(pkCols).toHaveLength(1)
    expect(fkCols).toHaveLength(2)
    expect(pkCols[0].name).toBe('id')
    expect(fkCols[0].name).toBe('customer_id')
    expect(fkCols[1].name).toBe('shipping_address_id')
  })
})

// ─── resolveForeignKeys ────────────────────────────────────────────────

describe('resolveForeignKeys', () => {
  it('uses relationship lines to set FK flags on columns matching target table PK names', () => {
    const tables: TableDef[] = [
      {
        id: 't1',
        name: 'CUSTOMER',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'name', type: 'string' },
        ],
      },
      {
        id: 't2',
        name: 'ORDER',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int' },
          { name: 'order_date', type: 'date' },
        ],
      },
    ]
    const relationships: ParsedMermaidERD['relationships'] = [
      { sourceTable: 'CUSTOMER', destTable: 'ORDER', cardinality: '||--o{', label: 'places' },
    ]

    const resolved = resolveForeignKeys(tables, relationships)
    // customer_id in ORDER should become FK since CUSTOMER has id PK
    const orderTable = resolved.find(t => t.name === 'ORDER')!
    const fkCol = orderTable.columns.find(c => c.name === 'customer_id')!
    expect(fkCol.isForeignKey).toBe(true)
  })

  it('does not modify tables that already have explicit FK flags', () => {
    const tables: TableDef[] = [
      {
        id: 't1',
        name: 'CUSTOMER',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
        ],
      },
      {
        id: 't2',
        name: 'ORDER',
        columns: [
          { name: 'id', type: 'int', isPrimaryKey: true },
          { name: 'customer_id', type: 'int', isForeignKey: true },
        ],
      },
    ]
    const relationships: ParsedMermaidERD['relationships'] = [
      { sourceTable: 'CUSTOMER', destTable: 'ORDER', cardinality: '||--o{', label: 'places' },
    ]

    const resolved = resolveForeignKeys(tables, relationships)
    const orderTable = resolved.find(t => t.name === 'ORDER')!
    expect(orderTable.columns.find(c => c.name === 'customer_id')!.isForeignKey).toBe(true)
  })

  it('returns tables unchanged when relationships array is empty', () => {
    const tables: TableDef[] = [
      { id: 't1', name: 'T1', columns: [{ name: 'id', type: 'int', isPrimaryKey: true }] },
    ]
    const resolved = resolveForeignKeys(tables, [])
    expect(resolved).toEqual(tables)
  })
})
