import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../fixtures/workspace'
import type { Page } from '@playwright/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const axonDsl = readFileSync(resolve(__dirname, 'axon.dsl'), 'utf8')

// new   = #1f6feb = rgb(31, 111, 235)
// existing = #6b7280 = rgb(107, 114, 128)
const NEW_RGB = 'rgb(31, 111, 235)'
const EXISTING_RGB = 'rgb(107, 114, 128)'

async function nodeBg(page: Page, id: string): Promise<string> {
  return page.locator(`.react-flow__node[data-id="${id}"] .c4-node`).first()
    .evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor)
}

async function nodeBox(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox()
}

async function isNodeVisible(page: Page, id: string): Promise<boolean> {
  return (await page.locator(`.react-flow__node[data-id="${id}"]`).count()) > 0
}

// parseAndLoad only waits for the canvas to appear, not for the initial
// fit-to-view to settle. Wait until the viewport transform stops changing so
// position assertions compare against a stable (already-fitted) baseline.
async function waitForViewportSettle(page: Page) {
  await page.locator('.react-flow__viewport').evaluate((el) =>
    new Promise<void>((resolve) => {
      let stableFrames = 0
      let last = (el as HTMLElement).style.transform
      const check = () => {
        const cur = (el as HTMLElement).style.transform
        if (cur === last) {
          if (++stableFrames >= 3) { resolve(); return }
        } else {
          stableFrames = 0
          last = cur
        }
        requestAnimationFrame(check)
      }
      requestAnimationFrame(check)
    }),
  )
}

// Expand-in-place test hooks. Added in Stage 2; until then these are no-ops and
// the expand assertions stay red (TDD north star).
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

test.describe('Expand-in-place (semantic zoom)', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.parseAndLoad(axonDsl)
    await waitForViewportSettle(workspace.page)
  })

  // ── Verify existing support (should pass at Stage 0) ──────────────────

  test('1. baseline context shows all top-level elements', async ({ workspace }) => {
    // 2 people + 4 software systems, no containers expanded yet.
    expect(await workspace.getNodeCount()).toBe(6)
    expect(await isNodeVisible(workspace.page, 'edca')).toBe(true)
    expect(await isNodeVisible(workspace.page, 'rms')).toBe(true)
    // Containers must NOT be visible before expanding.
    expect(await isNodeVisible(workspace.page, 'web')).toBe(false)
  })

  test('2. colors apply from tags (new vs existing)', async ({ workspace }) => {
    expect(await nodeBg(workspace.page, 'edca')).toBe(EXISTING_RGB)
    expect(await nodeBg(workspace.page, 'rms')).toBe(EXISTING_RGB)
  })

  // ── Expand-in-place behavior (red until built) ────────────────────────

  test('3. expanding EDCA keeps sibling RMS in place', async ({ workspace }) => {
    const before = await nodeBox(workspace.page, 'rms')
    await expandNode(workspace.page, 'edca')
    const after = await nodeBox(workspace.page, 'rms')
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2)
  })

  test('4. expanding EDCA shows its containers in place', async ({ workspace }) => {
    await expandNode(workspace.page, 'edca')
    expect(await isNodeVisible(workspace.page, 'web')).toBe(true)
    expect(await isNodeVisible(workspace.page, 'hermes')).toBe(true)
    // Other systems still present.
    expect(await isNodeVisible(workspace.page, 'rms')).toBe(true)
    expect(await isNodeVisible(workspace.page, 'dataStore')).toBe(true)
  })

  test('5. expanded child connects to collapsed sibling box', async ({ workspace }) => {
    await expandNode(workspace.page, 'edca')
    // hermes -> configsvc; RMS collapsed → edge resolves onto the RMS box.
    // At least the edge layer should now contain an edge touching rms.
    const edgeCount = await workspace.getEdgeCount()
    expect(edgeCount).toBeGreaterThan(0)
    expect(await isNodeVisible(workspace.page, 'configsvc')).toBe(false)
  })

  test('6. expanding both EDCA and RMS reveals finest edge', async ({ workspace }) => {
    await expandNode(workspace.page, 'edca')
    await expandNode(workspace.page, 'rms')
    expect(await isNodeVisible(workspace.page, 'hermes')).toBe(true)
    expect(await isNodeVisible(workspace.page, 'configsvc')).toBe(true)
  })

  test('7. colors persist across zoom (new container stays new color)', async ({ workspace }) => {
    await expandNode(workspace.page, 'dataStore')
    // Deployment Worker is a NEW container — must render with the new color.
    expect(await nodeBg(workspace.page, 'deploymentWorker')).toBe(NEW_RGB)
    expect(await nodeBg(workspace.page, 'eventConductor')).toBe(EXISTING_RGB)
  })

  test('8. collapsing EDCA restores baseline', async ({ workspace }) => {
    const before = await nodeBox(workspace.page, 'rms')
    await expandNode(workspace.page, 'edca')
    await collapseNode(workspace.page, 'edca')
    expect(await isNodeVisible(workspace.page, 'web')).toBe(false)
    expect(await workspace.getNodeCount()).toBe(6)
    const after = await nodeBox(workspace.page, 'rms')
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(2)
  })
})
