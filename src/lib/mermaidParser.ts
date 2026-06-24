// Mermaid ERD parser — extracts table definitions and relationships from
// Mermaid ERD text. Parses only the subset c4hero needs: table blocks with
// column definitions and relationship lines. Everything else is ignored.
//
// Mermaid ERD syntax reference: https://mermaid.js.org/syntax/entityRelationshipDiagram.html

import { nanoid } from '@/store/internals'
import type { TableDef, ColumnDef } from '@/types/model'

export interface ERDRelationship {
  sourceTable: string
  targetTable: string
  label?: string
  sourceCardinality: string  // e.g. "||", "|o", "}o"
  targetCardinality: string  // e.g. "||", "o{", "o|"
}

export interface ERDParseResult {
  tables: TableDef[]
  relationships: ERDRelationship[]
  errors: string[]
}

/**
 * Parse Mermaid ERD text into table + relationship definitions.
 * Non-destructive: invalid lines are skipped with warnings in `errors`.
 */
export function parseMermaidERD(text: string): ERDParseResult {
  const errors: string[] = []
  const tables: TableDef[] = []
  const relationships: ERDRelationship[] = []

  const lines = text.split('\n')
  let inErDiagram = false
  let currentTable: { id: string; name: string; columns: ColumnDef[]; description?: string } | null = null
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('%%')) continue

    // Detect erDiagram block start
    if (/^erDiagram\b/i.test(line)) {
      inErDiagram = true
      continue
    }

    if (!inErDiagram) continue

    // Table block start: "table_name {"
    const tableStart = line.match(/^(\w[\w]*)\s*\{$/)
    if (tableStart && braceDepth === 0) {
      const name = tableStart[1]
      currentTable = {
        id: nanoid(),
        name,
        columns: [],
        description: undefined,
      }
      braceDepth = 1
      continue
    }

    // Inside table block: column definitions
    if (currentTable && braceDepth > 0) {
      // End of table block
      if (line === '}') {
        braceDepth--
        if (braceDepth === 0) {
          tables.push({
            id: currentTable.id,
            name: currentTable.name,
            columns: currentTable.columns,
            description: currentTable.description,
          })
          currentTable = null
        }
        continue
      }

      // Column definition: type name [PK] [FK] ["description"]
      // Type can include parens: VARCHAR(255), DECIMAL(12,2)
      const colMatch = line.match(
        /^([\w]+(?:\([^)]*\))?)\s+(\w[\w]*)\s*(PK|FK|PK FK|FK PK)?\s*(?:"([^"]*)")?\s*$/i,
      )
      if (colMatch) {
        const colType = colMatch[1]
        const colName = colMatch[2]
        const modifiers = (colMatch[3] || '').toUpperCase()
        const description = colMatch[4]

        currentTable.columns.push({
          name: colName,
          type: colType,
          primaryKey: modifiers.includes('PK'),
          nullable: true, // default; FK detection below can override
          foreignKey: modifiers.includes('FK') ? undefined : undefined,
          description,
        })
        continue
      }

      // If it doesn't look like a column, skip with warning
      if (line && line !== '{' && line !== '}') {
        errors.push(`Line ${i + 1}: unexpected content inside table "${currentTable.name}": ${line}`)
      }
      continue
    }

    // Relationship line: table1 ||--o{ table2 : "label"
    // Mermaid cardinalities: left side uses |, }, o; right side uses |, {, o
    const relMatch = line.match(
      /^(\w[\w]*)\s+([|}o])([o|])\s*(--|\.\.)\s*([o|])([{|o])\s+(\w[\w]*)\s*(?::\s*"([^"]*)")?\s*$/,
    )
    if (relMatch) {
      const [, srcTable, srcLeft, srcRight, , tgtLeft, tgtRight, tgtTable, label] = relMatch

      // Avoid duplicate relationships between same tables
      const exists = relationships.some(
        (r) =>
          (r.sourceTable === srcTable && r.targetTable === tgtTable) ||
          (r.sourceTable === tgtTable && r.targetTable === srcTable),
      )
      if (!exists) {
        relationships.push({
          sourceTable: srcTable,
          targetTable: tgtTable,
          label,
          sourceCardinality: srcLeft + srcRight,
          targetCardinality: tgtLeft + tgtRight,
        })
      }
      continue
    }

    // Unrecognized line outside table block — skip silently
  }

  // Handle unclosed table block
  if (currentTable && braceDepth > 0) {
    errors.push(`Unclosed table block for "${currentTable.name}"`)
    tables.push({
      id: currentTable.id,
      name: currentTable.name,
      columns: currentTable.columns,
      description: currentTable.description,
    })
  }

  return { tables, relationships, errors }
}

/**
 * Resolve FK references: for each FK column, try to find the target table
 * by matching column name patterns (e.g. "user_id" → "users.id").
 * Call this after parseMermaidERD if you want FK auto-resolution.
 */
export function resolveForeignKeys(
  result: ERDParseResult,
): void {
  const tableIndex = new Map<string, TableDef>()
  for (const t of result.tables) {
    tableIndex.set(t.name.toLowerCase(), t)
  }

  for (const table of result.tables) {
    for (const col of table.columns) {
      // Column is FK if it has "FK" in its modifiers (set during parse)
      // or if its name follows the convention: <table>_id
      const isFKConvention = /^(\w+)_id$/i.test(col.name)
      if (isFKConvention) {
        const refTableName = col.name.replace(/_id$/i, '')
        // Try singular→plural: user_id → users
        const candidates = [
          refTableName.toLowerCase(),
          refTableName.toLowerCase() + 's',  // user → users
          refTableName.toLowerCase().replace(/s$/, ''),  // orders → order
        ]
        for (const cand of candidates) {
          if (tableIndex.has(cand)) {
            col.foreignKey = `${cand}.id`
            break
          }
        }
      }
    }
  }
}
