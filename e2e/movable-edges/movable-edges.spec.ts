import { test, expect } from '../fixtures/workspace'

// Excalidraw-style: drag an edge's midpoint handle to bend the bezier curve.

async function connectedPair(workspace: import('../fixtures/workspace').WorkspaceHelper) {
  await workspace.loadBlank()
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.fitView()
  await workspace.connectNodes('New System', 'New System 2')
}

test.describe('Movable edges', () => {
  test('a midpoint handle is attached to every edge', async ({ workspace }) => {
    await connectedPair(workspace)
    await expect(workspace.page.locator('.react-flow__edgeupdater').first()).toBeAttached()
  })

  test('clicking the midpoint handle toggles the edge path', async ({ workspace }) => {
    await connectedPair(workspace)

    const pathBefore = await workspace.page
      .locator('.react-flow__edge-path').last()
      .getAttribute('d')

    const a = await workspace.getVisibleNodeByName('New System').boundingBox()
    const b = await workspace.getVisibleNodeByName('New System 2').boundingBox()
    if (!a || !b) throw new Error('boxes missing')
    const mx = (a.x + a.width / 2 + b.x + b.width / 2) / 2
    const my = (a.y + a.height / 2 + b.y + b.height / 2) / 2

    // Single-click at the midpoint (handle is always clickable, invisible when
    // not hovered but still receives events). Wait for the 300ms debounce timer.
    await workspace.page.mouse.click(mx, my)
    await workspace.page.waitForTimeout(500)

    const pathAfter = await workspace.page
      .locator('.react-flow__edge-path').last()
      .getAttribute('d')
    expect(pathAfter).not.toBe(pathBefore)
  })
})
