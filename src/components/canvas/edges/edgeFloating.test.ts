import { describe, it, expect } from 'vitest'
import { Position } from '@xyflow/react'
import { floatingBorderPoint } from './edgeFloating'

// 200×100 box at origin; center (100, 50).
const box = { x: 0, y: 0, width: 200, height: 100 }

describe('floatingBorderPoint', () => {
  it('faces a point directly to the left → left edge, midpoint height', () => {
    const p = floatingBorderPoint(box, { x: -500, y: 50 })
    expect(p.position).toBe(Position.Left)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(50)
  })

  it('faces a point directly to the right → right edge', () => {
    const p = floatingBorderPoint(box, { x: 900, y: 50 })
    expect(p.position).toBe(Position.Right)
    expect(p.x).toBeCloseTo(200)
    expect(p.y).toBeCloseTo(50)
  })

  it('faces a point above → top edge', () => {
    const p = floatingBorderPoint(box, { x: 100, y: -300 })
    expect(p.position).toBe(Position.Top)
    expect(p.y).toBeCloseTo(0)
  })

  it('the reported bug: a small source level with a TALL box attaches near the source, not the vertical middle', () => {
    // Tall boundary 280×1131 at (500, 0); a small source at y≈50 (its center),
    // to the left. The old fixed 50% slot would attach at y≈565 (box middle);
    // floating must attach on the LEFT edge near the source's level.
    const tall = { x: 500, y: 0, width: 280, height: 1131 }
    const source = { x: 400, y: 50 } // just left of the box, near its top
    const p = floatingBorderPoint(tall, source)
    expect(p.position).toBe(Position.Left)
    expect(p.x).toBeCloseTo(500)
    // Attaches AT the source's level, NOT the box's 565px middle.
    expect(p.y).toBeCloseTo(50)
  })

  it('degenerate: toward the exact center falls back to center/top', () => {
    const p = floatingBorderPoint(box, { x: 100, y: 50 })
    expect(p).toEqual({ x: 100, y: 50, position: Position.Top })
  })

  it('degenerate: zero-size rect returns its origin', () => {
    const p = floatingBorderPoint({ x: 10, y: 20, width: 0, height: 0 }, { x: 100, y: 100 })
    expect(p).toEqual({ x: 10, y: 20, position: Position.Top })
  })
})
