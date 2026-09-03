import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Zustand persist middleware uses localStorage. In jsdom/Node.js this may not be
// available (or may require --localstorage-file flag in Node 22), so we provide
// a lightweight in-memory mock so store tests do not crash on setItem.
const createLocalStorageMock = (): Storage => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store
      store = rest
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
  configurable: true,
})

if (typeof window !== 'undefined') {
  window.Element.prototype.scrollIntoView = vi.fn()
}
