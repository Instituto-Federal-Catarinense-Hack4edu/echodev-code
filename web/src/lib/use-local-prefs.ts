"use client";

import { useEffect, useState } from "react";
import { DepthSchema, LangSchema, type Depth, type Lang } from "@/lib/terms/schemas";

const KEY = "echodev:prefs";

export interface LocalPrefs {
  depth: Depth;
  lang: Lang;
}

const DEFAULTS: LocalPrefs = { depth: "curta", lang: "pt" };

function read(): LocalPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    return {
      depth: DepthSchema.safeParse(raw.depth).data ?? DEFAULTS.depth,
      lang: LangSchema.safeParse(raw.lang).data ?? DEFAULTS.lang,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Per-device preferences for the offline demo (logged-in students use their profile). */
export function useLocalPrefs() {
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULTS);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only
    setPrefs(read());
  }, []);
  const update = (patch: Partial<LocalPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [prefs, update] as const;
}
