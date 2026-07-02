import { memo, useMemo, useState, useRef, useEffect } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  Position,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react'
import type { Relationship, RelationshipStyle } from '@/types/model'
import { useWorkspaceStore } from '@/store/workspace'
import { getEdgeLabelDensity, truncateEdgeLabel } from './relationshipEdgeLabels'
import { EXPAND_BOUNDARY_PREFIX } from '../canvasBuilders'
import { floatingBorderPoint, type FloatRect } from './edgeFloating'

interface RelationshipEdgeData {
  relationship: Relationship
  relationshipStyle?: RelationshipStyle
}

const FULL_LABEL_MAX_WIDTH = 200
const COMPACT_LABEL_MAX_WIDTH = 148
const COMPACT_DESCRIPTION_MAX_CHARS = 42
const COMPACT_TECH_CHIP_LIMIT = 1

// React Flow places edge endpoints at the outer edge of handles, which
// extend past the node border (handles are centered on the border via CSS
// translate). Pull endpoints inward so arrows connect at the node border.
const SRC_OFFSET = 4  // 8px source handle / 2
const TGT_OFFSET = 7  // 14px target handle / 2

function snapToNode(x: number, y: number, pos: Position, offset: number): [number, number] {
  switch (pos) {
    case Position.Left:   return [x + offset, y]
    case Position.Right:  return [x - offset, y]
    case Position.Top:    return [x, y + offset]
    case Position.Bottom: return [x, y - offset]
    default:              return [x, y]
  }
}

/** Absolute rect of an internal RF node, or null if not measured yet. */
function internalRect(node: ReturnType<typeof useInternalNode>): FloatRect | null {
  if (!node) return null
  const w = node.measured?.width
  const h = node.measured?.height
  if (!w || !h) return null
  return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, width: w, height: h }
}

const isExpandBoundary = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith(EXPAND_BOUNDARY_PREFIX)

