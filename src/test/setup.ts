import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  window.Element.prototype.scrollIntoView = vi.fn();
}
