/// <reference types="@testing-library/jest-dom" />
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { OfflineIndicator } from "./offline-indicator";

describe("OfflineIndicator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it("does not show offline banner when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    render(<OfflineIndicator />);

    expect(
      screen.queryByText(/You are offline/)
    ).not.toBeInTheDocument();
  });

  it("shows offline banner when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    render(<OfflineIndicator />);

    expect(
      screen.getByText(/You are offline/)
    ).toBeInTheDocument();
  });

  it("updates when online/offline events fire", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    render(<OfflineIndicator />);

    expect(
      screen.queryByText(/You are offline/)
    ).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(
      screen.getByText(/You are offline/)
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/You are offline/)
      ).not.toBeInTheDocument();
    });
  });

  it("cleans up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(
      window,
      "removeEventListener"
    );

    const { unmount } = render(<OfflineIndicator />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "online",
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "offline",
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });
});
