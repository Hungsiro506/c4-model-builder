import { test, expect } from '../fixtures/workspace'

// A change state must survive the save path — it's a plain tag, so it lands in
// the auto-saved (crash-recovery) workspace like any other tag.
const SYSTEM = 'Internet Banking System'

test.describe('Change state persists', () => {
  test('set change state is written into the auto-saved workspace', async ({ workspace }) => {
    await workspace.loadSample()
    await workspace.clickNode(SYSTEM)
    await workspace.selectChangeState('New')

    const persisted = await workspace.page
      .waitForFunction(
        () => {
          const saved = localStorage.getItem('c4hero_crash_recovery')
          return saved && saved.includes('"New"') ? saved : null
        },
        { timeout: 5000 },
      )
      .then((h) => h.jsonValue())

    expect(persisted).toBeTruthy()
  })
})
