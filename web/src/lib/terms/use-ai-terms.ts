"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/firebase/client";
import { loadAiTerms } from "./ai-terms";

/**
 * Adds the approved AI terms to the dictionary for this page. True once loaded (or failed:
 * the page then works with the versioned pack only), so screens can wait before building a
 * matcher or re-render to show the new terms.
 */
export function useAiTerms(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadAiTerms(getDb())
      .catch(() => 0)
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return ready;
}
