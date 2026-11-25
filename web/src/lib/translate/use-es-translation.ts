"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createEsTranslator, esAvailability, type TranslateFn } from "./browser";

export type TranslationState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "unavailable" }
  | { kind: "idle" }
  | { kind: "downloading"; percent: number }
  | { kind: "on"; translate: TranslateFn }
  | { kind: "error" };

/**
 * The teacher's Chrome translates every sentence so each student can choose Spanish on
 * their own device. The language pack download needs a click, so `prepare()` runs from
 * the "start transcription" button; when the pack is already there it starts on its own.
 */
export function useEsTranslation() {
  const [state, setState] = useState<TranslationState>({ kind: "checking" });
  const busy = useRef(false);

  const prepare = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => (s.kind === "on" ? s : { kind: "downloading", percent: 0 }));
    try {
      const translate = await createEsTranslator((f) =>
        setState({ kind: "downloading", percent: Math.round(f * 100) }),
      );
      setState({ kind: "on", translate });
    } catch {
      setState({ kind: "error" });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void esAvailability().then((a) => {
      if (cancelled) return;
      if (a === "unsupported" || a === "unavailable") setState({ kind: a });
      else if (a === "available") void prepare();
      else setState({ kind: "idle" });
    });
    return () => {
      cancelled = true;
    };
  }, [prepare]);

  const needsPrepare = state.kind === "idle" || state.kind === "error";
  return { state, prepare, needsPrepare, translate: state.kind === "on" ? state.translate : null };
}
