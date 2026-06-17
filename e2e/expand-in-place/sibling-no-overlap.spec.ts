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
})
