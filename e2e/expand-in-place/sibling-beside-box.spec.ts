import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

// Reported bug (user's real workspace): persons A and C both connect to system
// B. A sits above B, C sits to B's lower-LEFT. Expanding B gap-shifted C ~570px
// down — even though C is far beside the box and needs no room — so C's arrow
// re-anchored onto the boundary's bottom. The flow-axis gap-shift must only
// move nodes that overlap the grown box on the cross axis.

const dsl = `workspace "Beside" {
  model {
    a = person "A" "person A"
    c = person "C" "person C"
    b = softwareSystem "B" "system B" {
      k1 = container "K1" "k"
      k2 = container "K2" "k"
      k3 = container "K3" "k"
      k4 = container "K4" "k"
    }
    a -> b "A calls B"
    c -> b "C calls B"
  }
  views { systemLandscape "L" { include *  autoLayout } }
}`

test.use({ viewport: { width: 1600, height: 1000 } })

async function flowPos(page: Page, id: string) {
  return page.evaluate((nid) => {
    const n = document.querySelector(`.react-flow__node[data-id="${nid}"]`) as HTMLElement | null
    if (!n) return null
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(n.style.transform)
    return m ? { x: +m[1], y: +m[2] } : null
  }, id)
}

test.describe('Expand-in-place — sibling beside the box is not displaced', () => {
  test('expanding B leaves a far-left sibling in place and its edge on the facing side', async ({ workspace }) => {
    const page = workspace.page
    await workspace.parseAndLoad(dsl)
    await page.waitForTimeout(600)

    // Recreate the reported layout (positions set while collapsed): A above B,
    // C far to B's lower-left — beside the box, below its collapsed bottom.
    const b = await flowPos(page, 'b')
    // Position updates are non-structural (rendered nodes keep their old spot
    // until the next structural rebuild), so assert against the SAVED target,
    // which the expand rebuild must render unshifted.
    const cSaved = { x: b!.x - 600, y: b!.y + 250 }
    await page.evaluate(({ bx, by, cx, cy }) => {
      const s = (window as { __testStore: () => {
        updateNodePosition: (id: string, x: number, y: number) => void
      } }).__testStore()
      s.updateNodePosition('a', bx - 460, by - 360)
      s.updateNodePosition('c', cx, cy)
    }, { bx: b!.x, by: b!.y, cx: cSaved.x, cy: cSaved.y })
    await page.waitForTimeout(300)

    await page.locator('.react-flow__node[data-id="b"]').hover()
    await page.getByRole('button', { name: 'Expand B' }).click()
    await page.waitForTimeout(600)

    // C must render exactly where it was saved — far beside the box, the
    // expansion needs no room from it, so no gap-shift.
    const cAfter = await flowPos(page, 'c')
    expect(Math.abs(cAfter!.x - cSaved.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(cAfter!.y - cSaved.y)).toBeLessThanOrEqual(2)

    // And C's edge anchors on the boundary side facing it (left), not the bottom.
    const geom = await page.evaluate(() => {
      const nodes: Record<string, { x: number; y: number; w: number; h: number }> = {}
      for (const n of document.querySelectorAll('.react-flow__node')) {
        const r = n.getBoundingClientRect()
        nodes[n.getAttribute('data-id')!] = { x: r.x, y: r.y, w: r.width, h: r.height }
      }
      const edge = [...document.querySelectorAll('.react-flow__edge')]
        .find((e) => e.getAttribute('aria-label') === 'Edge from c to __expand_boundary__b')
      const path = edge?.querySelector('.react-flow__edge-path') as SVGPathElement | null
      if (!path) return null
      const ctm = path.getScreenCTM()!
      const p = path.getPointAtLength(path.getTotalLength())
      const end = new DOMPoint(p.x, p.y).matrixTransform(ctm)
      return { end: { x: end.x, y: end.y }, box: nodes['__expand_boundary__b'] }
    })
    expect(geom).not.toBeNull()
    const { end, box } = geom!
    // On the LEFT edge (the broken behavior attached along the bottom, x far
    // inside the box), within the edge's vertical span.
    expect(Math.abs(end.x - box.x)).toBeLessThanOrEqual(16)
    expect(end.y).toBeGreaterThanOrEqual(box.y)
    expect(end.y).toBeLessThanOrEqual(box.y + box.h)
  })
})
