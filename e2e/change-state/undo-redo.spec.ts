import { test, expect } from '../fixtures/workspace'

// Setting a change state mutates the model via updateElement, so it must take
// part in undo/redo like every other edit.
const SYSTEM = 'Internet Banking System'

test.describe('Change state undo/redo', () => {
  test('undo removes the change tag; redo restores it', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('New')
    expect((await workspace.getElementByName(SYSTEM))?.tags).toContain('New')

    await workspace.page.keyboard.press('Control+z')
    expect((await workspace.getElementByName(SYSTEM))?.tags ?? []).not.toContain('New')

    await workspace.page.keyboard.press('Control+Shift+z')
    expect((await workspace.getElementByName(SYSTEM))?.tags).toContain('New')
  })
})
