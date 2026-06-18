import { describe, it, expect } from 'vitest'
import { gapShift, gapShiftMany, axisForDirection, type LayoutNode } from './expandLayout'

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

describe('axisForDirection', () => {
  it('maps LR/RL to x and TB/BT to y', () => {
    expect(axisForDirection('LR')).toBe('x')
    expect(axisForDirection('RL')).toBe('x')
    expect(axisForDirection('TB')).toBe('y')
    expect(axisForDirection('BT')).toBe('y')
  })
})
