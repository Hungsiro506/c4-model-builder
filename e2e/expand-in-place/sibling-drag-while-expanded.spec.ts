import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const axonDsl = readFileSync(resolve(__dirname, 'axon.dsl'), 'utf8')

// Dragging a top-level sibling while another system is expanded persists the
// node's LIVE (post-gap-shift) position. The layout memo must not re-apply the
// expansion gap-shift to that stored position — when it does, edges are built
// for a phantom position (wrong handle sides) and the node teleports on the
// next structural rebuild.

test.use({ viewport: { width: 1600, height: 1000 } })

async function nodeBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox()
}

async function expandNode(page: Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testExpand?.(elementId)
  }, id)
  await page.waitForTimeout(300)
}

async function collapseNode(page: Page, id: string) {
  await page.evaluate((elementId) => {
    (window as Record<string, unknown>).__testCollapse?.(elementId)
  }, id)
  await page.waitForTimeout(300)
}

async function dragById(page: Page, id: string, to: { x: number; y: number }) {
  const box = await nodeBox(page, id)
  if (!box) throw new Error(`No box for node ${id}`)
  const startX = box.x + box.width / 2
  const startY = box.y + Math.min(box.height / 2, 28)
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}

/** Screen-space coordinates of an edge path's endpoints. */
async function edgeEndpoints(page: Page, edgeTestId: string) {
  return page
    .locator(`[data-testid="${edgeTestId}"] .react-flow__edge-path`)
    .first()
    .evaluate((el) => {
      const path = el as SVGPathElement
      const ctm = path.getScreenCTM()
      if (!ctm) throw new Error('No CTM for edge path')
      const toScreen = (p: DOMPoint) => {
        const pt = new DOMPoint(p.x, p.y).matrixTransform(ctm)
        return { x: pt.x, y: pt.y }
      }
      const len = path.getTotalLength()
      return {
        start: toScreen(path.getPointAtLength(0)),
        end: toScreen(path.getPointAtLength(len)),
      }
    })
}

test.describe('Expand-in-place — sibling drag while expanded', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(axonDsl)
    await workspace.page.waitForTimeout(500)
  })

  test('edge from dragged sibling attaches to the boundary side facing it', async ({ workspace }) => {
    const page = workspace.page
    await expandNode(page, 'dataStore')

    // Drag EDCA so it sits to the LEFT of the DataStore boundary, in the
    // boundary's lower half. hermes→deploymentWorker re-targets to
    // edca→boundary (rel-5); its target must anchor on the boundary's LEFT side.
    const boundary = await nodeBox(page, '__expand_boundary__dataStore')
    expect(boundary).not.toBeNull()
    await dragById(page, 'edca', {
      x: boundary!.x - 260,
      y: boundary!.y + boundary!.height * 0.75,
    })

    const { end } = await edgeEndpoints(page, 'rf__edge-rel-5')
    const box = (await nodeBox(page, '__expand_boundary__dataStore'))!
    // Target endpoint sits on the boundary's left edge (not its bottom).
    expect(Math.abs(end.x - box.x)).toBeLessThanOrEqual(14)
    expect(end.y).toBeGreaterThan(box.y + 10)
    expect(end.y).toBeLessThan(box.y + box.height - 10)
  })

  test('dragged sibling does not teleport across a collapse/re-expand cycle', async ({ workspace }) => {
    const page = workspace.page
    await expandNode(page, 'dataStore')

    const boundary = await nodeBox(page, '__expand_boundary__dataStore')
    expect(boundary).not.toBeNull()
    await dragById(page, 'edca', {
      x: boundary!.x - 260,
      y: boundary!.y + boundary!.height * 0.75,
    })
    const dragged = await nodeBox(page, 'edca')
    expect(dragged).not.toBeNull()

    // Re-running the layout pipeline (collapse → expand) must reproduce the
    // exact position the user dropped the node at — not shift it again.
    await collapseNode(page, 'dataStore')
    await expandNode(page, 'dataStore')

    const restored = await nodeBox(page, 'edca')
    expect(restored).not.toBeNull()
    expect(Math.abs(restored!.x - dragged!.x)).toBeLessThanOrEqual(3)
    expect(Math.abs(restored!.y - dragged!.y)).toBeLessThanOrEqual(3)
  })
})
