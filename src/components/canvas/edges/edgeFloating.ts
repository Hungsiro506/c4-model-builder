import { Position } from '@xyflow/react'

export interface FloatRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FloatingPoint {
  x: number
  y: number
  position: Position
}

/** Inset so the endpoint sits just inside the edge span rather than exactly on
 *  a corner when the source is beyond the box's extent. */
const EDGE_INSET = 12

/** Floating endpoint on `rect`'s border that tracks `toward` (the other
 *  endpoint's center). Used for large expanded-boundary boxes: a fixed
 *  25/50/75% handle slot sits at the box's vertical middle, so an edge from a
 *  small sibling dives down a tall box. Instead we:
 *    1. pick the side of the box that faces `toward` (dominant axis of the
 *       center→toward vector), then
 *    2. project `toward` onto that side, clamped to the side's span, so the
 *       endpoint stays at the other endpoint's level (a small sibling level
 *       with the box gets a near-horizontal edge, matching how it looked before
 *       the box expanded).
 *
 *  Degenerate rects (zero size) or a `toward` at the exact center fall back to
 *  the center with a Top position so callers still get a usable point. */
export function floatingBorderPoint(rect: FloatRect, toward: { x: number; y: number }): FloatingPoint {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy

  if (rect.width <= 0 || rect.height <= 0 || (dx === 0 && dy === 0)) {
    return { x: cx, y: cy, position: Position.Top }
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))

  // Facing side: the side `toward` is OUTSIDE of, by the larger overflow. This
  // is what makes a small sibling level with a tall box attach on the box's
  // LEFT/RIGHT (it's outside horizontally, inside vertically) instead of the
  // TOP the raw center→toward vector would pick (the box is so tall the vector
  // points mostly up). When `toward` is inside the box on both axes (rare for a
  // real edge), fall back to the dominant axis of the center vector.
  const hOver = Math.max(rect.x - toward.x, toward.x - (rect.x + rect.width), 0)
  const vOver = Math.max(rect.y - toward.y, toward.y - (rect.y + rect.height), 0)
  const horizontal = hOver === 0 && vOver === 0
    ? Math.abs(dx) >= Math.abs(dy)
    : hOver >= vOver

  if (horizontal) {
    const x = dx > 0 ? rect.x + rect.width : rect.x
    const y = clamp(toward.y, rect.y + EDGE_INSET, rect.y + rect.height - EDGE_INSET)
    return { x, y, position: dx > 0 ? Position.Right : Position.Left }
  }
  const y = dy > 0 ? rect.y + rect.height : rect.y
  const x = clamp(toward.x, rect.x + EDGE_INSET, rect.x + rect.width - EDGE_INSET)
  return { x, y, position: dy > 0 ? Position.Bottom : Position.Top }
}
