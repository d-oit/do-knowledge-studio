import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock scrollIntoView which is missing in many DOM emulations
if (typeof window !== 'undefined') {
  window.Element.prototype.scrollIntoView = vi.fn();
}
