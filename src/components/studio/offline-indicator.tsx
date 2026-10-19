"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { TransitionEvent } from "react";
import { WifiOff } from "lucide-react";
import { useReducedMotion } from "@/lib/studio/use-reduced-motion";
import { translate } from "@/lib/i18n/messages/presence";

const EXIT_TRANSITION_DURATION_MS = 300;

/**
 * Custom property the app shell reads to reserve this banner's height.
 *
 * The banner is `fixed`, so it displaces nothing on its own: the topbar sits in
 * normal flow under it and its controls stop receiving clicks. Measured before
 * this existed, at every configured viewport — the quick filter, the
 * command-palette trigger, New entity, and on mobile the menu and search
 * triggers, all resolved `document.elementFromPoint` to the banner (plans/161).
 */
const BANNER_HEIGHT_VARIABLE = "--offline-banner-height";

/** Animated banner that appears when the browser goes offline. */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const initiallyOffline = !navigator.onLine;
    setIsOffline(initiallyOffline);
    setShowBanner(initiallyOffline);

    const handleOnline = () => { setIsOffline(false); };
    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Reserve the space the banner occupies so it never covers the topbar.
  // The height is measured rather than assumed: it wraps to two lines on a
  // narrow viewport and changes with text zoom, and a wrong constant would
  // reintroduce the obstruction at exactly one viewport.
  //
  // Measure with a ref callback before paint, so the reservation lands on the
  // same paint as the banner. The observer stays attached through the CSS exit
  // transition, allowing a resize that re-wraps the banner to update the
  // reserved height until the element actually leaves the DOM.
  const attachBanner = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;

    const publishHeight = () => {
      document.documentElement.style.setProperty(
        BANNER_HEIGHT_VARIABLE,
        `${node.offsetHeight}px`,
      );
    };
    publishHeight();

    // jsdom (unit tests) has no ResizeObserver; the height is still published
    // once above, and the browser suites cover the live-resize behavior.
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  // The reservation is cleared only after the banner has been removed from the
  // DOM. That keeps the shell from moving under a still-visible exit transition.
  const clearReservedHeight = useCallback(() => {
    document.documentElement.style.removeProperty(BANNER_HEIGHT_VARIABLE);
  }, []);
  const handleExitTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (
        isOffline ||
        event.target !== event.currentTarget ||
        (event.propertyName !== "translate" && event.propertyName !== "transform")
      ) {
        return;
      }
      setShowBanner(false);
    },
    [isOffline],
  );

  useEffect(() => {
    if (isOffline || !showBanner) return;

    if (reducedMotion) {
      setShowBanner(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowBanner(false);
    }, EXIT_TRANSITION_DURATION_MS);
    return () => { clearTimeout(timeoutId); };
  }, [isOffline, reducedMotion, showBanner]);

  // Layout effects run after React removes the banner but before the next paint,
  // so releasing its reservation cannot expose the topbar beneath the banner.
  useLayoutEffect(() => {
    if (!isOffline && !showBanner) clearReservedHeight();
  }, [clearReservedHeight, isOffline, showBanner]);

  useEffect(() => {
    return () => { clearReservedHeight(); };
  }, [clearReservedHeight]);

  return showBanner ? (
    <div
      ref={attachBanner}
      role="status"
      aria-live="polite"
      aria-hidden={!isOffline}
      onTransitionEnd={handleExitTransitionEnd}
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-clay px-4 py-2 text-sm text-white transition-all duration-300 ease-in-out motion-reduce:transition-none ${
        isOffline
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{translate("offline.banner")}</span>
    </div>
  ) : null;
}
