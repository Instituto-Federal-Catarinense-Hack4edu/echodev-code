"use client";

import { useEffect } from "react";

/** Keeps the screen on while mounted; re-acquired on visibilitychange. No-op if unsupported. */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
      } catch {
        /* unsupported or denied: ignore */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
