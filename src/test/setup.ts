import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock IndexedDB for happy-dom/jsdom environment
const indexedDB = {
  open: vi.fn().mockReturnValue({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
          delete: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
        }),
        onerror: null,
      }),
    },
  }),
};

vi.stubGlobal('indexedDB', indexedDB);

// Mock scrollIntoView which is missing in JSDOM/happy-dom
if (typeof window !== 'undefined') {
  window.Element.prototype.scrollIntoView = vi.fn();
}
