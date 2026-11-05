"use client";

import { useCallback, useEffect, useState } from "react";
import { createEsTranslator, esAvailability, type TranslateFn } from "./browser";

const REMEMBER_KEY = "echodev:translate-es";

export type TranslationState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "unavailable" }
  | { kind: "off" }
  | { kind: "downloading"; percent: number }
  | { kind: "on"; translate: TranslateFn }
  | { kind: "error" };

function remembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function useEsTranslation() {
  const [state, setState] = useState<TranslationState>({ kind: "checking" });

  const enable = useCallback(async () => {
    setState({ kind: "downloading", percent: 0 });
    try {
      const translate = await createEsTranslator((f) =>
        setState({ kind: "downloading", percent: Math.round(f * 100) }),
      );
      remember(true);
      setState({ kind: "on", translate });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  const disable = useCallback(() => {
    remember(false);
    setState({ kind: "off" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void esAvailability().then((a) => {
      if (cancelled) return;
      if (a === "unsupported" || a === "unavailable") setState({ kind: a });
      else if (a === "available" && remembered()) void enable();
      else setState({ kind: "off" });
    });
    return () => {
      cancelled = true;
    };
  }, [enable]);

  return { state, enable, disable, translate: state.kind === "on" ? state.translate : null };
}
