import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react'

interface FkEdgeData {
  label?: string
  sourceColumnId?: string
  targetColumnId?: string
}

function FkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  data,
  style: edgeStyle,
}: EdgeProps & { data?: FkEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })
  console.log('[FkEdge render]', id, 'src:', sourceX, sourceY, 'tgt:', targetX, targetY, 'style:', JSON.stringify(edgeStyle))

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd="url(#c4-arrow-fk)"
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 10,
              padding: '1px 4px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--canvas-bg, var(--color-bg-primary)) 75%, transparent)',
              color: 'var(--color-fk-edge, #6366f1)',
              whiteSpace: 'nowrap',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(FkEdge)
