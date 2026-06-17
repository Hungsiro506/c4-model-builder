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

/** Push siblings off the *cross* axis (perpendicular to the dagre flow) when an
 *  expanded box grows into them. Same-rank siblings sit beside the box on the
 *  cross axis; the flow-axis `gapShift` never touches them, so a box that grows
 *  wider/taller on the cross axis would overlap them.
 *
 *  Gated by primary-axis overlap so only siblings the grown box actually reaches
 *  are moved — a node in a different rank (already spaced by the flow-axis shift)
 *  stays put. Only trailing-side neighbours move (the box grows from its fixed
 *  leading corner toward the trailing edge). */
export function gapShiftCross<T extends LayoutNode>(
  nodes: T[],
  expandedId: string,
  crossDelta: number,
  primaryAxis: ShiftAxis,
  grownPrimary: number,
): T[] {
  if (crossDelta <= 0) return nodes
  const box = nodes.find((n) => n.id === expandedId)
  if (!box) return nodes
  const cross: ShiftAxis = primaryAxis === 'x' ? 'y' : 'x'

  const primStart = primaryAxis === 'x' ? box.position.x : box.position.y
  const primEnd = primStart + grownPrimary
  const boxCrossSize = cross === 'x' ? box.width : box.height
  const boxCrossStart = cross === 'x' ? box.position.x : box.position.y
  // Where the box's trailing cross edge sat collapsed vs. after growing.
  const crossTrailingCollapsed = boxCrossStart + boxCrossSize
  const crossTrailingGrown = crossTrailingCollapsed + crossDelta

  return nodes.map((node) => {
    if (node.id === expandedId) return node
    const nPrimStart = primaryAxis === 'x' ? node.position.x : node.position.y
    const nPrimSize = primaryAxis === 'x' ? node.width : node.height
    // No overlap on the primary axis → grown box never reaches this node.
    if (nPrimStart + nPrimSize <= primStart || nPrimStart >= primEnd) return node
    const nCrossLead = cross === 'x' ? node.position.x : node.position.y
    // Only trailing-side neighbours the grown box actually penetrates: those
    // whose leading edge sat beyond the collapsed box but inside the grown box.
    // A node already clear of the grown footprint keeps its gap and stays put.
    if (nCrossLead < crossTrailingCollapsed || nCrossLead >= crossTrailingGrown) return node
    return {
      ...node,
      position: cross === 'x'
        ? { x: node.position.x + crossDelta, y: node.position.y }
        : { x: node.position.x, y: node.position.y + crossDelta },
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
