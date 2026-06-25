import type { TableDef, ColumnDef } from '@/types/model'
import { nanoid } from '@/store/internals'

// ─── Types ─────────────────────────────────────────────────────────────

export interface MermaidRelation {
  sourceTable: string
  destTable: string
  cardinality: string
  label?: string
}

export interface ParsedMermaidERD {
  tables: TableDef[]
  relationships: MermaidRelation[]
}

// ─── Cardinality pattern ───────────────────────────────────────────────

// Each side of a Mermaid ERD cardinality: || o| |o o{ }o |{ }|
const CARD_SIDE = '(?:\\|\\||o\\||\\|o|o\\{|\\}o|\\|\\{|\\}\\|)'

const RELATIONSHIP_RE = new RegExp(
  `^\\s*(\\S+)\\s+(${CARD_SIDE}--${CARD_SIDE})\\s+(\\S+)\\s*:\\s*(?:"([^"]*)"|(\\S+))?\\s*$`,
)

// ─── Parse Mermaid ERD ─────────────────────────────────────────────────

/**
 * Parse a Mermaid ERD string into tables and relationships.
 * Handles the subset we need: table blocks with columns and relationship lines.
 */
export function parseMermaidERD(input: string): ParsedMermaidERD {
  const tables: TableDef[] = []
  const relationships: MermaidRelation[] = []

  if (!input || !input.trim()) {
    return { tables, relationships }
  }

  const lines = input.split('\n')

  // State machine: track whether we're inside a table block
  let currentTable: TableDef | null = null
  let currentColumns: ColumnDef[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip empty lines, erDiagram header, and %% comments
    if (!line || line === 'erDiagram' || line.startsWith('%%')) {
      // If we were building a table block, finalize it on empty line or erDiagram
      if (currentTable && (line === 'erDiagram' || !line)) {
        currentTable.columns = currentColumns
        tables.push(currentTable)
        currentTable = null
        currentColumns = []
      }
      continue
    }

    // Try to parse a relationship line.
    // Must not be a table-block opening (TABLE_NAME {).
    const isTableBlockStart = /^\s*(`?[\w]+`?)\s*\{\s*$/.test(line)
    const relMatch = line.match(RELATIONSHIP_RE)
    if (relMatch && !isTableBlockStart) {
      // Finalize any open table block before processing a relationship
      if (currentTable) {
        currentTable.columns = currentColumns
        tables.push(currentTable)
        currentTable = null
        currentColumns = []
      }

      const [, source, cardinality, dest, quotedLabel, unquotedLabel] = relMatch
      // Unwrap backtick-quoted table names
      const sourceTable = source.replace(/^`|`$/g, '')
      const destTable = dest.replace(/^`|`$/g, '')
      const label = quotedLabel !== undefined ? quotedLabel : (unquotedLabel || undefined)
      relationships.push({
        sourceTable,
        destTable,
        cardinality,
        label: label || undefined,
      })
      continue
    }

    // Try to parse table start: TABLE_NAME {
    const tableStartMatch = line.match(/^(`?[\w]+`?)\s*\{\s*$/)
    if (tableStartMatch) {
      // Finalize previous table if any
      if (currentTable) {
        currentTable.columns = currentColumns
        tables.push(currentTable)
        currentColumns = []
      }

      const tableName = tableStartMatch[1].replace(/^`|`$/g, '')
      currentTable = {
        id: nanoid(),
        name: tableName,
        columns: [],
      }
      continue
    }

    // Try to parse column inside a table block: type name [PK] [FK] ["description"]
    if (currentTable && line !== '}') {
      const colMatch = line.match(
        /^(\w+(?:\([^)]*\))?)\s+(\S+)(?:\s+(PK))?(?:\s+(FK))?(?:\s+"([^"]*)")?\s*$/
      )
      if (colMatch) {
        const [, type, name, pk, fk, description] = colMatch
        const col: ColumnDef = {
          name,
          type,
          isPrimaryKey: pk === 'PK' ? true : undefined,
          isForeignKey: fk === 'FK' ? true : undefined,
          description: description || undefined,
        }
        currentColumns.push(col)
      }
      continue
    }

    // Table block closing brace
    if (currentTable && line === '}') {
      currentTable.columns = currentColumns
      tables.push(currentTable)
      currentTable = null
      currentColumns = []
      continue
    }
  }

  // Finalize any remaining open table block (no closing brace)
  if (currentTable) {
    currentTable.columns = currentColumns
    tables.push(currentTable)
  }

  return { tables, relationships }
}

// ─── Resolve Foreign Keys from Relationships ───────────────────────────

/**
 * Use relationship lines to set isForeignKey on columns that match
 * a related table's primary key naming convention (e.g., `customer_id` in
 * ORDER when CUSTOMER has a PK `id`).
 *
 * Does NOT overwrite existing explicit FK flags.
 */
export function resolveForeignKeys(
  tables: TableDef[],
  relationships: MermaidRelation[],
): TableDef[] {
  if (!relationships.length) return tables

  const tableMap = new Map<string, TableDef>()
  const pkMap = new Map<string, Set<string>>() // table name → set of PK column names

  for (const t of tables) {
    tableMap.set(t.name, t)
    const pkNames = new Set(t.columns.filter(c => c.isPrimaryKey).map(c => c.name))
    if (pkNames.size > 0) {
      pkMap.set(t.name, pkNames)
    }
  }

  for (const rel of relationships) {
    const sourcePKs = pkMap.get(rel.sourceTable)
    const destTable = tableMap.get(rel.destTable)
    const sourceTable = tableMap.get(rel.sourceTable)
    const destPKs = pkMap.get(rel.destTable)

    // For each relationship source→dest:
    // Columns in dest matching source PK names get FK flag
    if (sourcePKs && destTable) {
      for (const col of destTable.columns) {
        if (!col.isForeignKey) {
          // Check if this column name matches a pattern referencing source table PK
          for (const pkName of sourcePKs) {
            const expectedFkName = `${rel.sourceTable.toLowerCase()}_${pkName}`
            if (col.name === expectedFkName || col.name === `${pkName}`) {
              col.isForeignKey = true
            }
          }
        }
      }
    }

    // Symmetric: columns in source matching dest PK names
    if (destPKs && sourceTable) {
      for (const col of sourceTable.columns) {
        if (!col.isForeignKey) {
          for (const pkName of destPKs) {
            const expectedFkName = `${rel.destTable.toLowerCase()}_${pkName}`
            if (col.name === expectedFkName || col.name === `${pkName}`) {
              col.isForeignKey = true
            }
          }
        }
      }
    }
  }

  return tables
}
