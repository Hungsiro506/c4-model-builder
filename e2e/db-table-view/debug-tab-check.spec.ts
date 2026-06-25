import { test } from '../fixtures/workspace'

test('debug — check Tables tab presence', async ({ workspace, page }) => {
  await workspace.loadTemplate('bigBank')
  await page.evaluate(() => {
    const store = (window as any).__testStore?.()
    store?.setActiveView?.('Containers')
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const store = (window as any).__testStore?.()
    store?.setRightPanelOpen?.(true)
  })
  await page.waitForTimeout(300)

  const dbNode = page.locator('.react-flow__node').filter({ hasText: 'Database' })
  await dbNode.click()
  await page.waitForTimeout(500)

  // Check all tabs
  const tabs = page.locator('[role="tab"]')
  const count = await tabs.count()
  console.log('Tab count:', count)
  for (let i = 0; i < count; i++) {
    const text = await tabs.nth(i).textContent()
    console.log(`Tab ${i}: "${text}"`)
  }

  // Check if the Database element tags include 'Database'
  const dbInfo = await page.evaluate(() => {
    const ws = (window as any).__testGetWorkspace?.()
    const systems = ws?.model?.softwareSystems
    for (const sys of systems ?? []) {
      for (const c of sys.containers ?? []) {
        if (c.name === 'Database') return { id: c.id, tags: c.tags, type: c.type }
      }
    }
    return null
  })
  console.log('DB info:', JSON.stringify(dbInfo))

  await page.screenshot({ path: 'e2e/db-table-view/debug-tab-check.png' })
})
