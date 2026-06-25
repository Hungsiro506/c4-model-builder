import { test, expect } from '../fixtures/workspace'

test('debug — capture ALL console messages', async ({ workspace, page }) => {
  const msgs: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      msgs.push(`[${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => msgs.push(`[PAGE ERROR] ${err.message}`))

  await workspace.loadTemplate('bigBank')
  await page.evaluate(() => {
    const s = (window as any).__testStore?.()
    s?.setActiveView?.('Containers')
    s?.setRightPanelOpen?.(true)
  })
  await page.waitForTimeout(400)

  // Select DB, click Tables tab
  await page.locator('.react-flow__node').filter({ hasText: 'Database' }).click()
  await page.waitForTimeout(300)
  const tab = page.locator('[role="tab"]').filter({ hasText: 'Tables' })
  if (await tab.isVisible().catch(() => false)) await tab.click()
  await page.waitForTimeout(300)

  // Add table and column
  const dbId = await page.evaluate(() => {
    const ws = (window as any).__testGetWorkspace?.()
    for (const sys of ws?.model?.softwareSystems ?? [])
      for (const c of sys.containers ?? [])
        if (c.name === 'Database') return c.id
    return null
  })
  await page.evaluate((cid) => {
    const s = (window as any).__testStore?.()
    s?.addTable?.(cid, 'users')
  }, dbId)
  await page.waitForTimeout(300)

  // Print ALL errors/warnings
  for (const m of msgs) console.log(m)
  expect(msgs.filter(m => m.includes('[PAGE ERROR]') || m.includes('[error]')).length).toBe(0)
})
