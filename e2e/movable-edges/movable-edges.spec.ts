import { test, expect } from '../fixtures/workspace'

// Click anywhere on an edge to toggle its line style (Curved ⇄ Straight).
// Double-click opens the inline editor (unchanged behavior).

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
  test('clicking the edge body toggles curved ⇄ straight', async ({ workspace }) => {
    await connectedPair(workspace)

    const pathBefore = await workspace.page
      .locator('.react-flow__edge-path').last()
      .getAttribute('d')

    // Click anywhere on the edge to toggle (uses the wide invisible hit path)
    const a = await workspace.getVisibleNodeByName('New System').boundingBox()
    const b = await workspace.getVisibleNodeByName('New System 2').boundingBox()
    if (!a || !b) throw new Error('boxes missing')
    const mx = (a.x + a.width / 2 + b.x + b.width / 2) / 2
    const my = (a.y + a.height / 2 + b.y + b.height / 2) / 2

    // Force-click in case a portal div is intercepting
    await workspace.page.mouse.click(mx, my, { button: 'left' })
    await workspace.page.waitForTimeout(600) // debounce timer (300ms) + render

    const pathAfter = await workspace.page
      .locator('.react-flow__edge-path').last()
      .getAttribute('d')
    expect(pathAfter).not.toBe(pathBefore)
  })
})
