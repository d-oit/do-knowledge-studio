"use client";

import { useEffect } from "react";

/** Path of the shipped service worker. */
const SW_URL = "/sw.js";

/**
 * Handle for the periodic update check. `window.setInterval` returns a
 * number, which is the only timer type this component ever holds.
 */
type UpdateTimer = number;

/**
 * Interval between opportunistic update checks while the tab is open. The
 * spec's implicit throttle is 24h, which is far too coarse for a local-first
 * app whose users reload often; one check per hour keeps the worker fresh
 * without hammering the network.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker for offline caching and keeps it current.
 *
 * Hardening over the naive `register()` call:
 * - `updateViaCache: "none"` — without it the HTTP cache can serve a stale
 *   script and the worker never activates, which is the classic "my PWA
 *   updates but the old code keeps running" bug.
 * - `updateViaCache` plus a `visibilitychange`/`online` re-check so returning
 *   to a backgrounded tab or coming back online picks up a new deploy
 *   immediately instead of after a reload.
 * - Every listener is removed on unmount, and both the interval and the
 *   in-flight update promise are torn down with the component.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;
    let updateTimer: UpdateTimer | undefined;

    // update() is idempotent and safe to call concurrently; a shared promise
    // collapses bursts of visibility/online events into one request.
    let inFlightUpdate: Promise<void> | null = null;
    const checkForUpdate = (registration: ServiceWorkerRegistration) => {
      if (disposed) return;
      inFlightUpdate ??= registration
        .update()
        .then(() => undefined)
        .catch((error) => {
          console.error("Service worker update check failed:", error);
        })
        .finally(() => {
          inFlightUpdate = null;
        });
    };

    const startUpdateChecks = (registration: ServiceWorkerRegistration) => {
      checkForUpdate(registration);
      if (updateTimer !== undefined) return;
      updateTimer = window.setInterval(
        () => checkForUpdate(registration),
        UPDATE_CHECK_INTERVAL_MS,
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void navigator.serviceWorker.ready.then((registration) => {
        if (!disposed) startUpdateChecks(registration);
      });
    };

    const onOnline = () => {
      void navigator.serviceWorker.ready.then((registration) => {
        if (!disposed) startUpdateChecks(registration);
      });
    };

    navigator.serviceWorker
      .register(SW_URL, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        if (disposed) return;
        // Cache lifecycle deliberately lives in sw.js's `activate` handler,
        // which deletes every cache NOT in the current allowlist. Doing it
        // here instead was wrong on two counts: `installed` fires before
        // `activate` and before any `fetch` can repopulate, and the new
        // worker's own caches are named `dks-*`, so the filter deleted the
        // precache the worker had just written — taking the offline shell
        // with it on every deploy. See plans/158 §P0-2.
        startUpdateChecks(registration);
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      if (updateTimer !== undefined) {
        clearInterval(updateTimer);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
