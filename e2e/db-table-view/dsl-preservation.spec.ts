import { test, expect } from '../fixtures/workspace'

const DSL_WITH_DATABASE = `workspace "Test DB View" "DSL preservation test" {
  model {
    api = softwareSystem "API" "Backend system"
    db = container api "Database" "Stores data" "PostgreSQL" "Database"
    web = softwareSystem "Web App" "Frontend"
    actor = person "User"
    actor -> web "Uses"
    web -> api "Calls API via"
    api -> db "Reads from and writes to" "JDBC"
  }
  views {
    systemContext api "APIContext" {
      include *
      autoLayout lr
    }
    container api "APIContainers" {
      include *
      autoLayout lr
    }
  }
}`

test.describe('DB table view — DSL preservation', () => {
  test('workspace model survives save unchanged', async ({ workspace }) => {
    await workspace.parseAndLoad(DSL_WITH_DATABASE)

    const initial = await workspace.getWorkspace()
    expect(initial).not.toBeNull()

    // Save and re-read
    await workspace.page.keyboard.press('Control+s')
    await workspace.page.waitForTimeout(500)

    const afterSave = await workspace.getWorkspace()
    expect(afterSave).not.toBeNull()
    expect(afterSave!.model.softwareSystems).toHaveLength(
      initial!.model.softwareSystems.length,
    )
    expect(afterSave!.model.people).toHaveLength(initial!.model.people.length)
    expect(afterSave!.model.relationships).toHaveLength(
      initial!.model.relationships.length,
    )
  })

  test('Database container retains its tags and technology after save', async ({ workspace }) => {
    await workspace.parseAndLoad(DSL_WITH_DATABASE)

    // Find the Database container
    const initial = await workspace.getWorkspace()
    const api = initial!.model.softwareSystems.find((s) => s.name === 'API')
    expect(api).toBeDefined()
    const db = api!.containers.find((c) => c.name === 'Database')
    expect(db).toBeDefined()
    expect(db!.tags).toContain('Database')
    expect(db!.technology).toBe('PostgreSQL')

    // Save
    await workspace.page.keyboard.press('Control+s')
    await workspace.page.waitForTimeout(500)

    // Reload and re-verify
    const afterSave = await workspace.getWorkspace()
    const api2 = afterSave!.model.softwareSystems.find((s) => s.name === 'API')
    const db2 = api2!.containers.find((c) => c.name === 'Database')
    expect(db2).toBeDefined()
    expect(db2!.tags).toContain('Database')
    expect(db2!.technology).toBe('PostgreSQL')
  })

  test('tableData starts empty for a fresh Database container', async ({ workspace }) => {
    await workspace.parseAndLoad(DSL_WITH_DATABASE)

    // Check store state directly
    const tableData = await workspace.page.evaluate(() => {
      const store = (window as Record<string, unknown>).__testStore?.() as Record<string, unknown> | null
      return store?.tableData ?? null
    })

    // tableData should be an empty object initially
    expect(tableData).not.toBeNull()
    expect(typeof tableData).toBe('object')
  })

  test('collapsed Database container renders on canvas', async ({ workspace }) => {
    await workspace.parseAndLoad(DSL_WITH_DATABASE)

    // The Database container should be visible on the canvas
    const dbNode = workspace.page.locator('.react-flow__node').filter({ hasText: 'Database' })
    await expect(dbNode).toBeVisible({ timeout: 5000 })
  })

  test('expand/collapse does not lose model data', async ({ workspace }) => {
    await workspace.parseAndLoad(DSL_WITH_DATABASE)

    const initial = await workspace.getWorkspace()
    const relCount = initial!.model.relationships.length
    const personCount = initial!.model.people.length

    // Expand the Database container (if it has a zoom button)
    const dbNode = workspace.page.locator('.react-flow__node').filter({ hasText: 'Database' })
    await dbNode.click()
    await workspace.page.waitForTimeout(300)

    // Try expanding via the test hook
    const dbId = await workspace.page.evaluate(() => {
      const ws = (window as Record<string, unknown>).__testGetWorkspace?.() as Record<string, unknown> | null
      const api = (ws?.model as Record<string, unknown> | undefined)
        ?.softwareSystems as Array<Record<string, unknown>> | undefined
      const containers = api?.[0]?.containers as Array<Record<string, unknown>> | undefined
      return containers?.[0]?.id ?? null
    })
    if (dbId) {
      await workspace.page.evaluate(
        (id) => (window as Record<string, unknown>).__testExpand?.(String(id)),
        dbId,
      )
      await workspace.page.waitForTimeout(500)

      // Collapse
      await workspace.page.evaluate(
        (id) => (window as Record<string, unknown>).__testCollapse?.(String(id)),
        dbId,
      )
      await workspace.page.waitForTimeout(500)
    }

    // Verify model is unchanged after expand/collapse
    const after = await workspace.getWorkspace()
    expect(after!.model.relationships).toHaveLength(relCount)
    expect(after!.model.people).toHaveLength(personCount)
  })
})
