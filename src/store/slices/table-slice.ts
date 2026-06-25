import type { StateCreator } from 'zustand'
import type { WorkspaceState } from '../workspace-types'
import type { TableDef, ColumnDef } from '@/types/model'
import { nanoid } from '../internals'

export type TableSlice = Pick<WorkspaceState,
  | 'tableData' | 'mermaidText' | 'selectedTable'
  | 'addTable' | 'updateTable' | 'deleteTable'
  | 'addColumn' | 'updateColumn' | 'deleteColumn'
  | 'moveColumn' | 'setTablesForContainer' | 'setMermaidText'
  | 'selectTable' | 'clearTableSelection'
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

  // ─── Table CRUD ──────────────────────────────────────────────────

  addTable: (containerId, name) => {
    const table: TableDef = {
      id: nanoid(),
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
    })
  },

  // ─── Column CRUD ─────────────────────────────────────────────────

  addColumn: (containerId, tableId, name, type) => {
    const col = { id: nanoid(), name, type } as ColumnDef & { id: string }
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
})
