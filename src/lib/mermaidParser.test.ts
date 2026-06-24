import { describe, it, expect } from 'vitest'
import { parseMermaidERD, resolveForeignKeys } from './mermaidParser'
import { generateMermaidERD } from './mermaidGenerator'
import type { ERDRelationship } from './mermaidParser'

describe('parseMermaidERD', () => {
  it('parses a simple table with columns', () => {
    const text = `erDiagram
    users {
        int id PK
        varchar name
        varchar email
    }`

    const result = parseMermaidERD(text)
    expect(result.errors).toHaveLength(0)
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('users')
    expect(result.tables[0].columns).toHaveLength(3)
    expect(result.tables[0].columns[0]).toMatchObject({ name: 'id', type: 'int', primaryKey: true })
    expect(result.tables[0].columns[1]).toMatchObject({ name: 'name', type: 'varchar', primaryKey: false })
    expect(result.tables[0].columns[2]).toMatchObject({ name: 'email', type: 'varchar', primaryKey: false })
  })

  it('parses FK modifiers', () => {
    const text = `erDiagram
    orders {
        int id PK
        int user_id FK
    }`

    const result = parseMermaidERD(text)
    expect(result.tables[0].columns[1]).toMatchObject({ name: 'user_id', type: 'int' })
  })

  it('parses PK FK combined modifier', () => {
    const text = `erDiagram
    join_table {
        int table1_id PK FK
        int table2_id PK FK
    }`

    const result = parseMermaidERD(text)
    expect(result.tables[0].columns[0]).toMatchObject({ name: 'table1_id', primaryKey: true })
    expect(result.tables[0].columns[1]).toMatchObject({ name: 'table2_id', primaryKey: true })
  })

  it('parses column descriptions', () => {
    const text = `erDiagram
    users {
        int id PK "Unique identifier"
        varchar email "User email address"
    }`

    const result = parseMermaidERD(text)
    expect(result.tables[0].columns[0].description).toBe('Unique identifier')
    expect(result.tables[0].columns[1].description).toBe('User email address')
  })

  it('parses multiple tables', () => {
    const text = `erDiagram
    users {
        int id PK
        varchar name
    }

    orders {
        int id PK
        int user_id FK
        decimal total
    }`

    const result = parseMermaidERD(text)
    expect(result.tables).toHaveLength(2)
    expect(result.tables[0].name).toBe('users')
    expect(result.tables[1].name).toBe('orders')
  })

  it('parses relationship lines', () => {
    const text = `erDiagram
    users {
        int id PK
    }
    orders {
        int id PK
        int user_id FK
    }
    users ||--o{ orders : "places"`

    const result = parseMermaidERD(text)
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0]).toMatchObject({
      sourceTable: 'users',
      targetTable: 'orders',
      label: 'places',
      sourceCardinality: '||',
      targetCardinality: 'o{',
    })
  })

  it('parses relationship without label', () => {
    const text = `erDiagram
    users {
        int id PK
    }
    orders {
        int id PK
    }
    users ||--o{ orders`

    const result = parseMermaidERD(text)
    expect(result.relationships[0].label).toBeUndefined()
  })

  it('skips comments and empty lines', () => {
    const text = `%% This is a comment
erDiagram

    %% Another comment
    users {
        int id PK
    }`

    const result = parseMermaidERD(text)
    expect(result.errors).toHaveLength(0)
    expect(result.tables).toHaveLength(1)
  })

  it('ignores content outside erDiagram blocks', () => {
    const text = `some random text
erDiagram
    users {
        int id PK
    }`

    const result = parseMermaidERD(text)
    expect(result.tables).toHaveLength(1)
  })

  it('reports errors for unexpected content in table block', () => {
    const text = `erDiagram
    users {
        int id PK
        this line makes no sense
        varchar name
    }`

    const result = parseMermaidERD(text)
    expect(result.errors.length).toBeGreaterThan(0)
    // Should still parse the valid columns
    expect(result.tables[0].columns).toHaveLength(2)
  })

  it('handles empty table (no columns)', () => {
    const text = `erDiagram
    empty_table {
    }`

    const result = parseMermaidERD(text)
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('empty_table')
    expect(result.tables[0].columns).toHaveLength(0)
  })

  it('handles empty input', () => {
    const result = parseMermaidERD('')
    expect(result.tables).toHaveLength(0)
    expect(result.relationships).toHaveLength(0)
  })

  it('handles input without erDiagram header', () => {
    const result = parseMermaidERD('users { int id PK }')
    expect(result.tables).toHaveLength(0)
  })

  it('reports unclosed table block', () => {
    const text = `erDiagram
    users {
        int id PK`

    const result = parseMermaidERD(text)
    expect(result.errors.length).toBeGreaterThan(0)
    // Should still include the partially-parsed table
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('users')
  })

  it('handles types with parentheses like VARCHAR(255)', () => {
    const text = `erDiagram
    users {
        int id PK
        varchar(255) name
        decimal(12,2) amount
    }`

    const result = parseMermaidERD(text)
    expect(result.tables[0].columns[1].type).toBe('varchar(255)')
    expect(result.tables[0].columns[2].type).toBe('decimal(12,2)')
  })
})

