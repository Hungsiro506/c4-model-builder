import { describe, it, expect, beforeEach } from 'vitest'

// Guards the localStorage/sessionStorage polyfill installed by test-setup.ts.
// jsdom 29 on Node >=22 leaves window.localStorage as an own property whose
// value is undefined (it defers to Node's native globalThis.localStorage,
// which is absent without --localstorage-file), so any suite calling
// localStorage.* would crash. The setup installs a real in-memory Storage;
// this locks that in so a future setup/jsdom/Node change can't silently
// re-break the ~39 suites that touch storage.
describe('test env storage polyfill', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('exposes a working localStorage global', () => {
    expect(typeof localStorage).toBe('object')
    localStorage.setItem('k', 'v')
    expect(localStorage.getItem('k')).toBe('v')
    expect(localStorage.length).toBe(1)
    expect(localStorage.key(0)).toBe('k')
    localStorage.removeItem('k')
    expect(localStorage.getItem('k')).toBeNull()
    localStorage.setItem('a', '1')
    localStorage.clear()
    expect(localStorage.length).toBe(0)
  })

  it('resolves the same object via window and globalThis', () => {
    expect(window.localStorage).toBe(localStorage)
    expect(globalThis.localStorage).toBe(localStorage)
  })

  it('exposes a working sessionStorage global', () => {
    sessionStorage.setItem('s', 'x')
    expect(sessionStorage.getItem('s')).toBe('x')
    expect(sessionStorage.length).toBe(1)
  })

  it('keeps localStorage and sessionStorage isolated', () => {
    localStorage.setItem('shared', 'local')
    sessionStorage.setItem('shared', 'session')
    expect(localStorage.getItem('shared')).toBe('local')
    expect(sessionStorage.getItem('shared')).toBe('session')
  })
})
