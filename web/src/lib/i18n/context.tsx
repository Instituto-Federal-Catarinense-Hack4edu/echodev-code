"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { Lang } from "@/lib/terms/schemas";
import { messagesFor, type Messages } from "./messages";
import { useStudentLang } from "./student-lang";

const I18nContext = createContext<{ lang: Lang; messages: Messages }>({ lang: "pt", messages: messagesFor("pt") });

/** Student screens follow the student's language; teacher screens never use this provider. */
export function StudentI18n({ children }: { children: React.ReactNode }) {
  const lang = useStudentLang();
  const value = useMemo(() => ({ lang, messages: messagesFor(lang) }), [lang]);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.lang;
    html.lang = lang === "es" ? "es" : "pt-BR";
    return () => {
      html.lang = previous;
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Messages {
  return useContext(I18nContext).messages;
}

export function useUiLang(): Lang {
  return useContext(I18nContext).lang;
}
