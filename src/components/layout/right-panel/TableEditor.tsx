import { useState } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { X, Plus, Trash2 } from 'lucide-react'
import { TYPE_COLORS } from '@/lib/elementMeta'

// Stable empty array ref — avoids infinite re-render from ?? [] in selector
const EMPTY_TABLE_LIST: never[] = []

interface TableEditorProps {
  containerId: string
  tableId: string
  onClose: () => void
}

export default function TableEditor({ containerId, tableId, onClose }: TableEditorProps) {
  const tableData = useWorkspaceStore((s) => s.tableData[containerId]) ?? EMPTY_TABLE_LIST
  const fkEdges = useWorkspaceStore((s) => s.fkEdges[containerId]) ?? []
  const updateTable = useWorkspaceStore((s) => s.updateTable)
  const deleteTable = useWorkspaceStore((s) => s.deleteTable)
  const addColumn = useWorkspaceStore((s) => s.addColumn)
  const updateColumn = useWorkspaceStore((s) => s.updateColumn)
  const deleteColumn = useWorkspaceStore((s) => s.deleteColumn)
  const addFkEdge = useWorkspaceStore((s) => s.addFkEdge)
  const updateFkEdge = useWorkspaceStore((s) => s.updateFkEdge)
  const deleteFkEdge = useWorkspaceStore((s) => s.deleteFkEdge)

  const table = tableData.find((t) => t.id === tableId)
  const otherTables = tableData.filter((t: { id: string }) => t.id !== tableId)
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState('varchar')

  const handleAddColumn = () => {
    if (!newColName.trim()) return
    addColumn(containerId, tableId, newColName.trim(), newColType.trim() || 'varchar')
    setNewColName('')
    setNewColType('varchar')
  }

  const handleDeleteTable = () => {
    deleteTable(containerId, tableId)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddColumn()
    }
  }

  if (!table) {
    return (
      <div className="glass-panel-solid flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-lg shadow-black/20">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Table not found</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="Close table editor">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-muted">Table deleted or does not exist.</div>
      </div>
    )
  }

  return (
    <div className="glass-panel-solid flex h-full flex-col overflow-hidden rounded-xl border shadow-lg shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={TYPE_COLORS.Container} strokeWidth="2" style={{ flexShrink: 0 }}
          >
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <line x1="2" y1="8" x2="22" y2="8" />
            <line x1="8" y1="2" x2="8" y2="22" />
          </svg>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {table.name || 'Untitled'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDeleteTable}
            className="p-1 rounded hover:bg-red-500/10 text-red-400"
            aria-label="Delete table"
            title="Delete table"
          >
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="Close table editor">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Table name */}
      <div className="px-3 py-2 border-b border-white/5 shrink-0">
        <label className="block mb-1 text-xxs" style={{ color: 'var(--color-text-muted)' }}>Table Name</label>
        <input
          type="text"
          value={table.name}
          onChange={(e) => updateTable(containerId, tableId, { name: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
          style={{ color: 'var(--color-text-primary)' }}
          placeholder="Table name"
        />
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ padding: '4px 0', scrollbarWidth: 'thin' }}>
        <div className="px-3 py-1">
          <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Columns ({table.columns.length})
          </span>
        </div>

        {table.columns.length === 0 && (
          <div className="px-3 py-4 text-center text-xxs" style={{ color: 'var(--color-text-muted)' }}>
            No columns yet. Add one below.
          </div>
        )}

        {table.columns.map((col, i) => {
          const colId = 'id' in col ? (col as { id: string }).id : `${i}`
          // FK target data (computed outside JSX to avoid IIFE parse errors)
          const fkEdge = fkEdges.find(
            e => e.sourceTableId === tableId && e.sourceColumnId === colId,
          )
          const targetTableId = fkEdge?.targetTableId ?? ''
          const targetTable = targetTableId
            ? tableData.find((t: { id: string }) => t.id === targetTableId)
            : undefined
          const targetColumns = (targetTable as { columns: typeof table.columns } | undefined)?.columns ?? []
          return (
            <>
            <div key={colId} className="flex items-center gap-1.5 px-3 py-1 hover:bg-white/[0.03]">
              {/* PK toggle */}
              <button
                onClick={() => updateColumn(containerId, tableId, colId as string, { isPrimaryKey: !col.isPrimaryKey })}
                className={`w-5 h-5 rounded flex items-center justify-center text-xxs ${
                  col.isPrimaryKey ? 'text-amber-400 bg-amber-400/10' : 'text-muted hover:bg-white/5'
                }`}
                title={col.isPrimaryKey ? 'Primary Key (click to remove)' : 'Set as Primary Key'}
                aria-label={`Toggle primary key for ${col.name || `col_${i + 1}`}`}
              >
                PK
              </button>

              {/* FK toggle */}
              <button
                onClick={() => {
                  const newVal = !col.isForeignKey
                  updateColumn(containerId, tableId, colId as string, { isForeignKey: newVal })
                  if (!newVal) {
                    // Remove FK edges referencing this column
                    const colEdges = fkEdges.filter(
                      e => e.sourceTableId === tableId && e.sourceColumnId === colId,
                    )
                    for (const e of colEdges) deleteFkEdge(containerId, e.id)
                  }
                }}
                className={`w-5 h-5 rounded flex items-center justify-center text-xxs ${
                  col.isForeignKey ? 'text-indigo-400 bg-indigo-400/10' : 'text-muted hover:bg-white/5'
                }`}
                title={col.isForeignKey ? 'Foreign Key (click to remove)' : 'Set as Foreign Key'}
                aria-label={`Toggle foreign key for ${col.name || `col_${i + 1}`}`}
              >
                FK
              </button>

              {/* Name */}
              <input
                type="text"
                value={col.name}
                onChange={(e) => updateColumn(containerId, tableId, colId as string, { name: e.target.value })}
                className="flex-1 bg-transparent text-xs min-w-0"
                style={{ color: 'var(--color-text-primary)' }}
                placeholder={`col_${i + 1}`}
              />

              {/* Type */}
              <input
                type="text"
                value={col.type}
                onChange={(e) => updateColumn(containerId, tableId, colId as string, { type: e.target.value })}
                className="w-20 bg-transparent text-xxs font-mono"
                style={{ color: 'var(--color-text-muted)' }}
                placeholder="type"
              />

              {/* Delete */}
              <button
                onClick={() => deleteColumn(containerId, tableId, colId as string)}
                className="p-0.5 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400"
                aria-label={`Delete column ${col.name || `col_${i + 1}`}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
            {/* FK target picker */}
            {col.isForeignKey && (
              <div className="flex items-center gap-1 px-3 pb-1" style={{ paddingLeft: 54 }}>
                <span className="text-xxs" style={{ color: 'var(--color-text-muted)' }}>→</span>
                <select
                  value={targetTableId}
                  onChange={(e) => {
                    const newTgt = e.target.value
                    if (!newTgt) {
                      if (fkEdge) deleteFkEdge(containerId, fkEdge.id)
                      updateColumn(containerId, tableId, colId as string, { isForeignKey: false })
                      return
                    }
                    if (fkEdge) {
                      updateFkEdge(containerId, fkEdge.id, { targetTableId: newTgt, targetColumnId: undefined })
                    } else {
                      addFkEdge(containerId, tableId, newTgt, colId)
                    }
                  }}
                  className="text-xxs rounded px-1 py-0.5"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                >
                  <option value="">Select table...</option>
                  {otherTables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {!!targetTableId && (
                  <select
                    value={fkEdge?.targetColumnId ?? ''}
                    onChange={(e) => {
                      const newCol = e.target.value || undefined
                      if (fkEdge) {
                        updateFkEdge(containerId, fkEdge.id, { targetColumnId: newCol })
                      }
                    }}
                    className="text-xxs rounded px-1 py-0.5"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                  >
                    <option value="">Any PK col</option>
                    {targetColumns.map(c => (
                      <option key={c.id ?? c.name} value={c.id ?? c.name}>
                        {c.name} {c.isPrimaryKey ? '(PK)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
          )
        })}
      </div>

      {/* Add column */}
      <div className="px-3 py-2 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs"
            style={{ color: 'var(--color-text-primary)' }}
            placeholder="Col name"
          />
          <input
            type="text"
            value={newColType}
            onChange={(e) => setNewColType(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-14 bg-white/5 border border-white/10 rounded px-1 py-1 text-xxs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
            placeholder="type"
          />
          <button
            onClick={handleAddColumn}
            disabled={!newColName.trim()}
            className="shrink-0 p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30"
            aria-label="Add column"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
