import type { Lang } from "@/lib/terms/schemas";
import { es } from "./es";
import { t as pt } from "./pt-BR";

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : { readonly [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof pt>;

export type MessageOverrides<T = Messages> = T extends string | ((...args: never[]) => unknown)
  ? T
  : { readonly [K in keyof T]?: MessageOverrides<T[K]> };

export type UiLang = "pt" | "es";

function merge<T>(base: T, over: MessageOverrides<T> | undefined): T {
  if (over === undefined) return base;
  if (typeof base !== "object" || base === null) return over as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = merge((base as Record<string, unknown>)[k], v as MessageOverrides<unknown>);
  }
  return out as T;
}

const catalogs: Record<UiLang, Messages> = { pt, es: merge<Messages>(pt, es) };

/** The interface only exists in Portuguese and Spanish; English readers get Portuguese screens. */
export function uiLangOf(lang: Lang): UiLang {
  return lang === "es" ? "es" : "pt";
}

export function messagesFor(lang: Lang): Messages {
  return catalogs[uiLangOf(lang)];
}
