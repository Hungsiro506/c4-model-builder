import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

// Cross-level relationships must be blocked, not break the canvas. With B
// expanded, its container B1 is visible alongside the top-level system A.
// Dragging B1 → A is a container↔system (different C4 level) connection: it has
// no clean place to land and previously scrambled the layout. It must be
// refused — model + edge state unchanged, A and B1 still rendered.
const dsl = `workspace {
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

async function expandNode(page: Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testExpand?.(elementId)
  }, id)
  await page.waitForTimeout(300)
}

test.describe('Expand-in-place cross-level connection guard', () => {
  test('dragging container B1 → system A is refused and leaves the canvas intact', async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
    const bId = (await workspace.getElementByName('B'))!.id
    await expandNode(workspace.page, bId)

    // Baseline: one model relationship (a→b), one visible edge, B1 + A present.
    const before = await workspace.getWorkspace()
    expect(before!.model.relationships).toHaveLength(1)
    const baselineEdges = await workspace.getEdgeCount()
    const baselineNodes = await workspace.getNodeCount()
    expect(await workspace.page.locator('.react-flow__node[data-id="b1"]').count()).toBe(1)

    // Attempt the cross-level drag: container B1 → system A.
    await workspace.connectNodes('B1', 'A')
    await workspace.page.waitForTimeout(300)

    // Nothing changed: no new relationship, no extra edge, no lost nodes.
    const after = await workspace.getWorkspace()
    expect(after!.model.relationships).toHaveLength(1)
    expect(await workspace.getEdgeCount()).toBe(baselineEdges)
    expect(await workspace.getNodeCount()).toBe(baselineNodes)
    expect(await workspace.page.locator('.react-flow__node[data-id="b1"]').count()).toBe(1)
    expect(await workspace.page.locator(`.react-flow__node[data-id="${(await workspace.getElementByName('A'))!.id}"]`).count()).toBe(1)
  })
})
