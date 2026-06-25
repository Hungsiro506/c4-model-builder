import { memo, useState, useRef, useEffect } from 'react'
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
  const isSystem = data.typeLabel === 'Software System'

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Populated expand-in-place boundaries are draggable as a unit: the whole box
  // body grabs (children are separate nodes stacked on top, so they stay
  // interactive). Empty boundaries + scope/group boundaries stay pointer-
  // transparent so clicks/pans pass through to the canvas underneath.
  const bodyDraggable = !!data.collapsible && !data.empty
  const emptyTitle = isSystem
    ? 'Add containers to this system'
    : 'Add components to this container'

  const doAddContainer = () => {
    if (!data.elementId) return
    addContainer(data.elementId, 'New Container', undefined, undefined, { skipActiveView: true })
    setDropdownOpen(false)
  }

  const doAddDatabase = () => {
    if (!data.elementId) return
    addContainer(data.elementId, 'New Database', undefined, 'Database', { skipActiveView: true })
    setDropdownOpen(false)
  }

  const doAddComponent = () => {
    if (!data.elementId) return
    // Only Container boundaries offer Component add (L2→L3 expand).
    // System boundaries (L1→L2) don't — Components live inside Containers.
    addComponent(data.elementId, 'New Component', undefined, { skipActiveView: true })
    setDropdownOpen(false)
  }

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
          <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              className="c4-node-action-btn nodrag"
              style={{ marginTop: 1 }}
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen) }}
              aria-label={isSystem ? `Add container to ${data.name}` : `Add component to ${data.name}`}
              data-active={dropdownOpen ? 'true' : undefined}
            >
              <Plus size={11} aria-hidden="true" />
            </button>
            {dropdownOpen && (
              <div
                className="nodrag"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'var(--glass-surface, rgba(20,20,30,0.95))',
                  border: '1px solid var(--glass-overlay-md, rgba(255,255,255,0.10))',
                  borderRadius: 8,
                  padding: '4px 0',
                  minWidth: 140,
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                {isSystem ? (
                  <>
                    <button
                      className="row-menu-item nodrag"
                      style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 'var(--text-xs)', background: 'none', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); doAddContainer() }}
                      aria-label={`New Container in ${data.name}`}
                    >
                      Container
                    </button>
                    <button
                      className="row-menu-item nodrag"
                      style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 'var(--text-xs)', background: 'none', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); doAddDatabase() }}
                      aria-label={`New Database in ${data.name}`}
                    >
                      Database
                    </button>
                  </>
                ) : (
                  <button
                    className="row-menu-item nodrag"
                    style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 'var(--text-xs)', background: 'none', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); doAddComponent() }}
                    aria-label={`New Component in ${data.name}`}
                  >
                    Component
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {data.collapsible && data.elementId && (
          <button
            className="c4-node-action-btn nodrag"
            style={{ marginTop: 1 }}
            onClick={(e) => { e.stopPropagation(); collapseElement(data.elementId!) }}
            aria-label={`Collapse ${data.name}`}
          >
            <Minimize2 size={11} aria-hidden="true" />
          </button>
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
