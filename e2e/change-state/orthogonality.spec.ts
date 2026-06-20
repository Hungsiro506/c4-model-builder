import { test, expect } from '../fixtures/workspace'

// location (External) and Change are independent axes: external uses a dashed
// border + chip; Change uses the fill. Both must show at once.
const GREEN = 'rgb(47, 138, 64)' // New #2f8a40

test.describe('Change is orthogonal to location', () => {
  test('external system + New shows both the dashed border and the green fill', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('External System')
    await workspace.clickNode('New External System')
    await workspace.selectChangeState('New')
    // A selected node draws a solid border — deselect to read the external dash.
    await workspace.clearSelection()

    // Change channel: green fill.
    expect(await workspace.getNodeFill('New External System')).toBe(GREEN)

    // Location channel: still dashed.
    const borderStyle = await workspace
      .getVisibleNodeByName('New External System')
      .locator('.c4-node')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopStyle)
    expect(borderStyle).toBe('dashed')
  })
})
