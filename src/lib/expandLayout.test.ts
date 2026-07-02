import { describe, it, expect } from 'vitest'
import { gapShift, gapShiftMany, gapShiftCross, gapShiftCrossRect, axisForDirection, EXPAND_MARGIN, type LayoutNode } from './expandLayout'

const n = (id: string, x: number, y: number, width = 200, height = 100): LayoutNode => ({
  id, position: { x, y }, width, height,
})

describe('gapShift (vertical / TB)', () => {
  // box at y 0..100; below node at y 200; beside node same row; above node.
  const nodes = [
    n('box', 0, 0),
    n('below', 0, 200),
    n('beside', 300, 0),
    n('above', 0, -200),
  ]

  it('shifts nodes after the box down by delta', () => {
    const out = gapShift(nodes, 'box', 150, 'y')
    expect(out.find((x) => x.id === 'below')!.position.y).toBe(350)
  })

  it('leaves the box itself fixed', () => {
    const out = gapShift(nodes, 'box', 150, 'y')
    expect(out.find((x) => x.id === 'box')!.position.y).toBe(0)
  })

  it('leaves beside (same rank) and above nodes untouched', () => {
    const out = gapShift(nodes, 'box', 150, 'y')
    expect(out.find((x) => x.id === 'beside')!.position.y).toBe(0)
    expect(out.find((x) => x.id === 'above')!.position.y).toBe(-200)
  })

  it('does not shift x for a vertical gap', () => {
    const out = gapShift(nodes, 'box', 150, 'y')
    expect(out.find((x) => x.id === 'below')!.position.x).toBe(0)
  })
})

describe('gapShift — shift exemption (position saved while expanded)', () => {
  const nodes = [
    n('box', 0, 0),
    n('below', 0, 200),
    n('draggedWhileExpanded', 100, 300),
  ]

  it('does not move exempt nodes (their saved position already includes the shift)', () => {
    const out = gapShift(nodes, 'box', 150, 'y', new Set(['draggedWhileExpanded']))
    expect(out.find((x) => x.id === 'draggedWhileExpanded')!.position.y).toBe(300)
    // Non-exempt nodes still shift.
    expect(out.find((x) => x.id === 'below')!.position.y).toBe(350)
  })

  it('gapShiftMany applies exemption per expanded box', () => {
    const exempt = new Map([['box', new Set(['draggedWhileExpanded'])]])
    const out = gapShiftMany(nodes, [{ expandedId: 'box', delta: 150 }], 'y', exempt)
    expect(out.find((x) => x.id === 'draggedWhileExpanded')!.position.y).toBe(300)
    expect(out.find((x) => x.id === 'below')!.position.y).toBe(350)
  })

  it('gapShiftCross skips exempt nodes overlapping the grown rect', () => {
    // Grown box 0..400 x 0..400 overlaps both siblings; only the exempt one stays.
    const overlapping = [
      n('box', 0, 0),
      n('sib', 250, 150),
      n('draggedWhileExpanded', 250, 250),
    ]
    const out = gapShiftCross(overlapping, 'box', 400, 400, 'y', new Set(['draggedWhileExpanded']))
    expect(out.find((x) => x.id === 'draggedWhileExpanded')!.position).toEqual({ x: 250, y: 250 })
    expect(out.find((x) => x.id === 'sib')!.position.x).not.toBe(250)
  })
})

describe('gapShift (horizontal / LR)', () => {
  const nodes = [
    n('box', 0, 0),
    n('right', 300, 0),
    n('beside', 0, 300),
  ]

  it('shifts nodes after the box right by delta', () => {
    const out = gapShift(nodes, 'box', 120, 'x')
    expect(out.find((x) => x.id === 'right')!.position.x).toBe(420)
  })

  it('leaves a node in a different column (same x) untouched', () => {
    const out = gapShift(nodes, 'box', 120, 'x')
    expect(out.find((x) => x.id === 'beside')!.position.x).toBe(0)
  })
})

describe('gapShift edge cases', () => {
  it('no-ops on zero/negative delta', () => {
    const nodes = [n('box', 0, 0), n('below', 0, 200)]
    expect(gapShift(nodes, 'box', 0, 'y')).toBe(nodes)
    expect(gapShift(nodes, 'box', -10, 'y')).toBe(nodes)
  })

  it('no-ops when the box id is missing', () => {
    const nodes = [n('a', 0, 0)]
    expect(gapShift(nodes, 'missing', 50, 'y')).toBe(nodes)
  })
})

