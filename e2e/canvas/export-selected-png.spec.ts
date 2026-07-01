import { test, expect } from '../fixtures/workspace'

/**
 * Copy-selected-as-PNG (docs/export-png.md):
 *  - the multi-select bar exposes a "PNG" action with a 1×/2×/3× scale menu,
 *  - picking a scale copies the selection to the clipboard and confirms.
 */
test.describe('copy selected as PNG', () => {
  test('PNG menu copies the selection to the clipboard', async ({ workspace }) => {
    await workspace.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await workspace.loadSample()
    const landscape = (await workspace.getViews()).find((view) => view.type === 'systemLandscape')
    expect(landscape).toBeTruthy()
    await workspace.setView(landscape!.key)

    // Select two elements and release the primary pointer so the bar appears.
    await workspace.page.evaluate(() => {
      type S = { selectElements: (ids: string[]) => void }
      document.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
      const store = (window as unknown as { __testStore?: () => S }).__testStore?.()
      store?.selectElements(['customer', 'atm'])
      document.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }))
    })

    await expect(workspace.page.getByText('2 selected')).toBeVisible()

    // Open the PNG scale menu and pick 2×.
    await workspace.page.getByRole('button', {
      name: /Copy 2 elements to clipboard as a transparent PNG/,
    }).click()
    await workspace.page.getByRole('button', { name: /2× resolution/ }).click()

    // On success the button label flips to "Copied".
    await expect(workspace.page.getByText('Copied', { exact: true })).toBeVisible()
  })
})