describe('resolveForeignKeys', () => {
  it('resolves user_id FK to users.id', () => {
    const text = `erDiagram
    users {
        int id PK
    }
    orders {
        int id PK
        int user_id FK
    }
    users ||--o{ orders`

    const result = parseMermaidERD(text)
    resolveForeignKeys(result)

    const orders = result.tables.find((t) => t.name === 'orders')!
    const userCol = orders.columns.find((c) => c.name === 'user_id')!
    expect(userCol.foreignKey).toBe('users.id')
  })

  it('resolves plural table names (order_id → orders.id)', () => {
    const text = `erDiagram
    items {
        int id PK
        int order_id FK
    }
    orders {
        int id PK
    }`

    const result = parseMermaidERD(text)
    resolveForeignKeys(result)

    const items = result.tables.find((t) => t.name === 'items')!
    const orderCol = items.columns.find((c) => c.name === 'order_id')!
    expect(orderCol.foreignKey).toBe('orders.id')
  })

  it('does not resolve non-convention column names', () => {
    const text = `erDiagram
    users {
        int id PK
        varchar ref_code
    }`

    const result = parseMermaidERD(text)
    resolveForeignKeys(result)

    const users = result.tables[0]
    const refCol = users.columns.find((c) => c.name === 'ref_code')!
    expect(refCol.foreignKey).toBeUndefined()
  })
})

