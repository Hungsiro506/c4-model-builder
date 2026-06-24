// Table data store slice — manages database table definitions (sidecar-only
// metadata, never serialized to DSL). Tables are keyed by container ID.

import type { StateCreator } from 'zustand'
import type { WorkspaceState } from '../workspace-types'
import type { TableDef, ColumnDef } from '@/types/model'
import { nanoid } from '../internals'

export type TableSlice = Pick<WorkspaceState,
  | 'tableData'
  | 'mermaidText'
  | 'mermaidOverlayContainerId'
  | 'setMermaidOverlayContainerId'
  | 'addTable'
  | 'updateTable'
  | 'deleteTable'
  | 'addColumn'
  | 'updateColumn'
  | 'deleteColumn'
  | 'moveColumn'
  | 'setTablesForContainer'
  | 'setMermaidText'
>

const DEFAULT_COLUMN: ColumnDef = {
  name: 'id',
  type: 'INT',
  primaryKey: true,
  nullable: false,
}

export const createTableSlice: StateCreator<
  WorkspaceState,
  [['zustand/immer', never]],
  [],
  TableSlice
> = (set) => ({
  tableData: {},
  mermaidText: {},
  mermaidOverlayContainerId: null,
  setMermaidOverlayContainerId: (containerId) => set({ mermaidOverlayContainerId: containerId }),

  addTable: (containerId, name) => {
    const id = nanoid()
    set((s) => {
      const tables = s.tableData[containerId] ?? []
      s.tableData[containerId] = [
        ...tables,
        {
          id,
          name,
          description: '',
          columns: [{ ...DEFAULT_COLUMN }],
        },
      ]
    })
    return id
  },

  updateTable: (containerId, tableId, patch) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const idx = tables.findIndex((t) => t.id === tableId)
      if (idx === -1) return
      if (patch.name !== undefined) tables[idx].name = patch.name
      if (patch.description !== undefined) tables[idx].description = patch.description
    })
  },

  deleteTable: (containerId, tableId) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      s.tableData[containerId] = tables.filter((t) => t.id !== tableId)
      if (s.tableData[containerId].length === 0) {
        delete s.tableData[containerId]
      }
    })
  },

  addColumn: (containerId, tableId) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      table.columns.push({
        name: '',
        type: 'VARCHAR(255)',
        primaryKey: false,
        nullable: true,
      })
    })
  },

  updateColumn: (containerId, tableId, columnIndex, patch) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      const col = table.columns[columnIndex]
      if (!col) return
      if (patch.name !== undefined) col.name = patch.name
      if (patch.type !== undefined) col.type = patch.type
      if (patch.primaryKey !== undefined) col.primaryKey = patch.primaryKey
      if (patch.nullable !== undefined) col.nullable = patch.nullable
      if (patch.foreignKey !== undefined) col.foreignKey = patch.foreignKey
      if (patch.defaultValue !== undefined) col.defaultValue = patch.defaultValue
      if (patch.description !== undefined) col.description = patch.description
    })
  },

  deleteColumn: (containerId, tableId, columnIndex) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      // Refuse to delete the last column
      if (table.columns.length <= 1) return
      table.columns.splice(columnIndex, 1)
    })
  },

  moveColumn: (containerId, tableId, fromIndex, toIndex) => {
    set((s) => {
      const tables = s.tableData[containerId]
      if (!tables) return
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      if (fromIndex < 0 || fromIndex >= table.columns.length) return
      if (toIndex < 0 || toIndex >= table.columns.length) return
      const [col] = table.columns.splice(fromIndex, 1)
      table.columns.splice(toIndex, 0, col)
    })
  },

  setTablesForContainer: (containerId, tables) => {
    set((s) => {
      if (tables.length === 0) {
        delete s.tableData[containerId]
      } else {
        s.tableData[containerId] = tables
      }
    })
  },

  setMermaidText: (containerId, text) => {
    set((s) => {
      if (text) {
        s.mermaidText[containerId] = text
      } else {
        delete s.mermaidText[containerId]
      }
    })
  },
})
