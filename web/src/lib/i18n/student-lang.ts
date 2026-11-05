"use client";

import { useSyncExternalStore } from "react";
import { LangSchema, type Lang } from "@/lib/terms/schemas";

const KEY = "echodev:lang";
const listeners = new Set<() => void>();
let current: Lang | null = null;

function read(): Lang {
  if (current) return current;
  try {
    current = LangSchema.safeParse(localStorage.getItem(KEY)).data ?? "pt";
  } catch {
    current = "pt";
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setStudentLang(lang: Lang) {
  if (current === lang) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable */
  }
  for (const l of listeners) l();
}

/** The language a student reads in: screens, live caption and term explanations. */
export function useStudentLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "pt");
}
