import { test, expect } from '../fixtures/workspace'

// Opt-in rule: creating a normal element must NOT auto-apply any change state.
const CHANGE_TAGS = ['New', 'Modified', 'Unchanged', 'Removed']

test.describe('New elements default to no change state', () => {
  test('a plain System has no change tag and Change = None', async ({ workspace }) => {
    await workspace.loadBlank()
    await workspace.addElementFromPanel('System')
    await workspace.clickNode('New System')

    const el = await workspace.getElementByName('New System')
    expect(el?.tags.some((t) => CHANGE_TAGS.includes(t))).toBe(false)

    await expect(
      workspace.page.getByTestId('change-state').getByRole('button', { name: 'Change: None' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
