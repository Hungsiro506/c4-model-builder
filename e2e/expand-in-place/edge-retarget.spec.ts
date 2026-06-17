import { test, expect } from '../fixtures/workspace'

// Regression for the "expanding a system drops its inbound/outbound edges" bug:
// System A relates to B, Developer relates to A, and A relates to C. Expanding C
// (which has a container) replaces C's node with its child. The A→C relationship
// must survive — re-targeted onto C's visible container — not vanish.
const dsl = `workspace {
  model {
    dev = person "Developer"
    a = softwareSystem "A"
    b = softwareSystem "B"
    c = softwareSystem "C" {
      c1 = container "C1"
    }
    a -> b "uses"
    dev -> a "uses"
    a -> c "uses"
  }
  views {
    systemLandscape {
      include *
      autoLayout lr
    }
  }
}`

async function expandNode(page: import('@playwright/test').Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testExpand?.(elementId)
  }, id)
  await page.waitForTimeout(300)
}

test.describe('Expand-in-place edge re-target', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
  })

  test('expanding C keeps the A→C edge (re-targeted onto its container)', async ({ workspace }) => {
    // Baseline: three relationships → three edges.
    expect(await workspace.getEdgeCount()).toBe(3)

    // Resolve C's model id, then expand it.
    const cId = (await workspace.getElementByName('C'))!.id
    await expandNode(workspace.page, cId)

    // The container becomes visible; the edge count must NOT drop (A→C survives
    // as A→C1). The bug dropped it to 2.
    expect(await workspace.getEdgeCount()).toBe(3)
    const c1 = await workspace.getElementByName('C1')
    expect(await workspace.page.locator(`.react-flow__node[data-id="${c1!.id}"]`).count()).toBe(1)
  })
})
