import { test, expect } from '../fixtures/workspace'

// The change tags are reserved: the Change control is their only in-app editor.
// They must not be removable in the Tags tab, nor appear as editable rows in the
// Tag Manager. (Raw .dsl edits stay open — out of scope, graceful by design.)
const SYSTEM = 'Internet Banking System'

test.describe('Change tag guard', () => {
  test('reserved change tag is locked in the Tags tab (no remove button)', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('New')
    await workspace.toggleInspectorTab('Tags')
    await expect(workspace.page.getByRole('button', { name: 'Remove tag New' })).toHaveCount(0)
  })

  test('ordinary custom tag still has a remove button (control case)', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.addTag('Critical')
    await expect(workspace.page.getByRole('button', { name: 'Remove tag Critical' })).toBeVisible()
  })

  test('reserved change tag has no editable row in the Tag Manager', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('Modified')

    await workspace.page.getByTestId('highlighter-segment-tags').click()
    const panel = workspace.page.getByRole('dialog', { name: /Highlight by Tag/ })
    await panel.getByRole('button', { name: 'Edit tag styles' }).click()
    const dialog = workspace.page.getByRole('dialog', { name: 'Manage tags' })
    await expect(dialog).toBeVisible()

    await expect(dialog.getByRole('textbox', { name: 'Rename tag Modified' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Remove tag Modified' })).toHaveCount(0)
  })
})
