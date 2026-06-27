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

test.describe('FK dropdown bug', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(dsl)
    await workspace.page.waitForTimeout(500)
  })

  test('after addFkEdge, fkEdges lookup finds the edge by sourceColumnId', async ({ workspace }) => {
    const page = workspace.page
    const ws = await workspace.getWorkspace()
    const dbId = ws!.model.softwareSystems[0].containers[0].id

    // Setup: customers (PK id), orders (FK customer_id → customers)
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

    // Add FK column + mark it
    const fkCol = await page.evaluate(({ cid, tid }: { cid: string; tid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddColumn?.(cid, tid, 'customer_id', 'int') as { id: string }
    , { cid: dbId, tid: orders.id })
    await page.evaluate(({ cid, tid, colId }: { cid: string; tid: string; colId: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        updateColumn: (cid: string, tid: string, colId: string, patch: Record<string, unknown>) => void
      }
      store.updateColumn(cid, tid, colId, { isForeignKey: true })
    }, { cid: dbId, tid: orders.id, colId: fkCol.id })

    // Simulate dropdown selection: addFkEdge(orders, customers, fkCol.id)
    await page.evaluate(({ cid, stid, ttid, scid }: { cid: string; stid: string; ttid: string; scid: string }) =>
      (window as unknown as Record<string, CallableFunction>).__testAddFkEdge?.(cid, stid, ttid, scid) as { id: string }
    , { cid: dbId, stid: orders.id, ttid: customers.id, scid: fkCol.id })

    // Now verify: the FK edge is findable by sourceColumnId
    const found = await page.evaluate(({ cid, stid, scid }: { cid: string; stid: string; scid: string }) => {
      const store = (window as unknown as Record<string, CallableFunction>).__testStore?.() as {
        fkEdges: Record<string, Array<{ id: string; sourceTableId: string; targetTableId: string; sourceColumnId?: string }>>
      }
      const edges = store.fkEdges[cid] ?? []
      const edge = edges.find(e => e.sourceTableId === stid && e.sourceColumnId === scid)
      return { found: !!edge, targetTableId: edge?.targetTableId ?? null }
    }, { cid: dbId, stid: orders.id, scid: fkCol.id })

    expect(found.found).toBe(true)
    expect(found.targetTableId).toBe(customers.id)
  })
})