describe('generateMermaidERD', () => {
  it('generates valid ERD from tables', () => {
    const tables = [
      {
        id: 't1',
        name: 'users',
        columns: [
          { name: 'id', type: 'int', primaryKey: true, nullable: false },
          { name: 'name', type: 'varchar', primaryKey: false, nullable: true },
        ],
      },
    ]
    const relationships: ERDRelationship[] = []

    const text = generateMermaidERD(tables, relationships)
    expect(text).toContain('erDiagram')
    expect(text).toContain('users {')
    expect(text).toContain('int id PK')
    expect(text).toContain('varchar name')
  })

  it('generates FK modifiers', () => {
    const tables = [
      {
        id: 't1',
        name: 'orders',
        columns: [
          { name: 'id', type: 'int', primaryKey: true, nullable: false },
          { name: 'user_id', type: 'int', primaryKey: false, nullable: false, foreignKey: 'users.id' },
        ],
      },
    ]

    const text = generateMermaidERD(tables, [])
    expect(text).toContain('int user_id FK')
  })

  it('generates PK FK combined', () => {
    const tables = [
      {
        id: 't1',
        name: 'join_table',
        columns: [
          { name: 'table1_id', type: 'int', primaryKey: true, nullable: false, foreignKey: 'table1.id' },
        ],
      },
    ]

    const text = generateMermaidERD(tables, [])
    expect(text).toContain('int table1_id PK FK')
  })

  it('generates relationship lines', () => {
    const tables = [
      { id: 't1', name: 'users', columns: [] },
      { id: 't2', name: 'orders', columns: [] },
    ]
    const relationships: ERDRelationship[] = [
      { sourceTable: 'users', targetTable: 'orders', sourceCardinality: '||', targetCardinality: 'o{', label: 'places' },
    ]

    const text = generateMermaidERD(tables, relationships)
    expect(text).toContain('users ||--o{ orders : "places"')
  })

  it('generates relationship without label', () => {
    const tables = [
      { id: 't1', name: 'users', columns: [] },
      { id: 't2', name: 'orders', columns: [] },
    ]
    const relationships: ERDRelationship[] = [
      { sourceTable: 'users', targetTable: 'orders', sourceCardinality: '||', targetCardinality: 'o{' },
    ]

    const text = generateMermaidERD(tables, relationships)
    expect(text).toContain('users ||--o{ orders')
    expect(text).not.toContain(':')
  })

  it('round-trip: parse then generate then parse is stable', () => {
    const input = `erDiagram
    orders {
        int id PK
        int user_id FK
        decimal total
        varchar status
    }
    users {
        int id PK
        varchar email
        varchar name
    }

    users ||--o{ orders : "places"
`
    const parsed = parseMermaidERD(input)
    const relationships: ERDRelationship[] = [
      { sourceTable: 'users', targetTable: 'orders', sourceCardinality: '||', targetCardinality: 'o{', label: 'places' },
    ]
    const generated = generateMermaidERD(parsed.tables, relationships)
    const reparsed = parseMermaidERD(generated)

    // Tables should match
    expect(reparsed.tables).toHaveLength(2)
    // Sorted alphabetically: orders, users
    expect(reparsed.tables[0].name).toBe('orders')
    expect(reparsed.tables[1].name).toBe('users')
    expect(reparsed.tables[0].columns).toHaveLength(4)
    expect(reparsed.tables[1].columns).toHaveLength(3)
    // Relationships
    expect(reparsed.relationships).toHaveLength(1)
  })

  it('handles empty tables array', () => {
    const text = generateMermaidERD([], [])
    expect(text.trim()).toBe('erDiagram')
  })

  it('handles empty columns (empty table)', () => {
    const tables = [{ id: 't1', name: 'empty_table', columns: [] }]
    const text = generateMermaidERD(tables, [])
    expect(text).toContain('empty_table {')
    expect(text).toContain('}')
  })

  it('generates column descriptions when present', () => {
    const tables = [
      {
        id: 't1',
        name: 'users',
        columns: [
          { name: 'id', type: 'int', primaryKey: true, nullable: false, description: 'The primary key' },
          { name: 'name', type: 'varchar', primaryKey: false, nullable: true },
        ],
      },
    ]

    const text = generateMermaidERD(tables, [])
    expect(text).toContain('int id PK "The primary key"')
    // Second column should NOT have a description
    expect(text).toContain('varchar name')
    expect(text).not.toContain('varchar name "')
  })

  it('output is deterministic (same input = same output)', () => {
    const tables = [
      { id: 't1', name: 'zebra', columns: [{ name: 'id', type: 'int', primaryKey: true, nullable: false }] },
      { id: 't2', name: 'alpha', columns: [{ name: 'id', type: 'int', primaryKey: true, nullable: false }] },
    ]

    const a = generateMermaidERD(tables, [])
    const b = generateMermaidERD(tables, [])
    expect(a).toBe(b)
    // alpha should come before zebra (sorted)
    expect(a.indexOf('alpha')).toBeLessThan(a.indexOf('zebra'))
  })
})
