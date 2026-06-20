import { test, expect } from '../fixtures/workspace'

// Traffic-light standard, as the browser reports computed `background-color`.
const GREEN = 'rgb(47, 138, 64)'   // New       #2f8a40
const AMBER = 'rgb(138, 94, 18)'   // Modified  #8a5e12
const SLATE = 'rgb(58, 66, 80)'    // Unchanged #3a4250
const RED = 'rgb(122, 46, 46)'     // Removed   #7a2e2e

const SYSTEM = 'Internet Banking System' // internal, top-level, in the default view

const CHANGE_TAGS = ['New', 'Modified', 'Unchanged', 'Removed']

test.describe('Element Change state', () => {
  test('New paints the fill green and tags the element', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('New')
    expect(await workspace.getNodeFill(SYSTEM)).toBe(GREEN)
    const el = await workspace.getElementByName(SYSTEM)
    expect(el?.tags).toContain('New')
  })

  test('Modified paints amber, Unchanged slate, Removed red', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('Modified')
    expect(await workspace.getNodeFill(SYSTEM)).toBe(AMBER)
    await workspace.selectChangeState('Unchanged')
    expect(await workspace.getNodeFill(SYSTEM)).toBe(SLATE)
    await workspace.selectChangeState('Removed')
    expect(await workspace.getNodeFill(SYSTEM)).toBe(RED)
  })

  test('switching New → Unchanged keeps exactly one change tag', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('New')
    await workspace.selectChangeState('Unchanged')
    const el = await workspace.getElementByName(SYSTEM)
    expect(el?.tags.filter((t) => CHANGE_TAGS.includes(t))).toEqual(['Unchanged'])
  })

  test('None clears the tag and reverts the fill', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    const baseline = await workspace.getNodeFill(SYSTEM)
    await workspace.selectChangeState('New')
    expect(await workspace.getNodeFill(SYSTEM)).toBe(GREEN)
    await workspace.selectChangeState('None')
    const el = await workspace.getElementByName(SYSTEM)
    expect(el?.tags.some((t) => CHANGE_TAGS.includes(t))).toBe(false)
    expect(await workspace.getNodeFill(SYSTEM)).toBe(baseline)
  })
})
