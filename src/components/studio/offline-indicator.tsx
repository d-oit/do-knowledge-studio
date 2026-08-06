"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useReducedMotion } from "@/lib/studio/use-reduced-motion";

const ANIMATION_VARIANTS = {
  hidden: { y: "-100%", opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: "-100%", opacity: 0 },
} as const;

const ANIMATION_TRANSITION = { duration: 0.3, ease: "easeInOut" } as const;

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

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
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
            You are offline — changes will sync when reconnected
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
