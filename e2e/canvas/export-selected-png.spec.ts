import { test, expect } from '../fixtures/workspace'

/**
 * Export-selected-as-PNG (docs/export-png.md):
 *  - the multi-select bar exposes a "PNG" action,
 *  - clicking it triggers a .png download whose name derives from the workspace.
 */
test.describe('export selected as PNG', () => {
  test('PNG button on the multi-select bar triggers a download', async ({ workspace }) => {
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

    const exportButton = workspace.page.getByRole('button', {
      name: /Export 2 elements as a transparent PNG/,
    })
    await expect(exportButton).toBeVisible()

    const downloadPromise = workspace.page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })
})
