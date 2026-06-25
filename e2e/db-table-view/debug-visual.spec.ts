import { test, expect } from '../fixtures/workspace'

test('debug — screenshot and console errors after expand + add database', async ({ workspace, page }) => {
  const errors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push(err.message))

  await workspace.loadTemplate('bigBank')

  // Find and expand Internet Banking system
  const sysId = await page.evaluate(() => {
    const ws = (window as Record<string, unknown>).__testGetWorkspace?.() as Record<string, unknown> | null
    const systems = (ws?.model as Record<string, unknown> | undefined)
      ?.softwareSystems as Array<Record<string, unknown>> | undefined
    return systems?.find((s) => s.name === 'Internet Banking System')?.id as string ?? null
  })

  expect(sysId).not.toBeNull()
  await page.evaluate((id) => (window as Record<string, unknown>).__testExpand?.(String(id)), sysId)
  await page.waitForTimeout(500)

  // Screenshot: system expanded in-place
  await page.screenshot({ path: 'e2e/db-table-view/debug-1-expanded.png' })

  // Add a Database container inside the expanded boundary
  await page.evaluate((parentId) => {
    const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown>
    const addContainer = store?.addContainer as ((systemId: string, name: string, pos?: unknown, tag?: string, opts?: Record<string, unknown>) => string) | undefined
    addContainer?.(parentId, 'TestDB', undefined, 'Database', { skipActiveView: true })
  }, sysId)
  await page.waitForTimeout(500)

  // Screenshot: after Database added
  await page.screenshot({ path: 'e2e/db-table-view/debug-2-db-added.png' })

  // Expand the Database
  const dbId = await page.evaluate(() => {
    const ws = (window as Record<string, unknown>).__testGetWorkspace?.() as Record<string, unknown> | null
    const systems = (ws?.model as Record<string, unknown> | undefined)
      ?.softwareSystems as Array<Record<string, unknown>> | undefined
    for (const sys of systems ?? []) {
      const containers = sys.containers as Array<Record<string, unknown>> | undefined
      for (const c of containers ?? []) {
        if ((c.tags as string[] | undefined)?.includes('Database') && c.name === 'TestDB') {
          return c.id as string
        }
      }
    }
    return null
  })

  if (dbId) {
    await page.evaluate((id) => (window as Record<string, unknown>).__testExpand?.(String(id)), dbId)
    await page.waitForTimeout(500)

    // Screenshot: Database expanded with empty boundary
    await page.screenshot({ path: 'e2e/db-table-view/debug-3-db-expanded.png' })

    // Add a table
    await page.evaluate((containerId) => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown>
      const addTable = store?.addTable as ((cid: string, name: string) => void) | undefined
      addTable?.(containerId, 'users')
    }, dbId)
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/db-table-view/debug-4-table-added.png' })
  }

  // Report errors (filter noise)
  const realErrors = errors.filter((e) =>
    !e.includes('favicon') &&
    !e.includes('preamble') &&
    !e.includes('React Refresh') &&
    !e.includes('__vite'),
  )
  console.log('CONSOLE ERRORS:', realErrors.length === 0 ? 'NONE' : realErrors.join('\n'))
  expect(realErrors).toHaveLength(0)
})