function RelationshipEdge({
  id,
  source,
  target,
  sourceX: rawSrcX,
  sourceY: rawSrcY,
  targetX: rawTgtX,
  targetY: rawTgtY,
  sourcePosition: rawSourcePosition,
  targetPosition: rawTargetPosition,
  data,
  selected,
  style: edgeStyle,
}: EdgeProps & { data?: RelationshipEdgeData }) {
  const relationship = data?.relationship
  const relStyle = data?.relationshipStyle

  // Floating endpoints for expanded-boundary boxes. A fixed 25/50/75% handle
  // slot sits at the box's vertical middle, so an edge from a small sibling
  // dives down a tall boundary. When an endpoint is a boundary, re-anchor it to
  // the point on the box border facing the OTHER endpoint, at that endpoint's
  // level — so the edge reads the same as before the box expanded. Normal
  // node↔node edges keep their handle slots (needed for fan-out overlap).
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  let srcX = rawSrcX, srcY = rawSrcY, tgtX = rawTgtX, tgtY = rawTgtY
  let sourcePosition = rawSourcePosition, targetPosition = rawTargetPosition
  const srcRect = internalRect(sourceNode)
  const tgtRect = internalRect(targetNode)
  // Aim each floating endpoint at the other endpoint's current point. Resolve
  // the boundary endpoints from the fixed points first so a boundary↔boundary
  // edge still aims at sensible targets.
  if (isExpandBoundary(target) && tgtRect) {
    const p = floatingBorderPoint(tgtRect, { x: rawSrcX, y: rawSrcY })
    tgtX = p.x; tgtY = p.y; targetPosition = p.position
  }
  if (isExpandBoundary(source) && srcRect) {
    const p = floatingBorderPoint(srcRect, { x: tgtX, y: tgtY })
    srcX = p.x; srcY = p.y; sourcePosition = p.position
  }
  // Re-aim the target now that a floating source may have moved (boundary↔boundary).
  if (isExpandBoundary(target) && tgtRect && isExpandBoundary(source)) {
    const p = floatingBorderPoint(tgtRect, { x: srcX, y: srcY })
    tgtX = p.x; tgtY = p.y; targetPosition = p.position
  }
  const isAsync = relationship?.interactionStyle === 'Asynchronous'
  const lineStyle = relationship?.lineStyle

  // Inline description editing (double-click an edge). The edit toggle lives in
  // the store (set by Canvas.onEdgeDoubleClick / the label's own dblclick) so it
  // survives edge rebuilds; the draft + focus are local.
  const isEditing = useWorkspaceStore((s) => s.editingRelationshipId === id)
  const updateRelationship = useWorkspaceStore((s) => s.updateRelationship)
  const setEditingRelationship = useWorkspaceStore((s) => s.setEditingRelationship)
  const [draft, setDraft] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  // Escape clears the edit, which unmounts the input and can fire onBlur — this
  // guard stops that blur from committing the discarded draft.
  const skipBlurRef = useRef(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isEditing) setDraft(relationship?.description ?? '')
  }, [isEditing, relationship?.description])
  useEffect(() => {
    if (isEditing) { editInputRef.current?.focus(); editInputRef.current?.select() }
  }, [isEditing])
  const commitEdit = () => {
    if (skipBlurRef.current) { skipBlurRef.current = false; return }
    if (relationship) {
      const trimmed = draft.trim()
      updateRelationship(relationship.id, { description: trimmed || undefined })
    }
    setEditingRelationship(null)
  }
  const cancelEdit = () => {
    skipBlurRef.current = true
    setEditingRelationship(null)
  }

  // Floating boundary endpoints already sit exactly on the box border — no
  // handle protrudes there, so skip the inward snap (which compensates for the
  // handle radius on normal nodes).
  const [sourceX, sourceY] = isExpandBoundary(source)
    ? [srcX, srcY]
    : snapToNode(srcX, srcY, sourcePosition, SRC_OFFSET)
  const [targetX, targetY] = isExpandBoundary(target)
    ? [tgtX, tgtY]
    : snapToNode(tgtX, tgtY, targetPosition, TGT_OFFSET)

  // Choose path function based on lineStyle
  let edgePath: string
  let labelX: number
  let labelY: number

  if (lineStyle === 'Straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX, sourceY, targetX, targetY,
    })
  } else if (lineStyle === 'Orthogonal') {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      borderRadius: 20,
    })
  } else {
    // Default: Curved (bezier)
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
    })
  }

  // Apply style from RelationshipStyle if available
  const strokeColor = selected
    ? 'var(--canvas-selection, var(--color-accent))'
    : (relStyle?.color ?? 'var(--canvas-edge, var(--color-edge))')
  const strokeWidth = selected ? 2 : (relStyle?.thickness ?? 1.5)
  const isDashed = isAsync || (relStyle?.dashed ?? false)

  const [hovered, setHovered] = useState(false)
  const technologyTokens = useMemo(
    () => relationship?.technology?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
    [relationship?.technology],
  )
  const labelDensity = getEdgeLabelDensity({
    lineStyle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    description: relationship?.description,
    technologies: technologyTokens,
    selected: !!selected,
    hovered,
  })
  const compactTechnologyTokens = technologyTokens.slice(0, COMPACT_TECH_CHIP_LIMIT)
  const hiddenTechnologyCount = Math.max(0, technologyTokens.length - compactTechnologyTokens.length)
  const descriptionText = relationship?.description
    ? (labelDensity === 'compact'
        ? truncateEdgeLabel(relationship.description, COMPACT_DESCRIPTION_MAX_CHARS)
        : relationship.description)
    : undefined
  const labelMaxWidth = labelDensity === 'compact' ? COMPACT_LABEL_MAX_WIDTH : FULL_LABEL_MAX_WIDTH

  return (
    <>
      {/* Invisible wider path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ pointerEvents: 'stroke', cursor: 'text' }}
      >
        <title>{relationship?.description ? 'Double-click to edit' : 'Double-click to add description'}</title>
      </path>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isDashed ? '6 4' : undefined,
          opacity: relStyle?.opacity,
          ...edgeStyle,
        }}
        markerStart={selected ? 'url(#c4-dot-selected)' : 'url(#c4-dot)'}
        markerEnd={selected ? 'url(#c4-arrow-selected)' : 'url(#c4-arrow)'}
      />
      {/* Inline description editor (double-click an edge or its label) */}
      {isEditing && (
        <EdgeLabelRenderer>
          <input
            ref={editInputRef}
            className="nodrag nopan"
            aria-label="Relationship description"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
              else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            placeholder="Describe relationship…"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid var(--canvas-selection, var(--color-accent))',
              background: 'var(--color-bg-panel, var(--color-bg-primary))',
              color: 'var(--color-text-primary)',
              outline: 'none',
              minWidth: 120,
              maxWidth: FULL_LABEL_MAX_WIDTH,
              textAlign: 'center',
            }}
          />
        </EdgeLabelRenderer>
      )}
      {/* Label — shown when either description or technology is present */}
      {!isEditing && (relationship?.description || relationship?.technology) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto"
            data-edge-id={id}
            data-label-density={labelDensity}
            title="Double-click to edit"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingRelationship(id) }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              maxWidth: labelMaxWidth,
              padding: labelDensity === 'compact' ? '3px 7px' : '4px 8px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--canvas-bg, var(--color-bg-primary)) 82%, transparent)',
              boxShadow: '0 1px 2px color-mix(in srgb, black 12%, transparent)',
              textAlign: 'center',
              lineHeight: 1.3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: labelDensity === 'compact' ? 3 : 4,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {descriptionText && (
              <span
                className="text-[11px]"
                title={labelDensity === 'compact' ? relationship?.description : undefined}
                style={{
                  color: 'var(--canvas-label-color, var(--color-text-secondary))',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                }}
              >
                {descriptionText}
              </span>
            )}
            {technologyTokens.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%', minWidth: 0 }}>
                {(labelDensity === 'compact' ? compactTechnologyTokens : technologyTokens).map((t) => (
                  <span
                    key={t}
                    className="c4-type-chip"
                    title={labelDensity === 'compact' ? t : undefined}
                    style={{
                      background: 'color-mix(in srgb, var(--canvas-label-muted, var(--color-text-muted)) 10%, transparent)',
                      color: 'var(--canvas-label-muted, var(--color-text-muted))',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      maxWidth: '100%',
                      minWidth: 0,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {labelDensity === 'compact' ? truncateEdgeLabel(t, 20) : t}
                  </span>
                ))}
                {labelDensity === 'compact' && hiddenTechnologyCount > 0 && (
                  <span
                    className="c4-type-chip"
                    title={technologyTokens.slice(COMPACT_TECH_CHIP_LIMIT).join(', ')}
                    style={{
                      background: 'color-mix(in srgb, var(--canvas-label-muted, var(--color-text-muted)) 7%, transparent)',
                      color: 'var(--canvas-label-muted, var(--color-text-muted))',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    +{hiddenTechnologyCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Hover tooltip */}
      {hovered && relationship && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 20}px)`,
              background: 'var(--glass-bg-heavy)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              maxWidth: 240,
              zIndex: 100,
              backdropFilter: 'blur(8px)',
            }}
          >
            {relationship.description && (
              <div className="text-[11px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {relationship.description}
              </div>
            )}
            {technologyTokens.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3, maxWidth: '100%', minWidth: 0 }}>
                {technologyTokens.map((t) => (
                  <span
                    key={t}
                    className="c4-type-chip"
                    style={{
                      background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      maxWidth: '100%',
                      minWidth: 0,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {relationship.tags.filter(t => t !== 'Relationship').length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {relationship.tags.filter(t => t !== 'Relationship').map(tag => (
                  <span key={tag} className="text-[9px] rounded px-1 py-0.5" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(RelationshipEdge)
