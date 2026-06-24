// Mermaid ERD text generator — produces canonical Mermaid ERD text from
// table definitions and relationships. Deterministic output (sorted tables
// and columns) so it diffs cleanly.

import type { TableDef, ColumnDef } from '@/types/model'
import type { ERDRelationship } from './mermaidParser'

/**
 * Generate Mermaid ERD text from table and relationship definitions.
 * Output is deterministic: tables sorted alphabetically, columns in order.
 */
export function generateMermaidERD(
  tables: TableDef[],
  relationships: ERDRelationship[],
): string {
  const lines: string[] = ['erDiagram']

  // Sort tables by name for deterministic output
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name))

  for (const table of sorted) {
    if (table.columns.length === 0) {
      lines.push(`    ${table.name} {`)
      lines.push(`    }`)
    } else {
      lines.push(`    ${table.name} {`)
      for (const col of table.columns) {
        const modifiers = buildModifiers(col)
        const desc = col.description ? ` "${col.description}"` : ''
        lines.push(`        ${col.type} ${col.name}${modifiers}${desc}`)
      }
      lines.push(`    }`)
    }
    lines.push('')
  }

  // Generate relationship lines
  for (const rel of relationships) {
    const label = rel.label ? ` : "${rel.label}"` : ''
    lines.push(
      `    ${rel.sourceTable} ${rel.sourceCardinality}--${rel.targetCardinality} ${rel.targetTable}${label}`,
    )
  }

  return lines.join('\n') + '\n'
}

function buildModifiers(col: ColumnDef): string {
  const parts: string[] = []
  if (col.primaryKey) parts.push('PK')
  if (col.foreignKey) parts.push('FK')
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}
