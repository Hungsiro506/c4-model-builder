import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Code2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace'
import { generateMermaidERD } from '@/lib/mermaidGenerator'
import { parseMermaidERD, resolveForeignKeys, type ERDRelationship } from '@/lib/mermaidParser'
import { announce } from '@/lib/announce'

interface MermaidOverlayProps {
  containerId: string
  containerName: string
  onClose: () => void
}

/**
 * Full-canvas overlay for editing Mermaid ERD text. Text is the source of
 * truth for table structure. On close, the text is parsed and applied to
 * the store's tableData, which triggers a canvas re-render.
 */
export default function MermaidOverlay({ containerId, containerName, onClose }: MermaidOverlayProps) {
  const tableData = useWorkspaceStore((s) => s.tableData)
  const mermaidTextStore = useWorkspaceStore((s) => s.mermaidText[containerId])
  const setTablesForContainer = useWorkspaceStore((s) => s.setTablesForContainer)
  const setMermaidText = useWorkspaceStore((s) => s.setMermaidText)

  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  // Initialize textarea from stored text or generate from existing tables
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (mermaidTextStore) {
      setText(mermaidTextStore)
    } else {
      const tables = tableData[containerId] ?? []
      if (tables.length > 0) {
        const relationships = extractRelationshipsFromTables(tables)
        setText(generateMermaidERD(tables, relationships))
      } else {
        setText(`erDiagram\n    \n`)
      }
    }
  }, [containerId, tableData, mermaidTextStore])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleApply = useCallback(() => {
    const result = parseMermaidERD(text)
    if (result.errors.length > 0) {
      setErrors(result.errors)
      return
    }

    // Resolve FK references by naming convention
    resolveForeignKeys(result)

    // Build relationships from parsed data
    const relationships = result.relationships ?? []

    setTablesForContainer(containerId, result.tables)
    setMermaidText(containerId, text)
    announce('Database diagram updated from Mermaid text')
    onClose()
  }, [text, containerId, setTablesForContainer, setMermaidText, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(13, 17, 23, 0.93)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Code2 size={16} style={{ color: 'var(--color-type-container)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Database: {containerName}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            — Mermaid ERD Editor
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleApply}
            style={{
              padding: '6px 18px',
              background: 'var(--color-accent)',
              color: 'var(--color-bg-primary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Apply changes and re-render diagram"
          >
            Apply & Close
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Cancel (Esc)"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setErrors([])
        }}
        spellCheck={false}
        style={{
          flex: 1,
          padding: '24px 40px',
          fontFamily:
            'ui-monospace, SFMono-Regular, "Fira Code", "JetBrains Mono", Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.7,
          background: 'transparent',
          color: 'var(--color-text-primary)',
          border: 'none',
          resize: 'none',
          outline: 'none',
          tabSize: 2,
        }}
        placeholder={`erDiagram\n    users {\n        int id PK\n        varchar name\n    }\n\n    orders {\n        int id PK\n        int user_id FK\n    }\n\n    users ||--o{ orders : "places"`}
      />

      {/* Errors / Help */}
      {errors.length > 0 && (
        <div
          style={{
            padding: '10px 24px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
            fontSize: 11,
            color: '#fca5a5',
            fontFamily: 'ui-monospace, monospace',
            maxHeight: 100,
            overflowY: 'auto',
          }}
        >
          {errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* Footer help */}
      <div
        style={{
          padding: '8px 24px 12px',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        Mermaid ERD syntax:{' '}
        <code style={{ color: 'var(--color-text-secondary)' }}>
          type name PK FK &quot;description&quot;
        </code>
        {' · '}
        Relations:{' '}
        <code style={{ color: 'var(--color-text-secondary)' }}>
          Table1 ||--o&#123; Table2 : &quot;label&quot;
        </code>
        {' · '}
        Press <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>Esc</kbd> to cancel
      </div>
    </div>
  )
}

/** Extract ERD relationships from FK columns in existing table data.
 *  Best-effort — FK references that point to known tables become relationship lines. */
function extractRelationshipsFromTables(tables: import('@/types/model').TableDef[]): ERDRelationship[] {
  const tableNames = new Set(tables.map((t) => t.name.toLowerCase()))
  const rels: ERDRelationship[] = []

  for (const table of tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        // FK format: "table.column" → extract table name
        const targetTable = col.foreignKey.split('.')[0]
        if (targetTable && tableNames.has(targetTable.toLowerCase())) {
          const exists = rels.some(
            (r) =>
              (r.sourceTable === table.name && r.targetTable === targetTable) ||
              (r.sourceTable === targetTable && r.targetTable === table.name),
          )
          if (!exists) {
            rels.push({
              sourceTable: table.name,
              sourceCardinality: '}o',
              targetTable: targetTable,
              targetCardinality: '||',
            })
          }
        }
      }
    }
  }

  return rels
}
