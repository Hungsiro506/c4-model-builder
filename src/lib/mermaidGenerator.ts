import type { TableDef } from '@/types/model'

/**
 * Generate a Mermaid ERD string from table definitions.
 * Output is a valid `erDiagram` block that round-trips through parseMermaidERD.
 */
export function generateMermaidERD(tables: TableDef[]): string {
  const lines: string[] = ['erDiagram']

  for (const table of tables) {
    if (lines.length > 1) {
      lines.push('') // blank line between tables
    }
    lines.push(`  ${table.name} {`)
    for (const col of table.columns) {
      const flags: string[] = []
      if (col.isPrimaryKey) flags.push('PK')
      if (col.isForeignKey) flags.push('FK')
      const flagStr = flags.length > 0 ? ` ${flags.join(' ')}` : ''
      const descStr = col.description ? ` "${col.description}"` : ''
      lines.push(`    ${col.type} ${col.name}${flagStr}${descStr}`)
    }
    lines.push('  }')
  }

  return lines.join('\n') + '\n'
}
