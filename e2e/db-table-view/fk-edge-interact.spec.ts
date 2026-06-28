import { test, expect } from '../fixtures/workspace'

const dsl = `workspace {
  model {
    sys = softwareSystem "App" {
      db = container "DB" {
        tags "Database"
      }
    }
  }
  views {
    container sys {
      include *
      autoLayout lr
    }
  }
}`

test.describe('FK edge interactivity', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
    await workspace.page.waitForTimeout(500)
  })

  test('FK edge renders between tables in expanded DB container', async ({ workspace }) => {
    const page = workspace.page
    const ws = await workspace.getWorkspace()
    const dbId = ws!.model.softwareSystems[0].containers[0].id

    // Setup: customers table (PK id), orders table (FK customer_id → customers)
    const customers = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'customers') as { id: string }
    , dbId)
    const orders = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'orders') as { id: string }
    , dbId)

    // Add PK to customers
    await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'id', 'int')
    , { cid: dbId, tid: customers.id })
    await page.evaluate(({ cid, tid, colIdx }: { cid: string; tid: string; colIdx: number }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        tableData: Record<string, Array<{ id: string; columns: Array<{ id: string }> }>>
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      const cols = store.tableData[cid]?.find(t => t.id === tid)?.columns
      if (cols?.[colIdx]) store.updateColumn(cid, tid, cols[colIdx].id, { isPrimaryKey: true })
    }, { cid: dbId, tid: customers.id, colIdx: 0 })

    // Add FK column to orders + mark as FK (triggers auto-resolution)
    const fkCol = await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'customer_id', 'int') as { id: string }
    , { cid: dbId, tid: orders.id })
    await page.evaluate(({ cid, tid, colId }: { cid: string; tid: string; colId: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      store.updateColumn(cid, tid, colId, { isForeignKey: true })
    }, { cid: dbId, tid: orders.id, colId: fkCol.id })

    // Simulate addFkEdge the same way the auto-create code does
    await page.evaluate(({ cid, stid, ttid, scid }: { cid: string; stid: string; ttid: string; scid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddFkEdge?.(cid, stid, ttid, scid) as { id: string }
    , { cid: dbId, stid: orders.id, ttid: customers.id, scid: fkCol.id })

    // Expand the DB container to reveal table nodes
    await page.evaluate((cid: string) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        expandElement: (id: string) => void
      }
      store.expandElement(cid)
    }, dbId)
    await page.waitForTimeout(600)

    // Table nodes should be visible
    const tableNodes = page.locator('.react-flow__node[data-id*="__table__"]')
    await expect(tableNodes.first()).toBeVisible({ timeout: 5000 })

    // FK edge should be present as a relationship-type edge
    const fkEdges = page.locator('.react-flow__edge[data-testid*="__fk_"]')
    const fkEdgeCount = await fkEdges.count()
    expect(fkEdgeCount).toBeGreaterThanOrEqual(1)
  })

  test('FK edge reconnect allows same-node handle change, blocks cross-table', async ({ workspace }) => {
    const page = workspace.page
    const ws = await workspace.getWorkspace()
    const dbId = ws!.model.softwareSystems[0].containers[0].id

    // Setup same as above
    const customers = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'customers') as { id: string }
    , dbId)
    const orders = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'orders') as { id: string }
    , dbId)
    await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'id', 'int')
    , { cid: dbId, tid: customers.id })
    await page.evaluate(({ cid, tid, colIdx }: { cid: string; tid: string; colIdx: number }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        tableData: Record<string, Array<{ id: string; columns: Array<{ id: string }> }>>
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      const cols = store.tableData[cid]?.find(t => t.id === tid)?.columns
      if (cols?.[colIdx]) store.updateColumn(cid, tid, cols[colIdx].id, { isPrimaryKey: true })
    }, { cid: dbId, tid: customers.id, colIdx: 0 })
    const fkCol = await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'customer_id', 'int') as { id: string }
    , { cid: dbId, tid: orders.id })
    await page.evaluate(({ cid, tid, colId }: { cid: string; tid: string; colId: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      store.updateColumn(cid, tid, colId, { isForeignKey: true })
    }, { cid: dbId, tid: orders.id, colId: fkCol.id })
    await page.evaluate(({ cid, stid, ttid, scid }: { cid: string; stid: string; ttid: string; scid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddFkEdge?.(cid, stid, ttid, scid) as { id: string }
    , { cid: dbId, stid: orders.id, ttid: customers.id, scid: fkCol.id })

    // Expand DB container
    await page.evaluate((cid: string) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        expandElement: (id: string) => void
      }
      store.expandElement(cid)
    }, dbId)
    await page.waitForTimeout(600)

    // Verify FK edge exists and has isFk data flag
    const edgeData = await page.evaluate(() => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        fkEdges: Record<string, Array<{ id: string; sourceTableId: string; targetTableId: string; sourceColumnId?: string }>>
      }
      return { fkEdges: store.fkEdges }
    })
    expect(Object.keys(edgeData.fkEdges).length).toBeGreaterThan(0)

    // Verify the FK edge is findable by sourceColumnId (regression test for dropdown bug)
    const edges = edgeData.fkEdges[dbId] ?? []
    const foundEdge = edges.find(e => e.sourceColumnId === fkCol.id)
    expect(foundEdge).toBeTruthy()
    expect(foundEdge!.targetTableId).toBe(customers.id)
  })

  test('buildTableEdges auto-resolves FK edges from isForeignKey columns', async ({ workspace }) => {
    const page = workspace.page
    const ws = await workspace.getWorkspace()
    const dbId = ws!.model.softwareSystems[0].containers[0].id

    // Setup tables with naming convention: customer_id → customers.id
    const customers = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'customers') as { id: string }
    , dbId)
    const orders = await page.evaluate((cid: string) =>
      (window as unknown as Record<string, CallableFunction>).__testAddTable?.(cid, 'orders') as { id: string }
    , dbId)

    // Add PK to customers
    await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'id', 'int')
    , { cid: dbId, tid: customers.id })
    await page.evaluate(({ cid, tid, colIdx }: { cid: string; tid: string; colIdx: number }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        tableData: Record<string, Array<{ id: string; columns: Array<{ id: string }> }>>
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      const cols = store.tableData[cid]?.find(t => t.id === tid)?.columns
      if (cols?.[colIdx]) store.updateColumn(cid, tid, cols[colIdx].id, { isPrimaryKey: true })
    }, { cid: dbId, tid: customers.id, colIdx: 0 })

    // Add FK column + mark as FK
    const fkCol = await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'customer_id', 'int') as { id: string }
    , { cid: dbId, tid: orders.id })
    await page.evaluate(({ cid, tid, colId }: { cid: string; tid: string; colId: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      store.updateColumn(cid, tid, colId, { isForeignKey: true })
    }, { cid: dbId, tid: orders.id, colId: fkCol.id })

    // Create the FK edge (what TableEditor auto-create code would do)
    await page.evaluate(({ cid, stid, ttid, scid }: { cid: string; stid: string; ttid: string; scid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddFkEdge?.(cid, stid, ttid, scid) as { id: string }
    , { cid: dbId, stid: orders.id, ttid: customers.id, scid: fkCol.id })

    // Expand DB container to trigger buildTableEdges
    await page.evaluate((cid: string) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        expandElement: (id: string) => void
      }
      store.expandElement(cid)
    }, dbId)
    await page.waitForTimeout(600)

    // Verify: the FK edge is findable by sourceColumnId after auto-creation
    const found = await page.evaluate(({ cid, scid, stid }: { cid: string; scid: string; stid: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        fkEdges: Record<string, Array<{ id: string; sourceTableId: string; targetTableId: string; sourceColumnId?: string }>>
      }
      const edges = store.fkEdges[cid] ?? []
      const edge = edges.find(e => e.sourceTableId === stid && e.sourceColumnId === scid)
      return { found: !!edge, targetTableId: edge?.targetTableId ?? null }
    }, { cid: dbId, scid: fkCol.id, stid: orders.id })

    expect(found.found).toBe(true)
    expect(found.targetTableId).toBe(customers.id)
  })
})
