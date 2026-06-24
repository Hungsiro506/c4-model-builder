import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { TableDef, ElementStyle } from '@/types/model'
import { Key, ArrowRightLeft } from 'lucide-react'

export interface TableNodeData {
  tableDef: TableDef
  containerId: string
  /** Inherited style from parent Database container's tag cascade. */
  style?: ElementStyle
}

/**
 * Table node renders a database table with its columns inside an expanded
 * Database container boundary. Tables are sidecar-only metadata — they are
 * NOT ModelElements and do not use BaseC4Node.
 */
function TableNode({ data, selected }: NodeProps & { data: TableNodeData }) {
  const { tableDef, style } = data
  const accent = style?.color ?? 'var(--color-type-container)'
  const tint = style?.background
    ? `${style.background}1a` // ~10% opacity
    : 'var(--color-tint-container)'

  return (
    <div
      className={`c4-node ${selected ? 'selected' : ''}`}
      style={{
        borderColor: selected ? 'var(--color-type-container)' : 'var(--color-border)',
        background: selected ? 'var(--color-tint-container)' : 'var(--color-surface-1)',
        minWidth: 200,
        maxWidth: 280,
        padding: 0,
        '--node-glow': 'var(--color-type-container)',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontWeight: 600,
          fontSize: 12,
          color: 'var(--color-text-primary)',
          background: tint,
          borderRadius: '10px 10px 0 0',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <line x1="2" y1="8" x2="22" y2="8" />
          <line x1="8" y1="2" x2="8" y2="22" />
        </svg>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tableDef.name || 'Untitled'}
        </span>
      </div>

      {/* Columns */}
      <div style={{ padding: '1px 0' }}>
        {tableDef.columns.length === 0 ? (
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontStyle: 'italic',
            }}
          >
            (no columns)
          </div>
        ) : (
          tableDef.columns.map((col, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '1px 12px',
                fontSize: 11,
                lineHeight: 1.7,
              }}
            >
              {/* PK indicator */}
              <span
                style={{
                  width: 16,
                  flexShrink: 0,
                  textAlign: 'center',
                  color: col.primaryKey ? 'var(--color-type-person)' : 'transparent',
                  fontSize: 10,
                }}
                title={col.primaryKey ? 'Primary Key' : undefined}
              >
                {col.primaryKey && <Key size={10} style={{ display: 'inline' }} />}
              </span>
              {/* FK indicator */}
              <span
                style={{
                  width: 16,
                  flexShrink: 0,
                  textAlign: 'center',
                  color: col.foreignKey ? '#4ade80' : 'transparent',
                  fontSize: 10,
                }}
                title={col.foreignKey ? `FK → ${col.foreignKey}` : undefined}
              >
                {col.foreignKey && <ArrowRightLeft size={10} style={{ display: 'inline' }} />}
              </span>
              {/* Column name */}
              <span
                style={{
                  flex: 1,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.name || (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    col_{i + 1}
                  </span>
                )}
              </span>
              {/* Type */}
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 10,
                  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.type}
              </span>
              {/* Nullable */}
              <span
                style={{
                  width: 16,
                  textAlign: 'right',
                  fontSize: 10,
                  color: col.nullable ? 'var(--color-text-subtle)' : 'transparent',
                }}
                title={col.nullable ? 'Nullable' : undefined}
              >
                {col.nullable ? 'N' : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default memo(TableNode)
