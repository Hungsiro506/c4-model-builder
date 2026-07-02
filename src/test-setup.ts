// Auto-mock react-router-dom for tests that don't wrap in a Router.
// Tests that need real routing should mock it themselves.
import { vi } from 'vitest'

// localStorage / sessionStorage polyfill.
//
// jsdom 29 running on Node >=22 leaves `window.localStorage` as an own
// property whose value is `undefined`: it defers to Node's native
// `globalThis.localStorage`, which is only present when the process was
// started with `--localstorage-file`. Under `vitest run` that flag is absent,
// so every suite that calls `localStorage.*` (settings, observability,
// viewport storage, CanvasHints, …) throws
// "Cannot read properties of undefined (reading 'clear')".
//
// Install a real in-memory Storage on both window and globalThis so the test
// env matches a browser regardless of Node version or jsdom quirks. Kept
// dependency-free (no jsdom internals) so it survives engine upgrades.
class MemoryStorage implements Storage {
  #map = new Map<string, string>()
  get length(): number { return this.#map.size }
  key(index: number): string | null { return [...this.#map.keys()][index] ?? null }
  getItem(key: string): string | null { return this.#map.has(key) ? this.#map.get(key)! : null }
  setItem(key: string, value: string): void { this.#map.set(String(key), String(value)) }
  removeItem(key: string): void { this.#map.delete(key) }
  clear(): void { this.#map.clear() }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const store = new MemoryStorage()
  Object.defineProperty(window, name, { configurable: true, writable: true, value: store })
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: store })
}

// window.matchMedia is not implemented in jsdom. Stub it so any module that
// calls matchMedia at import time (e.g. settings.ts isMobile check) doesn't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
    useParams: () => ({}),
  }
})
