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

/** Breathing room left between an expanded box and the siblings pushed clear of
 *  it, so a grown box never sits flush against its neighbours. */
export const EXPAND_MARGIN = 60

/** Axis a given dagre direction grows along. LR/RL flow horizontally (x),
 *  TB/BT flow vertically (y). */
export function axisForDirection(direction: string): ShiftAxis {
  return direction === 'LR' || direction === 'RL' ? 'x' : 'y'
}

/** Shift nodes positioned after `expandedId` along `axis` by `delta`.
 *  Pure: returns a new array; unmoved nodes are returned by reference.
 *  `exemptIds` are nodes whose saved position already includes this box's
 *  shift (dragged while it was expanded) — moving them again would double-shift. */
export function gapShift<T extends LayoutNode>(
  nodes: T[],
  expandedId: string,
  delta: number,
  axis: ShiftAxis,
  exemptIds?: ReadonlySet<string>,
): T[] {
  if (delta <= 0) return nodes
  const box = nodes.find((n) => n.id === expandedId)
  if (!box) return nodes

  const boxTrailingEdge = axis === 'x'
    ? box.position.x + box.width
    : box.position.y + box.height

  return nodes.map((node) => {
    if (node.id === expandedId) return node
    if (exemptIds?.has(node.id)) return node
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

/** Push siblings clear of an expanded box's *grown* footprint.
 *
 *  The flow-axis `gapShift` only opens space along the dagre flow; a box that
 *  also grows on the cross axis (or a sibling the user has dragged near/onto the
 *  box) can still overlap the grown rect. This is a collision-resolution pass: any
 *  non-member node that overlaps the grown box on BOTH axes is pushed out along
 *  the cross axis by the *minimum* distance to clear, toward whichever side it is
 *  nearer to. Nodes that don't overlap (e.g. a well-spaced sibling in another
 *  rank) are returned untouched, so this never disturbs far neighbours.
 *
 *  The box grows from its fixed leading corner, so its rect is `box.position`
 *  plus the grown width/height. */
export function gapShiftCross<T extends LayoutNode>(
  nodes: T[],
  expandedId: string,
  grownWidth: number,
  grownHeight: number,
  primaryAxis: ShiftAxis,
  exemptIds?: ReadonlySet<string>,
): T[] {
  const box = nodes.find((n) => n.id === expandedId)
  if (!box) return nodes
  // Grown rect anchored at the box's fixed leading corner.
  const rect = { x: box.position.x, y: box.position.y, w: grownWidth, h: grownHeight }
  return gapShiftCrossRect(nodes, rect, primaryAxis, new Set([expandedId, ...(exemptIds ?? [])]))
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Push siblings clear of an explicit rect (cross axis), the rect-driven core
 *  shared by `gapShiftCross`.
 *
 *  Unlike `gapShiftCross` — which reconstructs the grown box from a member id and
 *  predicted width/height — this takes the *actual* rendered rect. The rendered
 *  expand wrapper is sized to its real (possibly user-dragged) child positions,
 *  which can exceed dagre's predicted growth; sizing the push from the prediction
 *  left dragged-out siblings still overlapping. Feeding the true wrapper rect here
 *  guarantees a sibling lands fully outside it.
 *
 *  Any node NOT in `excludeIds` that overlaps `rect` on both axes is pushed out
 *  along the cross axis by the minimum distance to clear, toward whichever side it
 *  is nearer to, leaving EXPAND_MARGIN of gap. `excludeIds` should cover the box's
 *  own members so the wrapper's children aren't shoved out of their own wrapper. */
export function gapShiftCrossRect<T extends LayoutNode>(
  nodes: T[],
  rect: Rect,
  primaryAxis: ShiftAxis,
  excludeIds: Set<string> = new Set(),
): T[] {
  const cross: ShiftAxis = primaryAxis === 'x' ? 'y' : 'x'

  const gx1 = rect.x
  const gy1 = rect.y
  const gx2 = gx1 + rect.w
  const gy2 = gy1 + rect.h
  const boxCrossStart = cross === 'x' ? gx1 : gy1
  const boxCrossEnd = cross === 'x' ? gx2 : gy2
  const boxCenterCross = (boxCrossStart + boxCrossEnd) / 2

  return nodes.map((node) => {
    if (excludeIds.has(node.id)) return node
    // Overlap on both axes against the rect.
    const nx2 = node.position.x + node.width
    const ny2 = node.position.y + node.height
    const overlaps = node.position.x < gx2 && nx2 > gx1 && node.position.y < gy2 && ny2 > gy1
    if (!overlaps) return node

    const lead = cross === 'x' ? node.position.x : node.position.y
    const size = cross === 'x' ? node.width : node.height
    const center = lead + size / 2
    // Push out the nearer side, leaving EXPAND_MARGIN of gap: a node on the
    // leading half slides off the leading edge (negative), one on the trailing
    // half slides off the trailing edge.
    const delta = center < boxCenterCross
      ? (boxCrossStart - EXPAND_MARGIN - size) - lead
      : (boxCrossEnd + EXPAND_MARGIN) - lead
    return {
      ...node,
      position: cross === 'x'
        ? { x: node.position.x + delta, y: node.position.y }
        : { x: node.position.x, y: node.position.y + delta },
    }
  })
}

/** Apply several gap-shifts in sequence (one per expanded box). Order-independent
 *  because each shift only moves nodes strictly after a box; later boxes that were
 *  themselves shifted use their already-updated coordinates.
 *  `exempt` maps an expanded box id → node ids that must not move for that box
 *  (their saved positions already include its shift). */
export function gapShiftMany<T extends LayoutNode>(
  nodes: T[],
  shifts: Array<{ expandedId: string; delta: number }>,
  axis: ShiftAxis,
  exempt?: ReadonlyMap<string, ReadonlySet<string>>,
): T[] {
  return shifts.reduce(
    (acc, { expandedId, delta }) => gapShift(acc, expandedId, delta, axis, exempt?.get(expandedId)),
    nodes,
  )
}
