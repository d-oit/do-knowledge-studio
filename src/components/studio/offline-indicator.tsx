"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useReducedMotion } from "@/lib/studio/use-reduced-motion";
import { translate } from "@/lib/i18n/messages/presence";

const ANIMATION_VARIANTS = {
  hidden: { y: "-100%", opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: "-100%", opacity: 0 },
} as const;

const ANIMATION_TRANSITION = { duration: 0.3, ease: "easeInOut" } as const;

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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => { setIsOffline(false); };
    const handleOffline = () => { setIsOffline(true); };

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
  // Measured in a ref callback, not in an effect keyed on `isOffline`:
  //
  //  * refs run in the commit phase, before paint, so the reservation lands on
  //    the same paint as the banner — an effect lands a frame later, which
  //    `plans/161` recorded as the reason a probe passed 3 of 6 mobile runs;
  //  * the callback's cleanup runs when the element leaves the DOM, i.e. after
  //    `AnimatePresence` finishes the exit animation. An effect keyed on
  //    `isOffline` disconnects the observer as soon as the connection returns,
  //    so a viewport resize during the exit that re-wraps the banner would
  //    leave a stale reserved height (review on PR #925).
  //
  // The reservation is still NOT dropped on unmount: `onExitComplete` below is
  // the single place it ends, so the padding outlives the exit animation.
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

  // Ends the reservation once the banner has actually left the layout — after
  // the exit animation, or immediately when reduced motion removed it.
  const clearReservedHeight = useCallback(() => {
    document.documentElement.style.removeProperty(BANNER_HEIGHT_VARIABLE);
  }, []);

  return (
    <AnimatePresence onExitComplete={clearReservedHeight}>
      {isOffline && (
        <motion.div
          ref={attachBanner}
          role="status"
          aria-live="polite"
          initial={reducedMotion ? "visible" : "hidden"}
          animate="visible"
          exit={reducedMotion ? undefined : "exit"}
          variants={ANIMATION_VARIANTS}
          transition={reducedMotion ? { duration: 0 } : ANIMATION_TRANSITION}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-clay px-4 py-2 text-sm text-white"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {translate("offline.banner")}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
