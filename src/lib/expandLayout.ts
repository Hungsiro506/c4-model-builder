// Expand-in-place layout math.
//
// `gapShift` opens space for an expanded box by sliding everything *after* it
// along the dagre layout axis. The expanded box keeps its leading edge fixed and
// grows by `delta`; nodes whose leading edge is at or beyond the box's trailing
// edge move by `delta`. Nodes beside the box (same rank) and before it stay put.
// This keeps siblings stable instead of triggering a full re-layout.

export type LayoutNode = {
  id: string
  position: { x: number; y: number }
  width: number
  height: number
}

export type ShiftAxis = 'x' | 'y'

/** Axis a given dagre direction grows along. LR/RL flow horizontally (x),
 *  TB/BT flow vertically (y). */
export function axisForDirection(direction: string): ShiftAxis {
  return direction === 'LR' || direction === 'RL' ? 'x' : 'y'
}

/** Shift nodes positioned after `expandedId` along `axis` by `delta`.
 *  Pure: returns a new array; unmoved nodes are returned by reference. */
export function gapShift<T extends LayoutNode>(
  nodes: T[],
  expandedId: string,
  delta: number,
  axis: ShiftAxis,
): T[] {
  if (delta <= 0) return nodes
  const box = nodes.find((n) => n.id === expandedId)
  if (!box) return nodes

  const boxTrailingEdge = axis === 'x'
    ? box.position.x + box.width
    : box.position.y + box.height

  return nodes.map((node) => {
    if (node.id === expandedId) return node
    const leadingEdge = axis === 'x' ? node.position.x : node.position.y
    if (leadingEdge < boxTrailingEdge) return node
    return {
      ...node,
      position: axis === 'x'
        ? { x: node.position.x + delta, y: node.position.y }
        : { x: node.position.x, y: node.position.y + delta },
    }
  })
}

/** Apply several gap-shifts in sequence (one per expanded box). Order-independent
 *  because each shift only moves nodes strictly after a box; later boxes that were
 *  themselves shifted use their already-updated coordinates. */
export function gapShiftMany<T extends LayoutNode>(
  nodes: T[],
  shifts: Array<{ expandedId: string; delta: number }>,
  axis: ShiftAxis,
): T[] {
  return shifts.reduce((acc, { expandedId, delta }) => gapShift(acc, expandedId, delta, axis), nodes)
}
