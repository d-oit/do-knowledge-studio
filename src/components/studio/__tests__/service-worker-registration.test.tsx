import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import { ServiceWorkerRegistration } from "@/components/studio/service-worker-registration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockServiceWorker = () => {
  const register = vi.fn().mockResolvedValue();
  Object.defineProperty(globalThis.navigator, "serviceWorker", {
    writable: true,
    configurable: true,
    value: {
      register,
      ready: Promise.resolve(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getRegistrations: vi.fn().mockResolvedValue([]),
      getRegistration: vi.fn().mockResolvedValue(),
      controller: null,
      oncontrollerchange: null,
      onmessage: null,
    },
  });
  return register;
};

const removeServiceWorker = () => {
  // delete is enough — JSDOM constructs a fresh navigator per test file but
  // not per test, so we need to clean up between describe blocks if needed.
  // The mock above sets configurable: true so delete works.
  delete (globalThis.navigator as Record<string, unknown>).serviceWorker;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ServiceWorkerRegistration", () => {
  let register: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    register = mockServiceWorker();
  });

  describe("when serviceWorker is available", () => {
    it("renders without errors", () => {
      const { container } = render(<ServiceWorkerRegistration />);
      // Component returns null, so nothing is rendered
      expect(container.innerHTML).toBe("");
    });

    it("calls navigator.serviceWorker.register on mount", () => {
      render(<ServiceWorkerRegistration />);
      expect(register).toHaveBeenCalledOnce();
      expect(register).toHaveBeenCalledWith("/sw.js");
    });
  });

  describe("when serviceWorker is not available", () => {
    beforeEach(() => {
      removeServiceWorker();
    });

    it("renders without errors", () => {
      const { container } = render(<ServiceWorkerRegistration />);
      expect(container.innerHTML).toBe("");
    });

    it("does not attempt to register", () => {
      render(<ServiceWorkerRegistration />);
      expect(register).not.toHaveBeenCalled();
    });
  });

  describe("registration error handling", () => {
    it("logs an error when registration fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const error = new Error("SW registration rejected");
      register.mockRejectedValueOnce(error);

      render(<ServiceWorkerRegistration />);

      // Wait for the microtask — the effect fires synchronously but
      // the .catch handler is a microtask.
      await Promise.resolve();

      expect(consoleError).toHaveBeenCalledWith(
        "Service worker registration failed:",
        error,
      );
      consoleError.mockRestore();
    });
  });
});
