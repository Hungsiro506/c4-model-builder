import { describe, it, expect } from 'vitest'
import { resolveTableFKs } from '@/components/canvas/canvasBuilders'
import type { TableDef, FkEdgeDef } from '@/types/model'

/**
 * Core FK lookup logic tested in isolation — mirrors what TableEditor does
 * when looking up the target table for a column's FK dropdown.
 *
 *   const fkEdge = fkEdges.find(e => e.sourceTableId === tableId && e.sourceColumnId === colId)
 *   if (!fkEdge) {
 *     const pairs = resolveTableFKs(tableData)
 *     const match = pairs.find(p => p.sourceTableId === tableId && p.sourceColumnId === colId)
 *     if (match) { resolvedTargetId = match.targetTableId }
 *   }
 */
function resolveFkTarget(
  tableId: string,
  colId: string,
  tableData: TableDef[],
  fkEdges: FkEdgeDef[],
): { targetTableId: string | null; targetColumnId: string | null; source: 'persisted' | 'auto' | 'none' } {
  // 1. Try persisted FK edges
  const fkEdge = fkEdges.find(
    e => e.sourceTableId === tableId && e.sourceColumnId === colId,
  )
  if (fkEdge) {
    return {
      targetTableId: fkEdge.targetTableId,
      targetColumnId: fkEdge.targetColumnId ?? null,
      source: 'persisted',
    }
  }

  // 2. Fall back to auto-resolution via naming convention
  const pairs = resolveTableFKs(tableData)
  const match = pairs.find(
    p => p.sourceTableId === tableId && p.sourceColumnId === colId,
  )
  if (match) {
    return {
      targetTableId: match.targetTableId,
      targetColumnId: match.targetColumnId,
      source: 'auto',
    }
  }

  return { targetTableId: null, targetColumnId: null, source: 'none' }
}

describe('resolveFkTarget (TableEditor FK dropdown logic)', () => {
  const customers: TableDef = {
    id: 't1', name: 'customers',
    columns: [
      { id: 'c1', name: 'id', type: 'int', isPrimaryKey: true },
    ],
  }
  const orders: TableDef = {
    id: 't2', name: 'orders',
    columns: [
      { id: 'c2', name: 'id', type: 'int', isPrimaryKey: true },
      { id: 'c3', name: 'customer_id', type: 'int', isForeignKey: true },
    ],
  }
  const tableData = [customers, orders]

  it('finds target from persisted FK edge by sourceColumnId', () => {
    const fkEdges: FkEdgeDef[] = [
      { id: 'fe1', sourceTableId: 't2', targetTableId: 't1', sourceColumnId: 'c3' },
    ]
    const result = resolveFkTarget('t2', 'c3', tableData, fkEdges)
    expect(result.targetTableId).toBe('t1')
    expect(result.source).toBe('persisted')
  })

  it('falls back to auto-resolution when no persisted FK edge exists', () => {
    const result = resolveFkTarget('t2', 'c3', tableData, [])
    expect(result.targetTableId).toBe('t1')
    expect(result.source).toBe('auto')
  })

  it('returns none when neither persisted nor auto-resolution finds a match', () => {
    const result = resolveFkTarget('t2', 'nonexistent', tableData, [])
    expect(result.targetTableId).toBeNull()
    expect(result.source).toBe('none')
  })

  it('prefers persisted FK edge over auto-resolution when both exist', () => {
    const fkEdges: FkEdgeDef[] = [
      { id: 'fe1', sourceTableId: 't2', targetTableId: 't1', sourceColumnId: 'c3' },
    ]
    const result = resolveFkTarget('t2', 'c3', tableData, fkEdges)
    expect(result.source).toBe('persisted')
  })

  it('handles column without isForeignKey (resolveTableFKs skips it)', () => {
    // Column c2 (orders.id) is not FK — should not resolve
    const result = resolveFkTarget('t2', 'c2', tableData, [])
    expect(result.targetTableId).toBeNull()
    expect(result.source).toBe('none')
  })

  it('handles missing sourceColumnId in FK edge — falls back to auto', () => {
    // FK edge without sourceColumnId can't be found by the precise lookup
    const fkEdges: FkEdgeDef[] = [
      { id: 'fe1', sourceTableId: 't2', targetTableId: 't1' },
    ]
    // Lookup by sourceColumnId fails → falls back to auto-resolution
    const result = resolveFkTarget('t2', 'c3', tableData, fkEdges)
    expect(result.targetTableId).toBe('t1')
    expect(result.source).toBe('auto')
  })
})