describe('gapShiftMany (nested / multiple expands compose)', () => {
  it('composes shifts inside-out', () => {
    // box1 at y0, box2 below at y200, tail at y400.
    const nodes = [n('box1', 0, 0), n('box2', 0, 200), n('tail', 0, 400)]
    const out = gapShiftMany(nodes, [
      { expandedId: 'box1', delta: 100 },
      { expandedId: 'box2', delta: 50 },
    ], 'y')
    // box1 grows 100 → box2 and tail move +100. box2 now at 300; grows 50 → tail +50.
    expect(out.find((x) => x.id === 'box2')!.position.y).toBe(300)
    expect(out.find((x) => x.id === 'tail')!.position.y).toBe(550)
  })
})

describe('gapShiftCross — collision clear with margin', () => {
  // primaryAxis 'y' (TB flow) → cross axis is 'x'. Box A at (0,0), grows to 500×300.
  it('pushes a trailing-side sibling clear of the grown box + margin', () => {
    const nodes = [n('A', 0, 0), n('B', 250, 0)] // B overlaps grown footprint on x
    const out = gapShiftCross(nodes, 'A', 500, 300, 'y')
    expect(out.find((x) => x.id === 'B')!.position.x).toBe(500 + EXPAND_MARGIN)
    expect(out.find((x) => x.id === 'A')!.position.x).toBe(0)
  })

  it('pushes a leading-side sibling off the leading edge - margin', () => {
    // Box A leading edge at x=300; B center left of box center → slides left.
    const nodes = [n('A', 300, 0, 500, 300), n('B', 250, 0)]
    const out = gapShiftCross(nodes, 'A', 500, 300, 'y')
    expect(out.find((x) => x.id === 'B')!.position.x).toBe(300 - EXPAND_MARGIN - 200)
  })

  it('leaves a well-separated sibling untouched (same reference)', () => {
    const nodes = [n('A', 0, 0), n('B', 1000, 0)]
    const out = gapShiftCross(nodes, 'A', 500, 300, 'y')
    expect(out.find((x) => x.id === 'B')).toBe(nodes[1])
  })

  it('clears a sibling dragged on top of the box (the reported bug)', () => {
    const nodes = [n('A', 0, 0), n('B', 120, 20)] // B overlapping A's collapsed slot
    const out = gapShiftCross(nodes, 'A', 500, 300, 'y')
    const b = out.find((x) => x.id === 'B')!
    const overlap = b.position.x < 500 && b.position.x + 200 > 0
      && b.position.y < 300 && b.position.y + 100 > 0
    expect(overlap).toBe(false)
  })
})

describe('gapShiftCrossRect — push clear of the ACTUAL wrapper rect', () => {
  // The reported bug: a child dragged outward grows the real wrapper past dagre's
  // predicted size, so a sibling sized-off the prediction stays overlapping. The
  // rect variant takes the true wrapper rect, so the sibling clears it fully.
  it('pushes a sibling fully outside a rect bigger than the predicted box', () => {
    // Real wrapper rect spans x 0..700 (a child was dragged out to ~700). Sibling
    // B at x=480 (where dagre put it next to the *predicted* 500-wide box) still
    // overlaps the real 700-wide wrapper.
    const nodes = [n('B', 480, 0)]
    const rect = { x: 0, y: 0, w: 700, h: 300 }
    const out = gapShiftCrossRect(nodes, rect, 'y')
    // B's center (480+100=580) is past the rect center (350) → trailing side.
    expect(out.find((x) => x.id === 'B')!.position.x).toBe(700 + EXPAND_MARGIN)
  })

  it('honours excludeIds (a wrapper member is never pushed out of its wrapper)', () => {
    const nodes = [n('child', 50, 50)]
    const rect = { x: 0, y: 0, w: 700, h: 300 }
    const out = gapShiftCrossRect(nodes, rect, 'y', new Set(['child']))
    expect(out.find((x) => x.id === 'child')).toBe(nodes[0])
  })

  it('leaves a sibling already clear of the rect untouched (same reference)', () => {
    const nodes = [n('B', 1000, 0)]
    const rect = { x: 0, y: 0, w: 700, h: 300 }
    const out = gapShiftCrossRect(nodes, rect, 'y')
    expect(out.find((x) => x.id === 'B')).toBe(nodes[0])
  })
})

describe('axisForDirection', () => {
  it('maps LR/RL to x and TB/BT to y', () => {
    expect(axisForDirection('LR')).toBe('x')
    expect(axisForDirection('RL')).toBe('x')
    expect(axisForDirection('TB')).toBe('y')
    expect(axisForDirection('BT')).toBe('y')
  })
})
