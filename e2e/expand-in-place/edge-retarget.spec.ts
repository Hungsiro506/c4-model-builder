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

// A parent-level relationship must stay at the parent level when an endpoint is
// expanded: A→B with B containing B1, expanding B keeps the edge as A→(B wrapper),
// it must NOT dive onto B1. A finer A1→B1 edge only exists if the user creates
// A1 and that relationship explicitly.
const parentEdgeDsl = `workspace {
  model {
    a = softwareSystem "A"
    b = softwareSystem "B" {
      b1 = container "B1"
    }
    a -> b "uses"
  }
  views {
    systemLandscape {
      include *
      autoLayout lr
    }
  }
}`

function expandBoundaryBox(page: import('@playwright/test').Page, id: string) {
  return page.locator(`.react-flow__node[data-id="__expand_boundary__${id}"]`).first().boundingBox()
}

test.describe('Expand-in-place edge re-target', () => {
  test('expanding C keeps the A→C edge (re-targeted onto its container)', async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
    // Baseline: three relationships → three edges.
    expect(await workspace.getEdgeCount()).toBe(3)

    // Resolve C's model id, then expand it.
    const cId = (await workspace.getElementByName('C'))!.id
    await expandNode(workspace.page, cId)

    // The container becomes visible; the edge count must NOT drop (A→C survives,
    // attached to C's wrapper). The bug dropped it to 2.
    expect(await workspace.getEdgeCount()).toBe(3)
    const c1 = await workspace.getElementByName('C1')
    expect(await workspace.page.locator(`.react-flow__node[data-id="${c1!.id}"]`).count()).toBe(1)
  })

  test('expanding B keeps A→B on the wrapper, not on B1', async ({ workspace }) => {
    await workspace.parseAndLoad(parentEdgeDsl)
    expect(await workspace.getEdgeCount()).toBe(1)

    const bId = (await workspace.getElementByName('B'))!.id
    await expandNode(workspace.page, bId)

    // Wrapper drawn, child visible, single edge survives.
    expect(await expandBoundaryBox(workspace.page, bId)).not.toBeNull()
    const b1 = (await workspace.getElementByName('B1'))!
    expect(await workspace.page.locator(`.react-flow__node[data-id="${b1.id}"]`).count()).toBe(1)
    expect(await workspace.getEdgeCount()).toBe(1)

    // The edge endpoint lands on the wrapper's left border (lr layout: A is left
    // of B), NOT inside it on B1 — B1 sits inset past the wrapper padding. Read
    // the rendered edge path's end point and assert its X is at the wrapper edge,
    // left of B1's left edge.
    const box = (await expandBoundaryBox(workspace.page, bId))!
    const b1Box = (await workspace.page.locator(`.react-flow__node[data-id="${b1.id}"]`).first().boundingBox())!
    const endX = await workspace.page.locator('.react-flow__edge path.react-flow__edge-path').first().evaluate((el) => {
      const path = el as unknown as SVGPathElement
      const len = path.getTotalLength()
      const p = path.getPointAtLength(len)
      // Map SVG user-space point → screen px to compare against boundingBox().
      const ctm = path.getScreenCTM()!
      return p.matrixTransform(ctm).x
    })
    // Endpoint X must sit at/left-of B1's left edge (on the wrapper, not on B1).
    expect(endX).toBeLessThanOrEqual(b1Box.x + 1)
    expect(endX).toBeGreaterThanOrEqual(box.x - 1)
  })
})
