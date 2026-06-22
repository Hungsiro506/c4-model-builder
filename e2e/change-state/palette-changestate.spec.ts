import { test, expect } from '../fixtures/workspace'

// The "Create new" palette ships change-state shortcut chips: one click drops a
// system already tagged + traffic-light coloured.
const GREEN = 'rgb(47, 138, 64)'  // New       #2f8a40
const AMBER = 'rgb(138, 94, 18)'  // Modified  #8a5e12
const SLATE = 'rgb(58, 66, 80)'   // Unchanged #3a4250
const RED = 'rgb(122, 46, 46)'    // Removed   #7a2e2e

test.describe('Create-palette change shortcuts', () => {
  test('New System chip → green, New-tagged system', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('New System')
    expect(await workspace.getNodeFill('New System')).toBe(GREEN)
    expect((await workspace.getElementByName('New System'))?.tags).toContain('New')
  })

  test('Modified System chip → amber, Modified-tagged', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('Modified System')
    expect(await workspace.getNodeFill('Modified System')).toBe(AMBER)
    expect((await workspace.getElementByName('Modified System'))?.tags).toContain('Modified')
  })

  test('Unchanged System chip → slate, Unchanged-tagged', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('Unchanged System')
    expect(await workspace.getNodeFill('Unchanged System')).toBe(SLATE)
    expect((await workspace.getElementByName('Unchanged System'))?.tags).toContain('Unchanged')
  })

  test('Removed System chip → red, Removed-tagged', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('Removed System')
    expect(await workspace.getNodeFill('Removed System')).toBe(RED)
    expect((await workspace.getElementByName('Removed System'))?.tags).toContain('Removed')
  })
})
