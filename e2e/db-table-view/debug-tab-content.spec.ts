import { test } from '../fixtures/workspace'

test('debug — Tables tab content', async ({ workspace, page }) => {
  await workspace.loadTemplate('bigBank')
  await page.evaluate(() => {
    const store = (window as any).__testStore?.()
    store?.setActiveView?.('Containers')
    store?.setRightPanelOpen?.(true)
  })
  await page.waitForTimeout(300)

  // Select Database and click Tables tab
  await page.locator('.react-flow__node').filter({ hasText: 'Database' }).click()
  await page.waitForTimeout(400)
  await page.locator('[role="tab"]').filter({ hasText: 'Tables' }).click()
  await page.waitForTimeout(300)

  // Add a table via store
  const dbId = await page.evaluate(() => {
    const ws = (window as any).__testGetWorkspace?.()
    for (const sys of ws?.model?.softwareSystems ?? []) {
      for (const c of sys.containers ?? []) {
        if (c.name === 'Database') return c.id
      }
    }
    return null
  })
  await page.evaluate((cid) => {
    (window as any).__testStore?.().addTable?.(cid, 'users')
  }, dbId)
  await page.waitForTimeout(300)

  // Add another column
  await page.evaluate((cid) => {
    const store = (window as any).__testStore?.()
    const tables = store?.tableData?.[cid]
    if (tables?.[0]?.id) store?.addColumn?.(cid, tables[0].id)
  }, dbId)
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'e2e/db-table-view/debug-tab-content.png' })
  console.log('Screenshot saved')
})
