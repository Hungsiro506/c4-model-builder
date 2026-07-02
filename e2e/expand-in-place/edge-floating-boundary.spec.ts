import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

// Reported bug: A→B, edge attaches to the middle of B's left edge. Expanding B
// grows a TALL boundary (top pinned at B's old top), so the fixed 50% handle
// slot ends up at the box's vertical middle — the arrow dives DOWN a long way
// from A. Floating boundary endpoints must instead attach on the box side
// facing A, at A's level, so the edge reads the same as before the expand.

const dsl = `workspace "Float" {
  model {
    a = softwareSystem "A" "system A"
    b = softwareSystem "B" "system B" {
      c1 = container "C1" "c1"
      c2 = container "C2" "c2"
      c3 = container "C3" "c3"
      c4 = container "C4" "c4"
      c5 = container "C5" "c5"
      c6 = container "C6" "c6"
    }
    a -> b "calls"
  }
  views { systemLandscape "L" { include *  autoLayout lr } }
}`

test.use({ viewport: { width: 1600, height: 1000 } })

async function expandNode(page: Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testExpand?.(elementId)
  }, id)
  await page.waitForTimeout(400)
}

/** Screen-space endpoints of the single relationship edge, plus each node box. */
async function edgeGeom(page: Page) {
  return page.evaluate(() => {
    const nodes: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (const n of document.querySelectorAll('.react-flow__node')) {
      const r = n.getBoundingClientRect()
      nodes[n.getAttribute('data-id')!] = { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    const path = document.querySelector('.react-flow__edge .react-flow__edge-path') as SVGPathElement
    const ctm = path.getScreenCTM()!
    const toScreen = (p: DOMPoint) => new DOMPoint(p.x, p.y).matrixTransform(ctm)
    const start = toScreen(path.getPointAtLength(0))
    const end = toScreen(path.getPointAtLength(path.getTotalLength()))
    return { nodes, start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
  })
}

test.describe('Expand-in-place — floating edge attach on boundary', () => {
  test('edge to an expanded boundary attaches on the facing side at the source level, not the box middle', async ({ workspace }) => {
    const page = workspace.page
    await workspace.parseAndLoad(dsl)
    await page.waitForTimeout(600)

    // Place A level with collapsed B (its vertical center), just to the left.
    const b = await page.evaluate(() => {
      const n = document.querySelector('.react-flow__node[data-id="b"]') as HTMLElement
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(n.style.transform)!
      return { x: +m[1], y: +m[2], h: n.offsetHeight }
    })
    await page.evaluate(({ x, y }) => (window as Record<string, unknown>).__testStore
      ? (window as { __testStore: () => { updateNodePosition: (id: string, x: number, y: number) => void } }).__testStore().updateNodePosition('a', x, y)
      : undefined, { x: b.x - 300, y: b.y + b.h / 2 - 51 })
    await page.waitForTimeout(300)

    await expandNode(page, 'b')

    const { nodes, start, end } = await edgeGeom(page)
    const box = nodes['__expand_boundary__b']
    const aBox = nodes['a']
    expect(box).toBeTruthy()

    // Target attaches on the boundary's LEFT edge (the side facing A)…
    expect(Math.abs(end.x - box.x)).toBeLessThanOrEqual(16)
    // …at A's level — near the source endpoint's y, NOT the box's vertical middle.
    const boxMiddleY = box.y + box.h / 2
    expect(Math.abs(end.y - start.y)).toBeLessThanOrEqual(40)
    expect(Math.abs(end.y - boxMiddleY)).toBeGreaterThan(150)
    // Sanity: the attach is near A's own vertical center.
    expect(Math.abs(end.y - (aBox.y + aBox.h / 2))).toBeLessThanOrEqual(40)
  })
})
