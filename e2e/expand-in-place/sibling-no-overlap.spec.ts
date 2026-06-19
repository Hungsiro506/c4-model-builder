import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

// Two UNRELATED systems share a dagre rank (placed side-by-side on the cross
// axis). Expanding A grows its wrapper box on both axes. B must be pushed clear
// of A's boundary — shifting only along the flow axis used to leave B overlapping
// the wrapper.
const dsl = `workspace {
  model {
    a = softwareSystem "A" {
      a1 = container "A1"
      a2 = container "A2"
    }
    b = softwareSystem "B" {
      b1 = container "B1"
    }
  }
  views {
    systemLandscape {
      include *
    }
  }
}`

async function expandNode(page: Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testExpand?.(elementId)
  }, id)
  await page.waitForTimeout(300)
}

// Drag a node (by model id) by a pixel delta, grabbing near its top so the grab
// lands on the node body rather than an action button.
async function dragById(page: Page, id: string, delta: { x: number; y: number }) {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox()
  if (!box) throw new Error(`No box for ${id}`)
  const sx = box.x + box.width / 2
  const sy = box.y + Math.min(box.height / 2, 24)
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + delta.x, sy + delta.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}

async function nodeBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox()
}

async function expandBoundaryBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="__expand_boundary__${id}"]`).first().boundingBox()
}

function overlaps(a: { x: number; y: number; width: number; height: number },
                  b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y
}

// Read a node's rect in flow coordinates (its own transform + size), immune to
// the fitView zoom that distorts screen-space boundingBox comparisons.
async function flowRect(page: Page, id: string) {
  return page.evaluate((nid) => {
    const el = document.querySelector(`.react-flow__node[data-id="${nid}"]`) as HTMLElement | null
    if (!el) return null
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return { x: m.m41, y: m.m42, w: el.offsetWidth, h: el.offsetHeight }
  }, id)
}

test.describe('Expand-in-place — sibling no-overlap', () => {
  test('expanding A pushes unrelated sibling B clear of A\'s wrapper box', async ({ workspace }) => {
    const page = workspace.page
    await workspace.parseAndLoad(dsl)

    const aId = (await workspace.getElementByName('A'))!.id
    const bId = (await workspace.getElementByName('B'))!.id

    await expandNode(page, aId)

    const aBox = await expandBoundaryBox(page, aId)
    const bBox = await nodeBox(page, bId)
    expect(aBox).not.toBeNull()
    expect(bBox).not.toBeNull()

    // B must sit entirely outside A's expanded wrapper.
    expect(overlaps(aBox!, bBox!)).toBe(false)
  })

  test('dragging B near A, then expanding A, still pushes B clear of the wrapper', async ({ workspace }) => {
    const page = workspace.page
    await workspace.parseAndLoad(dsl)

    const aId = (await workspace.getElementByName('A'))!.id
    const bId = (await workspace.getElementByName('B'))!.id

    // Drag B left so it sits right next to A (small gap) — close enough that A's
    // grown wrapper would swallow it. The old band-gated cross-shift skipped a
    // sibling whose leading edge had moved before A's collapsed trailing edge.
    const aBefore = await nodeBox(page, aId)
    const bBefore = await nodeBox(page, bId)
    expect(aBefore).not.toBeNull()
    expect(bBefore).not.toBeNull()
    const dx = (aBefore!.x + aBefore!.width + 24) - bBefore!.x
    await dragById(page, bId, { x: dx, y: 0 })

    await expandNode(page, aId)

    const aBox = await expandBoundaryBox(page, aId)
    const bBox = await nodeBox(page, bId)
    expect(aBox).not.toBeNull()
    expect(bBox).not.toBeNull()
    expect(overlaps(aBox!, bBox!)).toBe(false)
  })

  test('dragging an expanded child outward grows the wrapper and still clears B', async ({ workspace }) => {
    // The reported bug: after expanding A, dragging one of A's children outward
    // (toward B) grows the *real* wrapper past dagre's predicted size. The push
    // used to be sized off the prediction, so B stayed under the grown wrapper.
    const page = workspace.page
    await workspace.parseAndLoad(dsl)

    const aId = (await workspace.getElementByName('A'))!.id
    const a2Id = (await workspace.getElementByName('A2'))!.id
    const bId = (await workspace.getElementByName('B'))!.id

    await expandNode(page, aId)

    // Drag child A2 hard toward B to stretch A's wrapper past its predicted box.
    await dragById(page, a2Id, { x: 240, y: 0 })

    const a = await flowRect(page, `__expand_boundary__${aId}`)
    const b = await flowRect(page, bId)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    // B must sit fully outside the grown wrapper (no overlap on the flow axes).
    const overlap = b!.x < a!.x + a!.w && b!.x + b!.w > a!.x
      && b!.y < a!.y + a!.h && b!.y + b!.h > a!.y
    expect(overlap).toBe(false)
  })

  test('expanded box leaves a margin gap before the pushed sibling', async ({ workspace }) => {
    const page = workspace.page
    await workspace.parseAndLoad(dsl)

    const aId = (await workspace.getElementByName('A'))!.id
    const bId = (await workspace.getElementByName('B'))!.id

    await expandNode(page, aId)

    // Flow coords: B sits to the right of A's grown box with a clean gap (~the
    // EXPAND_MARGIN of 60). Assert a real gap, not just "no overlap".
    const a = await flowRect(page, `__expand_boundary__${aId}`)
    const b = await flowRect(page, bId)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    const gap = b!.x - (a!.x + a!.w)
    expect(gap).toBeGreaterThanOrEqual(40)
    expect(gap).toBeLessThanOrEqual(120)
  })
})
