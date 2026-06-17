import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const axonDsl = readFileSync(resolve(__dirname, 'axon.dsl'), 'utf8')

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

// Drag a node by its model id (the fixture's dragNodeBy works on display name).
async function dragById(page: Page, id: string, delta: { x: number; y: number }) {
  const box = await nodeBox(page, id)
  if (!box) throw new Error(`No box for node ${id}`)
  const startX = box.x + box.width / 2
  const startY = box.y + Math.min(box.height / 2, 28)
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}

test.describe('Expand-in-place — move while expanded', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(axonDsl)
  })

  test('dragging an expanded child persists across a collapse/re-expand cycle', async ({ workspace }) => {
    const page = workspace.page
    await expandNode(page, 'edca')

    const before = await nodeBox(page, 'web')
    expect(before).not.toBeNull()

    // Drag the expanded child. Persisting writes into view.expandedLayout.
    await dragById(page, 'web', { x: 80, y: 60 })

    const dragged = await nodeBox(page, 'web')
    expect(dragged).not.toBeNull()
    // The drag must take effect (not snap back to the dagre slot).
    expect(Math.abs(dragged!.x - before!.x)).toBeGreaterThan(40)

    // Collapse + re-expand → subtree is re-laid-out by dagre, but the saved
    // position must win. The child returns to where it was dragged.
    await collapseNode(page, 'edca')
    await expandNode(page, 'edca')

    const restored = await nodeBox(page, 'web')
    expect(restored).not.toBeNull()
    expect(Math.abs(restored!.x - dragged!.x)).toBeLessThanOrEqual(3)
    expect(Math.abs(restored!.y - dragged!.y)).toBeLessThanOrEqual(3)
  })

  test('dragging the expanded boundary header moves the whole box (children translate together)', async ({ workspace }) => {
    const page = workspace.page
    await expandNode(page, 'edca')

    const webBefore = await nodeBox(page, 'web')
    const hermesBefore = await nodeBox(page, 'hermes')
    expect(webBefore).not.toBeNull()
    expect(hermesBefore).not.toBeNull()

    // Grab the boundary header (the drag handle) and drag the whole cluster.
    const header = page.locator('.react-flow__node[data-id="__expand_boundary__edca"] .c4-overlay-drag-handle')
    const hb = await header.boundingBox()
    expect(hb).not.toBeNull()
    await page.mouse.move(hb!.x + 12, hb!.y + 10)
    await page.mouse.down()
    await page.mouse.move(hb!.x + 12 + 90, hb!.y + 10 + 70, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const webAfter = await nodeBox(page, 'web')
    const hermesAfter = await nodeBox(page, 'hermes')
    // Both children shifted by roughly the same delta → moved as a unit.
    expect(webAfter!.x - webBefore!.x).toBeGreaterThan(40)
    expect(hermesAfter!.x - hermesBefore!.x).toBeGreaterThan(40)
    expect(Math.abs((webAfter!.x - webBefore!.x) - (hermesAfter!.x - hermesBefore!.x))).toBeLessThanOrEqual(4)

    // Persists across collapse/re-expand.
    await collapseNode(page, 'edca')
    await expandNode(page, 'edca')
    const webRestored = await nodeBox(page, 'web')
    expect(Math.abs(webRestored!.x - webAfter!.x)).toBeLessThanOrEqual(3)
    expect(Math.abs(webRestored!.y - webAfter!.y)).toBeLessThanOrEqual(3)
  })

  test('dragging the boundary body (not just the header) moves the box, does not pan', async ({ workspace }) => {
    const page = workspace.page
    await expandNode(page, 'edca')

    const webBefore = await nodeBox(page, 'web')
    const box = await page.locator('.react-flow__node[data-id="__expand_boundary__edca"]').first().boundingBox()
    expect(box).not.toBeNull()
    expect(webBefore).not.toBeNull()

    const hermesBefore = await nodeBox(page, 'hermes')
    expect(hermesBefore).not.toBeNull()

    // Grab an empty region of the box body — the left padding column, vertically
    // centred so it sits beside the children (which fill the box interior) rather
    // than on top of them. The body is pointer-opaque, so this moves the box
    // rather than panning the canvas.
    const grabX = box!.x + 8
    const grabY = box!.y + box!.height / 2
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.mouse.move(grabX + 100, grabY + 40, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const webAfter = await nodeBox(page, 'web')
    const hermesAfter = await nodeBox(page, 'hermes')
    // Both children moved together → the whole box dragged as a unit (not a single
    // child drag, and not a viewport pan — persistence check below rules out pan).
    expect(webAfter!.x - webBefore!.x).toBeGreaterThan(40)
    expect(hermesAfter!.x - hermesBefore!.x).toBeGreaterThan(40)
    expect(Math.abs((webAfter!.x - webBefore!.x) - (hermesAfter!.x - hermesBefore!.x))).toBeLessThanOrEqual(4)

    // Confirm it was a node move, not a pan: collapse/re-expand and the child
    // returns to the dragged spot (a pan would not persist).
    await collapseNode(page, 'edca')
    await expandNode(page, 'edca')
    const webRestored = await nodeBox(page, 'web')
    expect(Math.abs(webRestored!.x - webAfter!.x)).toBeLessThanOrEqual(3)
  })
})
