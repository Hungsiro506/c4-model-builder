import { test, expect } from '../fixtures/workspace'

test('debug — full UI with right panel and Tables tab', async ({ workspace, page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await workspace.loadTemplate('bigBank')

  // Switch to Containers view
  await page.evaluate(() => {
    const store = (window as any).__testStore?.()
    store?.setActiveView?.('Containers')
  })
  await page.waitForTimeout(500)

  // Ensure right panel is open
  await page.evaluate(() => {
    const store = (window as any).__testStore?.()
    if (!store?.rightPanelOpen) store?.setRightPanelOpen?.(true)
  })
  await page.waitForTimeout(300)

  // Select the Database container by clicking it on canvas
  const dbNode = page.locator('.react-flow__node').filter({ hasText: 'Database' })
  await dbNode.click()
  await page.waitForTimeout(500)

  // Screenshot: element selected, right panel shows Properties tab
  await page.screenshot({ path: 'e2e/db-table-view/debug-full-1-properties.png', fullPage: false })

  // Click Tables tab
  const tablesTab = page.locator('[role="tab"]').filter({ hasText: 'Tables' })
  const hasTablesTab = await tablesTab.isVisible().catch(() => false)
  console.log('Tables tab visible:', hasTablesTab)

  if (hasTablesTab) {
    await tablesTab.click()
    await page.waitForTimeout(300)
  }

  await page.screenshot({ path: 'e2e/db-table-view/debug-full-2-tables.png', fullPage: false })

  // Check element panel content
  const panelText = await page.locator('[aria-label="Element properties"]').textContent().catch(() => 'NOT FOUND')
  console.log('Panel content preview:', panelText?.slice(0, 200))

  // Report errors
  const realErrors = errors.filter((e) =>
    !e.includes('favicon') && !e.includes('preamble') && !e.includes('React Refresh') && !e.includes('__vite'),
  )
  console.log('ERRORS:', realErrors.length === 0 ? 'NONE' : realErrors.join('\n'))
  expect(realErrors).toHaveLength(0)
})
