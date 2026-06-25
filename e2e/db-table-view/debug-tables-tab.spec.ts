import { test } from '../fixtures/workspace'

test('debug — screenshot Tables tab in RightPanel', async ({ workspace, page }) => {
  await workspace.loadTemplate('bigBank')

  // Switch to Containers view so Database is visible
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown>
    const setView = store?.setActiveView as ((key: string) => void) | undefined
    setView?.('Containers')
  })
  await page.waitForTimeout(500)

  // Click the Database node to select it
  const dbNode = page.locator('.react-flow__node').filter({ hasText: 'Database' })
  await dbNode.click()
  await page.waitForTimeout(300)

  // Click the Tables tab
  const tablesTab = page.locator('[role="tab"]').filter({ hasText: 'Tables' })
  if (await tablesTab.isVisible()) {
    await tablesTab.click()
    await page.waitForTimeout(300)
  }

  await page.screenshot({ path: 'e2e/db-table-view/debug-tables-tab.png' })
})
