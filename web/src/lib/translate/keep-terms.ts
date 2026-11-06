import type { TermSpan } from "@/lib/realtime/schemas";
import { createMatcher, type Matcher } from "@/lib/terms/matcher";
import { dictionaryVersion, getTerm, termsFor } from "@/lib/terms/pack";
import type { Term } from "@/lib/terms/schemas";

type Translate = (text: string) => Promise<string>;
type Lookup = (termId: string) => Term | undefined;

const lower = (s: string) => s.toLocaleLowerCase("es");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s: string, flags = "giu") =>
  new RegExp(`(?<![\\p{L}\\p{N}_.])${escape(s)}(?![\\p{L}\\p{N}_])`, flags);

/**
 * Jargon that Spanish-speaking programmers say as is ("commit", "push", "useState"): its
 * Spanish name is the canonical itself. Portuguese words with a Spanish equivalent
 * (variável → variable, função → función) are left to the translator.
 */
export function keepsInSpanish(term: Term): boolean {
  const names = term.explanations.es?.names;
  if (!names?.length) return true;
  const canonical = lower(term.canonical);
  return names.some((n) => lower(n) === canonical);
}

interface Slot {
  token: string;
  surface: string;
  term: Term;
}

const token = (i: number) => `XQZ${i + 1}`;
const tokenRe = (t: string) => new RegExp(`${t}(?!\\d)`, "gi");
const ANY_TOKEN = /XQZ\d+/i;

/** Replaces each kept term with a placeholder the translator copies untouched. */
export function maskTerms(text: string, spans: TermSpan[], lookup: Lookup = getTerm) {
  const slots: Slot[] = [];
  let masked = "";
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const term = lookup(s.termId);
    if (s.start < cursor || !term || !keepsInSpanish(term)) continue;
    const t = token(slots.length);
    slots.push({ token: t, surface: text.slice(s.start, s.end), term });
    masked += text.slice(cursor, s.start) + t;
    cursor = s.end;
  }
  return { masked: masked + text.slice(cursor), slots };
}

/** Puts the terms back; null when the translator lost, repeated or changed a placeholder. */
export function unmaskTerms(translated: string, slots: Slot[]): string | null {
  let out = translated;
  for (const slot of slots) {
    if ((out.match(tokenRe(slot.token)) ?? []).length !== 1) return null;
    out = out.replace(tokenRe(slot.token), () => slot.surface);
  }
  return ANY_TOKEN.test(out) ? null : out;
}

/**
 * Spanish words that also have an everyday meaning: never swapped back to the jargon in the
 * fallback ("si" is "if", but also "whether"; "error" can just mean an error).
 */
const EVERYDAY_ES = new Set([
  "si", "sino", "si no", "mientras", "unir", "publicar", "error", "errores", "devuelve",
  "ciclo", "matriz", "cadena", "cadenas",
]);

/** Fallback when placeholders failed: swaps a known Spanish rendering back to the term. */
function restoreJargon(translated: string, slots: Slot[]): string {
  let out = translated;
  for (const { term, surface } of slots) {
    if (wordRe(surface).test(out)) continue;
    const own = new Set([term.canonical, ...(term.forms ?? []), surface].map(lower));
    const renderings = (term.explanations.es?.names ?? [])
      .filter((n) => !own.has(lower(n)) && !EVERYDAY_ES.has(lower(n)))
      .sort((a, b) => b.length - a.length);
    for (const r of renderings) {
      const m = wordRe(r, "iu").exec(out);
      if (!m) continue;
      const capital = /^\p{Lu}/u.test(m[0]) && !/^\p{Lu}/u.test(surface);
      const word = capital ? surface[0].toLocaleUpperCase("es") + surface.slice(1) : surface;
      out = out.slice(0, m.index) + word + out.slice(m.index + m[0].length);
      break;
    }
  }
  return out;
}

/** Translates a sentence keeping the jargon terms found by the matcher exactly as spoken. */
export async function translateKeepingTerms(
  translate: Translate,
  text: string,
  spans: TermSpan[],
  lookup: Lookup = getTerm,
): Promise<string> {
  const { masked, slots } = maskTerms(text, spans, lookup);
  if (slots.length === 0) return translate(text);
  const restored = unmaskTerms(await translate(masked), slots);
  if (restored !== null) return restored;
  return restoreJargon(await translate(text), slots);
}

let exact: { version: number; matcher: Matcher } | null = null;

function exactMatcher(): Matcher {
  // Rebuilt when approved AI terms are added to the dictionary.
  if (!exact || exact.version !== dictionaryVersion()) {
    exact = {
      version: dictionaryVersion(),
      matcher: createMatcher(termsFor().map((t) => ({ ...t, fuzzy: false }))),
    };
  }
  return exact.matcher;
}

/** Same, for text without spans (summary, quiz): terms are found with the exact dictionary. */
export function keepingTerms(translate: Translate): Translate {
  return async (text) => {
    const { text: canonical, terms } = exactMatcher().match(text);
    return translateKeepingTerms(translate, canonical, terms);
  };
}
