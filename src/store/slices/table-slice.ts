import type { StateCreator } from 'zustand'
import type { WorkspaceState } from '../workspace-types'
import type { TableDef, ColumnDef, FkEdgeDef } from '@/types/model'
import { nanoid } from '../internals'

/** UUID v7 for sidecar-only IDs (tables, columns, FK edges).
 *  These never go into DSL so hyphens are safe. */
function uuid(): string {
  return crypto.randomUUID()
}

export type TableSlice = Pick<WorkspaceState,
  | 'tableData' | 'mermaidText' | 'selectedTable' | 'fkEdges'
  | 'addTable' | 'updateTable' | 'deleteTable'
  | 'addColumn' | 'updateColumn' | 'deleteColumn'
  | 'moveColumn' | 'setTablesForContainer' | 'setMermaidText'
  | 'selectTable' | 'clearTableSelection'
  | 'addFkEdge' | 'updateFkEdge' | 'deleteFkEdge'
>

export const createTableSlice: StateCreator<
  WorkspaceState,
  [['zustand/immer', never]],
  [],
  TableSlice
> = (set) => ({
  tableData: {},
  mermaidText: {},
  selectedTable: null,
  fkEdges: {},

  // ─── Table CRUD ──────────────────────────────────────────────────

  addTable: (containerId, name) => {
    const table: TableDef = {
      id: uuid(),
      name,
      columns: [],
    }
    set((s) => {
      if (!s.tableData[containerId]) {
        s.tableData[containerId] = []
      }
      s.tableData[containerId].push(table)
    })
    return table
  },

  updateTable: (containerId, tableId, patch) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const idx = tables.findIndex(t => t.id === tableId)
      if (idx === -1) return
      if (patch.name !== undefined) tables[idx].name = patch.name
      if (patch.description !== undefined) tables[idx].description = patch.description
    })
  },

  deleteTable: (containerId, tableId) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      s.tableData[containerId] = tables.filter(t => t.id !== tableId)
      // Cascade: remove FK edges referencing the deleted table
      const edges = s.fkEdges[containerId]
      if (edges) {
        s.fkEdges[containerId] = edges.filter(
          e => e.sourceTableId !== tableId && e.targetTableId !== tableId,
        )
      }
    })
  },

  // ─── Column CRUD ─────────────────────────────────────────────────

  addColumn: (containerId, tableId, name, type) => {
    const col = { id: uuid(), name, type } as ColumnDef & { id: string }
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find(t => t.id === tableId)
      if (!table) return
      table.columns.push(col)
    })
    return col
  },

  updateColumn: (containerId, tableId, columnId, patch) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find(t => t.id === tableId)
      if (!table) return
      const col = table.columns.find(c => 'id' in c && (c as ColumnDef & { id: string }).id === columnId)
      // ColumnDefs from API (addColumn) have ids; parsed ones may not. For mutable CRUD
      // all columns should have ids. Fall back to index-based lookup for safety.
      if (!col) return
      if (patch.name !== undefined) col.name = patch.name
      if (patch.type !== undefined) col.type = patch.type
      if (patch.isPrimaryKey !== undefined) col.isPrimaryKey = patch.isPrimaryKey
      if (patch.isForeignKey !== undefined) col.isForeignKey = patch.isForeignKey
      if (patch.description !== undefined) col.description = patch.description
    })
  },

  deleteColumn: (containerId, tableId, columnId) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find(t => t.id === tableId)
      if (!table) return
      table.columns = table.columns.filter(c =>
        !('id' in c) || (c as ColumnDef & { id: string }).id !== columnId,
      )
      // Cascade: clear FK edge column refs pointing to the deleted column
      const edges = s.fkEdges[containerId]
      if (edges) {
        for (const e of edges) {
          if (e.sourceColumnId === columnId) e.sourceColumnId = undefined
          if (e.targetColumnId === columnId) e.targetColumnId = undefined
        }
      }
    })
  },

  moveColumn: (containerId, tableId, columnId, toIndex) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find(t => t.id === tableId)
      if (!table) return
      const fromIndex = table.columns.findIndex(c =>
        'id' in c && (c as ColumnDef & { id: string }).id === columnId,
      )
      if (fromIndex === -1 || fromIndex === toIndex) return
      const [col] = table.columns.splice(fromIndex, 1)
      table.columns.splice(toIndex, 0, col)
    })
  },

  // ─── Bulk operations ─────────────────────────────────────────────

  setTablesForContainer: (containerId, tables) => {
    set((s) => {
      s.tableData[containerId] = tables
    })
  },

  setMermaidText: (containerId, text) => {
    set((s) => {
      s.mermaidText[containerId] = text
    })
  },

  // ─── Table selection (canvas-driven) ─────────────────────────────

  selectTable: (containerId, tableId) => {
    set((s) => {
      s.selectedTable = { containerId, tableId }
    })
  },

  clearTableSelection: () => {
    set((s) => {
      s.selectedTable = null
    })
  },

  // ─── FK Edge CRUD ─────────────────────────────────────────────────

  addFkEdge: (containerId, sourceTableId, targetTableId, sourceColumnId) => {
    const fkEdge: FkEdgeDef = {
      id: uuid(),
      sourceTableId,
      targetTableId,
    }
    set((s) => {
      if (!s.fkEdges[containerId]) {
        s.fkEdges[containerId] = []
      }
      // Avoid duplicate: same source→target already exists
      const existing = s.fkEdges[containerId].find(
        e => e.sourceTableId === sourceTableId && e.targetTableId === targetTableId,
      )
      if (existing) return

      // sourceColumnId: use explicit param, or auto-resolve to first FK column
      const sourceTables = s.tableData[containerId]
      if (sourceColumnId) {
        fkEdge.sourceColumnId = sourceColumnId
      } else if (sourceTables) {
        const srcTable = sourceTables.find(t => t.id === sourceTableId)
        if (srcTable) {
          const fkCol = srcTable.columns.find(c => c.isForeignKey && 'id' in c)
          if (fkCol && 'id' in fkCol) {
            fkEdge.sourceColumnId = (fkCol as ColumnDef & { id: string }).id
          }
        }
      }
      // Auto-resolve targetColumnId: first PK column in target table
      if (sourceTables) {
        const tgtTable = sourceTables.find(t => t.id === targetTableId)
        if (tgtTable) {
          const pkCol = tgtTable.columns.find(c => c.isPrimaryKey && 'id' in c)
          if (pkCol && 'id' in pkCol) {
            fkEdge.targetColumnId = (pkCol as ColumnDef & { id: string }).id
          }
        }
      }

      s.fkEdges[containerId].push(fkEdge)
    })
    return fkEdge
  },

  updateFkEdge: (containerId, fkEdgeId, patch) => {
    set((s) => {
      const edges = s.fkEdges[containerId]
      if (!edges) return
      const edge = edges.find(e => e.id === fkEdgeId)
      if (!edge) return
      if (patch.sourceColumnId !== undefined) edge.sourceColumnId = patch.sourceColumnId
      if (patch.targetColumnId !== undefined) edge.targetColumnId = patch.targetColumnId
    })
  },

  deleteFkEdge: (containerId, fkEdgeId) => {
    set((s) => {
      const edges = s.fkEdges[containerId]
      if (!edges) return
      s.fkEdges[containerId] = edges.filter(e => e.id !== fkEdgeId)
    })
  },
})
