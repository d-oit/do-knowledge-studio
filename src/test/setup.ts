import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock IndexedDB for happy-dom environment
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

// Mock import.meta.env.DEV as true for tests to enable perf measurements and other dev features
vi.stubGlobal('import.meta', {
  env: {
    DEV: true,
  },
});
