import { test, expect } from '../fixtures/workspace'

// Excalidraw-style: double-click an edge to edit its description right on the
// canvas, instead of going to the right-hand properties panel.

async function connectedPair(workspace: import('../fixtures/workspace').WorkspaceHelper) {
  await workspace.loadBlank()
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.fitView()
  await workspace.connectNodes('New System', 'New System 2')
}

// Double-click the edge at the midpoint between the two node centres (raw mouse,
// so the thin zero-width edge path's visibility/bbox doesn't matter).
async function dblclickEdge(workspace: import('../fixtures/workspace').WorkspaceHelper) {
  const a = await workspace.getVisibleNodeByName('New System').boundingBox()
  const b = await workspace.getVisibleNodeByName('New System 2').boundingBox()
  if (!a || !b) throw new Error('node boxes missing')
  const mx = (a.x + a.width / 2 + b.x + b.width / 2) / 2
  const my = (a.y + a.height / 2 + b.y + b.height / 2) / 2
  await workspace.page.mouse.dblclick(mx, my)
}

test.describe('Inline edge label editing', () => {
  test('double-click a bare edge opens an inline editor and saves the description', async ({ workspace }) => {
    await connectedPair(workspace)

    await dblclickEdge(workspace)
    const input = workspace.page.getByRole('textbox', { name: /relationship description/i })
    await expect(input).toBeVisible()
    await input.fill('Sends data to')
    await input.press('Enter')

    const ws = await workspace.getWorkspace()
    expect(ws?.model.relationships[0]?.description).toBe('Sends data to')
    await expect(workspace.page.getByText('Sends data to')).toBeVisible()
  })

  test('Escape cancels the edit without saving', async ({ workspace }) => {
    await connectedPair(workspace)

    await dblclickEdge(workspace)
    const input = workspace.page.getByRole('textbox', { name: /relationship description/i })
    await input.fill('Should not be saved')
    await input.press('Escape')

    const ws = await workspace.getWorkspace()
    expect(ws?.model.relationships[0]?.description ?? '').toBe('')
  })

  test('double-click an existing label edits it in place', async ({ workspace }) => {
    await connectedPair(workspace)

    // Seed a description via the first inline edit.
    await dblclickEdge(workspace)
    let input = workspace.page.getByRole('textbox', { name: /relationship description/i })
    await input.fill('Calls')
    await input.press('Enter')
    await expect(workspace.page.getByText('Calls')).toBeVisible()

    // Double-click the rendered label to edit again.
    await workspace.page.getByText('Calls').dblclick()
    input = workspace.page.getByRole('textbox', { name: /relationship description/i })
    await expect(input).toBeVisible()
    await input.fill('Calls API of')
    await input.press('Enter')

    const ws = await workspace.getWorkspace()
    expect(ws?.model.relationships[0]?.description).toBe('Calls API of')
  })

  test('bare edge has a hover tooltip hinting the double-click action', async ({ workspace }) => {
    await connectedPair(workspace)
    // The invisible wider hit-path on every edge should carry a title so users
    // discover the double-click-edit gesture.
    const hitPath = workspace.page.locator('.react-flow__edge path[title]').first()
    await expect(hitPath).toHaveAttribute('title', /double.click/i)
  })
})
