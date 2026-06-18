import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

// Feature: add a container at the system level (and a component at the
// container level) without first drilling into a child view. Expanding a
// childless system draws an empty boundary with a "+" affordance; clicking it
// creates the first child inside that boundary.
const dsl = `workspace {
  model {
    a = softwareSystem "A"
    b = softwareSystem "B"
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

async function isNodeVisible(page: Page, id: string): Promise<boolean> {
  return (await page.locator(`.react-flow__node[data-id="${id}"]`).count()) > 0
}

async function expandBoundaryBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="__expand_boundary__${id}"]`).first().boundingBox()
}

async function nodeBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox()
}

test.describe('Expand-in-place add-at-parent', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
  })

  test('expanding a childless system draws an empty boundary with collapse + add controls', async ({ workspace }) => {
    const aId = (await workspace.getElementByName('A'))!.id
    await expandNode(workspace.page, aId)

    // Empty boundary present; sibling B still visible.
    expect(await expandBoundaryBox(workspace.page, aId)).not.toBeNull()
    expect(await isNodeVisible(workspace.page, (await workspace.getElementByName('B'))!.id)).toBe(true)

    // The add + collapse affordances are reachable from the boundary header.
    await expect(workspace.page.getByRole('button', { name: 'Add container to A' })).toBeVisible()
    await expect(workspace.page.getByRole('button', { name: 'Collapse A' })).toBeVisible()
  })

  test('clicking "+" on the boundary adds a container inside it', async ({ workspace }) => {
    const aId = (await workspace.getElementByName('A'))!.id
    await expandNode(workspace.page, aId)

    await workspace.page.getByRole('button', { name: 'Add container to A' }).click()
    await workspace.page.waitForTimeout(300)

    const newContainer = await workspace.getElementByName('New Container')
    expect(newContainer).not.toBeNull()
    expect(await isNodeVisible(workspace.page, newContainer!.id)).toBe(true)

    // The new container sits inside A's boundary.
    const box = await expandBoundaryBox(workspace.page, aId)
    const child = await nodeBox(workspace.page, newContainer!.id)
    expect(box).not.toBeNull()
    expect(child).not.toBeNull()
    expect(child!.x).toBeGreaterThanOrEqual(box!.x - 1)
    expect(child!.y).toBeGreaterThanOrEqual(box!.y - 1)
    expect(child!.x + child!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
  })

  test('nested: expand container then add a component inside it', async ({ workspace }) => {
    const aId = (await workspace.getElementByName('A'))!.id
    await expandNode(workspace.page, aId)
    await workspace.page.getByRole('button', { name: 'Add container to A' }).click()
    await workspace.page.waitForTimeout(300)

    const container = (await workspace.getElementByName('New Container'))!
    // System boundary + container both still visible (container did NOT vanish).
    expect(await expandBoundaryBox(workspace.page, aId)).not.toBeNull()
    expect(await isNodeVisible(workspace.page, container.id)).toBe(true)

    // Expand the (childless) container → its own empty boundary with controls.
    await expandNode(workspace.page, container.id)
    expect(await expandBoundaryBox(workspace.page, container.id)).not.toBeNull()
    // System boundary must STILL be present (the bug collapsed everything into A).
    expect(await expandBoundaryBox(workspace.page, aId)).not.toBeNull()

    await expect(workspace.page.getByRole('button', { name: 'Add component to New Container' })).toBeVisible()
    await workspace.page.getByRole('button', { name: 'Add component to New Container' }).click()
    await workspace.page.waitForTimeout(300)

    const component = await workspace.getElementByName('New Component')
    expect(component).not.toBeNull()
    expect(await isNodeVisible(workspace.page, component!.id)).toBe(true)

    // Component sits inside the container boundary, which nests inside the system box.
    const ctrBox = await expandBoundaryBox(workspace.page, container.id)
    const sysBox = await expandBoundaryBox(workspace.page, aId)
    const comp = await nodeBox(workspace.page, component!.id)
    expect(comp!.x).toBeGreaterThanOrEqual(ctrBox!.x - 1)
    expect(comp!.y).toBeGreaterThanOrEqual(ctrBox!.y - 1)
    expect(ctrBox!.x).toBeGreaterThan(sysBox!.x - 1)
    expect(ctrBox!.x + ctrBox!.width).toBeLessThanOrEqual(sysBox!.x + sysBox!.width + 1)
  })

  test('collapsing after add leaves no stray top-level node', async ({ workspace }) => {
    const aId = (await workspace.getElementByName('A'))!.id
    await expandNode(workspace.page, aId)
    await workspace.page.getByRole('button', { name: 'Add container to A' }).click()
    await workspace.page.waitForTimeout(300)

    const newContainer = (await workspace.getElementByName('New Container'))!
    await workspace.page.getByRole('button', { name: 'Collapse A' }).click()
    await workspace.page.waitForTimeout(300)

    // Back to A + B at the top level; the container is NOT a stray top-level node.
    expect(await isNodeVisible(workspace.page, aId)).toBe(true)
    expect(await isNodeVisible(workspace.page, newContainer.id)).toBe(false)
    expect(await workspace.getNodeCount()).toBe(2)
  })
})
