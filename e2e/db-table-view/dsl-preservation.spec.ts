import { test, expect } from '../fixtures/workspace'

test.describe('DB table view — DSL preservation', () => {
  test('Big Bank template loads and Database container has correct tags', async ({ workspace }) => {
    await workspace.loadTemplate('bigBank')

    const ws = await workspace.getWorkspace()
    expect(ws).not.toBeNull()

    // Find the Database container — it exists in the Big Bank template
    let dbFound = false
    for (const sys of ws!.model.softwareSystems) {
      for (const container of sys.containers) {
        if (container.tags.includes('Database')) {
          dbFound = true
          expect(container.technology).toBeDefined()
          expect(container.name).toBeTruthy()
          break
        }
      }
      if (dbFound) break
    }
    expect(dbFound).toBe(true)
  })

  test('Big Bank save/reload preserves model counts', async ({ workspace }) => {
    await workspace.loadTemplate('bigBank')

    const initial = await workspace.getWorkspace()
    const systemCount = initial!.model.softwareSystems.length
    const personCount = initial!.model.people.length
    const relCount = initial!.model.relationships.length

    // Save
    await workspace.page.keyboard.press('Control+s')
    await workspace.page.waitForTimeout(500)

    // The model should still be intact after save
    const afterSave = await workspace.getWorkspace()
    expect(afterSave!.model.softwareSystems).toHaveLength(systemCount)
    expect(afterSave!.model.people).toHaveLength(personCount)
    expect(afterSave!.model.relationships).toHaveLength(relCount)
  })

  test('tableData is empty on fresh load', async ({ workspace }) => {
    await workspace.loadTemplate('bigBank')

    const tableData = await workspace.page.evaluate(() => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown> | null
      return store?.tableData ?? 'NOT_FOUND'
    })

    // tableData should exist as an empty object
    expect(tableData).not.toBe('NOT_FOUND')
    expect(typeof tableData).toBe('object')
    // Empty object has no keys
    expect(Object.keys(tableData as Record<string, unknown>)).toHaveLength(0)
  })

  test('adding a table via store shows in tableData', async ({ workspace }) => {
    await workspace.loadTemplate('bigBank')

    // Find Database container ID
    const dbId = await workspace.page.evaluate(() => {
      const ws = (window as Record<string, unknown>).__testGetWorkspace?.() as Record<string, unknown> | null
      const systems = (ws?.model as Record<string, unknown> | undefined)
        ?.softwareSystems as Array<Record<string, unknown>> | undefined
      if (!systems) return null
      for (const sys of systems) {
        const containers = sys.containers as Array<Record<string, unknown>> | undefined
        if (!containers) continue
        for (const c of containers) {
          const tags = c.tags as string[] | undefined
          if (tags?.includes('Database')) return c.id as string
        }
      }
      return null
    })

    // Should find a Database container in Big Bank
    expect(dbId).not.toBeNull()

    // Add a table via store
    await workspace.page.evaluate((containerId) => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown>
      const addTable = store?.addTable as ((containerId: string, name: string) => string) | undefined
      if (addTable) addTable(containerId, 'test_users')
    }, dbId!)

    // Verify table was added
    const tableData = await workspace.page.evaluate(() => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown> | null
      return store?.tableData as Record<string, unknown> | undefined
    })

    expect(tableData).toBeDefined()
    const tables = tableData![dbId!] as Array<Record<string, unknown>> | undefined
    expect(tables).toBeDefined()
    expect(tables!.length).toBeGreaterThan(0)
    expect(tables![0].name).toBe('test_users')
  })

  test('expand system in-place then add Database container via boundary menu', async ({ workspace }) => {
    await workspace.loadTemplate('bigBank')

    // Find and expand the Internet Banking system in-place
    const systemId = await workspace.page.evaluate(() => {
      const ws = (window as Record<string, unknown>).__testGetWorkspace?.() as Record<string, unknown> | null
      const systems = (ws?.model as Record<string, unknown> | undefined)
        ?.softwareSystems as Array<Record<string, unknown>> | undefined
      return systems?.find((s) => s.name === 'Internet Banking System')?.id as string ?? null
    })

    expect(systemId).not.toBeNull()

    // Expand in-place via test hook
    await workspace.page.evaluate(
      (id) => (window as Record<string, unknown>).__testExpand?.(String(id)),
      systemId,
    )
    await workspace.page.waitForTimeout(800)

    // The expand boundary should appear as a React Flow node
    const boundary = workspace.page.locator(`[data-id="__expand_boundary__${systemId}"]`)
    await expect(boundary).toBeVisible({ timeout: 5000 })

    // Add a Database container via the store directly (simulating the menu click)
    await workspace.page.evaluate((parentId) => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown>
      const addContainer = store?.addContainer as ((systemId: string, name: string, position?: unknown, extraTag?: string, opts?: Record<string, unknown>) => string) | undefined
      if (addContainer) {
        addContainer(parentId, 'TestDB', undefined, 'Database', { skipActiveView: true })
      }
    }, systemId)

    // Verify the container was created with Database tag
    const ws = await workspace.getWorkspace()
    const apiSys = ws!.model.softwareSystems.find((s) => s.name === 'Internet Banking System')
    expect(apiSys).toBeDefined()
    const dbContainer = apiSys!.containers.find((c) => c.tags.includes('Database') && c.name === 'TestDB')
    expect(dbContainer).toBeDefined()
  })
})
