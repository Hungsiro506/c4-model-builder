import { memo } from 'react'
import { Minimize2, Plus } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import { useWorkspaceStore } from '@/store/workspace'
import NodeHandles from './NodeHandles'

interface BoundaryNodeData {
  name: string
  typeLabel: string
  empty?: boolean
  /** Expand-in-place boundary: render a collapse control that folds the
   *  element's children back into a single collapsed node. */
  collapsible?: boolean
  elementId?: string
}

function BoundaryNode({ data, selected }: NodeProps & { data: BoundaryNodeData }) {
  const collapseElement = useWorkspaceStore((s) => s.collapseElement)
  const addContainer = useWorkspaceStore((s) => s.addContainer)
  const addComponent = useWorkspaceStore((s) => s.addComponent)
  const addTable = useWorkspaceStore((s) => s.addTable)
  const isSystem = data.typeLabel === 'Software System'
  const isDatabase = data.typeLabel === 'Database'
  // Populated expand-in-place boundaries are draggable as a unit: the whole box
  // body grabs (children are separate nodes stacked on top, so they stay
  // interactive). Empty boundaries + scope/group boundaries stay pointer-
  // transparent so clicks/pans pass through to the canvas underneath.
  const bodyDraggable = !!data.collapsible && !data.empty
  const emptyTitle = isDatabase
    ? 'Add tables to this database'
    : isSystem
      ? 'Add containers to this system'
      : 'Add components to this container'

  // Expand-in-place add: create a child of the expanded element, shown inside
  // this boundary via the parent's expansion. skipActiveView keeps it out of
  // the underlying (e.g. landscape) view so it never renders as a stray node.
  const addChild = () => {
    if (!data.elementId) return
    if (isSystem) addContainer(data.elementId, 'New Container', undefined, undefined, { skipActiveView: true })
    else if (isDatabase) addTable(data.elementId, 'new_table')
    else addComponent(data.elementId, 'New Component', undefined, { skipActiveView: true })
  }

  const ariaLabel = isDatabase
    ? `Add table to ${data.name}`
    : isSystem
      ? `Add container to ${data.name}`
      : `Add component to ${data.name}`

  return (
    <>
      <div
        className="c4-overlay-drag-handle"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          cursor: 'grab',
          pointerEvents: 'auto',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontSize: 'var(--text-xs-plus)',
            fontWeight: 700,
            color: 'var(--canvas-boundary-title, var(--color-text-dim))',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}>
            {data.name}
          </span>
          <span style={{
            fontSize: 'var(--text-xxs)',
            fontWeight: 500,
            color: 'var(--canvas-boundary-subtitle, var(--color-text-ghost))',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {data.typeLabel}
          </span>
        </div>
        {data.collapsible && data.elementId && (
          <>
            <button
              className="c4-node-action-btn nodrag"
              style={{ marginTop: 1 }}
              onClick={(e) => { e.stopPropagation(); addChild() }}
              aria-label={ariaLabel}
            >
              <Plus size={11} aria-hidden="true" />
            </button>
            <button
              className="c4-node-action-btn nodrag"
              style={{ marginTop: 1 }}
              onClick={(e) => { e.stopPropagation(); collapseElement(data.elementId!) }}
              aria-label={`Collapse ${data.name}`}
            >
              <Minimize2 size={11} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <div
        className={`c4-boundary-node ${selected ? 'selected' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--canvas-boundary-border, var(--glass-overlay-sm))',
          background: 'var(--canvas-boundary-bg, var(--glass-overlay-xxs))',
          cursor: bodyDraggable ? 'grab' : 'default',
          pointerEvents: bodyDraggable ? 'auto' : 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
      {/* Expand boundaries can be edge endpoints: a parent-level relationship
          (e.g. A→B) attaches to this wrapper box when B is expanded, instead of
          diving onto a child. Handles are invisible anchors for that routing. */}
      {data.collapsible && <NodeHandles />}
      {data.empty && (
        <div
          style={{
            position: 'absolute',
            inset: '48px 18px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}
        >
          <svg width="38" height="32" viewBox="0 0 48 40" fill="none" style={{ opacity: 0.22, marginBottom: 12 }}>
            <rect x="1" y="1" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
            <rect x="27" y="1" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
            <rect x="1" y="25" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
            <rect x="27" y="25" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
            <line x1="21" y1="8" x2="27" y2="8" stroke="currentColor" strokeWidth="2"/>
            <line x1="21" y1="32" x2="27" y2="32" stroke="currentColor" strokeWidth="2"/>
            <line x1="24" y1="15" x2="24" y2="25" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              marginBottom: 8,
            }}
          >
            {emptyTitle}
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            Press
            <kbd
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                background: 'var(--glass-overlay-sm)',
                border: '1px solid var(--glass-overlay-md)',
                fontSize: 12,
                fontFamily: 'monospace',
                fontWeight: 700,
                lineHeight: '18px',
              }}
            >
              A
            </kbd>
            to add an element
          </span>
        </div>
      )}
      </div>
    </>
  )
}

export default memo(BoundaryNode)
