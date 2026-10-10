"use client";

import { useEffect, useRef, useState } from "react";
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
  const bannerRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    const root = document.documentElement;
    const banner = bannerRef.current;
    if (!isOffline || banner === null) {
      root.style.removeProperty(BANNER_HEIGHT_VARIABLE);
      return;
    }

    const publishHeight = () => {
      root.style.setProperty(BANNER_HEIGHT_VARIABLE, `${banner.offsetHeight}px`);
    };
    publishHeight();

    // jsdom (unit tests) has no ResizeObserver; the height is still published
    // once above, and the browser suites cover the live-resize behavior.
    if (typeof ResizeObserver === "undefined") {
      return () => { root.style.removeProperty(BANNER_HEIGHT_VARIABLE); };
    }

    const observer = new ResizeObserver(publishHeight);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      root.style.removeProperty(BANNER_HEIGHT_VARIABLE);
    };
  }, [isOffline]);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          ref={bannerRef}
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
