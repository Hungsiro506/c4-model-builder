import { test, expect, type WorkspaceHelper } from '../fixtures/workspace'

// Relationship line colours (the line uses the brighter stroke value).
const GREEN_LINE = 'rgb(87, 184, 106)'  // New       #57b86a
const AMBER_LINE = 'rgb(224, 168, 58)'  // Modified  #e0a83a
const RED_LINE = 'rgb(194, 85, 85)'     // Removed   #c25555

const CHANGE_TAGS = ['New', 'Modified', 'Unchanged', 'Removed']

// Two systems + one relationship; connectNodes auto-selects the new edge so the
// inspector shows the Change control.
async function connectedPair(workspace: WorkspaceHelper) {
  await workspace.loadBlank()
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.page.keyboard.press('Shift+S')
  await workspace.page.waitForTimeout(400)
  await workspace.fitView()
  await workspace.connectNodes('New System', 'New System 2')
}

async function lastEdgeDashArray(workspace: WorkspaceHelper) {
  return workspace.page
    .locator('.react-flow__edge-path')
    .last()
    .evaluate((el) => getComputedStyle(el as SVGElement).strokeDasharray)
}

test.describe('Relationship Change state', () => {
  test('New recolors the line green and tags the relationship', async ({ workspace }) => {
    await connectedPair(workspace)
    await workspace.selectChangeState('New')
    // A selected edge paints with the selection colour — deselect to read its
    // real Change colour.
    await workspace.clearSelection()
    expect(await workspace.getLastEdgeStroke()).toBe(GREEN_LINE)
    const ws = await workspace.getWorkspace()
    expect(ws?.model.relationships.some((r) => r.tags.includes('New'))).toBe(true)
  })

  test('Modified recolors amber; switching keeps one change tag', async ({ workspace }) => {
    await connectedPair(workspace)
    await workspace.selectChangeState('New')
    await workspace.selectChangeState('Modified')
    await workspace.clearSelection()
    expect(await workspace.getLastEdgeStroke()).toBe(AMBER_LINE)
    const ws = await workspace.getWorkspace()
    const rel = ws?.model.relationships[0]
    expect(rel?.tags.filter((t) => CHANGE_TAGS.includes(t))).toEqual(['Modified'])
  })

  test('Removed makes the line red and dashed', async ({ workspace }) => {
    await connectedPair(workspace)
    await workspace.selectChangeState('Removed')
    await workspace.clearSelection()
    expect(await workspace.getLastEdgeStroke()).toBe(RED_LINE)
    const dash = await lastEdgeDashArray(workspace)
    expect(dash === 'none' || dash === '').toBe(false)
  })
})
