"use client";

import { useEffect } from "react";

/** Calm mode: <html data-mode="calm"> (no animation, softer contrast; see globals.css). */
export function useCalmMode(enabled: boolean) {
  useEffect(() => {
    const html = document.documentElement;
    if (enabled) html.dataset.mode = "calm";
    else delete html.dataset.mode;
    return () => {
      delete html.dataset.mode;
    };
  }, [enabled]);
}
