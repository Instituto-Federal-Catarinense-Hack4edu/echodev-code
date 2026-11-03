import type { TermSpan } from "@/lib/realtime/schemas";

/** Minimal shape the matcher needs (a subset of Term). */
export interface MatchableTerm {
  id: string;
  canonical: string;
  variants: string[];
  forms?: string[];
}

export interface MatchResult {
  text: string;
  terms: TermSpan[];
}

interface Token {
  start: number;
  end: number;
  norm: string;
}

interface Entry {
  termId: string;
  canonical: string;
  /** "replace" swaps the spoken text for the canonical form; "keep" only highlights. */
  mode: "replace" | "keep";
}

const MAX_TOKENS = 3;
const WORD_RE = /[\p{L}\p{N}_]+/gu;
/** Only whitespace or a single hyphen may sit between tokens of one multi-word term. */
const JOINER_RE = /^(\s+|\s*-\s*)$/;

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    out.push({ start, end: start + m[0].length, norm: normalize(m[0]) });
  }
  return out;
}

function phraseKey(s: string): string[] {
  return tokenize(s).map((t) => t.norm);
}

export interface Matcher {
  match(text: string): MatchResult;
}

export function createMatcher(terms: MatchableTerm[]): Matcher {
  // key: normalized tokens joined by " " (spaced) — and "~" + concatenation (joined),
  // so "use state" also hits canonical "useState".
  const dict = new Map<string, Entry>();
  const add = (phrase: string, entry: Entry) => {
    const toks = phraseKey(phrase);
    if (toks.length === 0 || toks.length > MAX_TOKENS) return;
    const spaced = toks.join(" ");
    if (!dict.has(spaced)) dict.set(spaced, entry);
    const joined = "~" + toks.join("");
    if (!dict.has(joined)) dict.set(joined, entry);
  };

  // Canonical and forms first so they win over variants on key collisions.
  for (const t of terms) add(t.canonical, { termId: t.id, canonical: t.canonical, mode: "replace" });
  for (const t of terms)
    for (const f of t.forms ?? []) add(f, { termId: t.id, canonical: t.canonical, mode: "keep" });
  for (const t of terms)
    for (const v of t.variants) add(v, { termId: t.id, canonical: t.canonical, mode: "replace" });

  function lookup(tokens: Token[], i: number, n: number, text: string): Entry | undefined {
    const slice = tokens.slice(i, i + n);
    for (let k = 1; k < slice.length; k++) {
      if (!JOINER_RE.test(text.slice(slice[k - 1].end, slice[k].start))) return undefined;
    }
    const norms = slice.map((t) => t.norm);
    return dict.get(norms.join(" ")) ?? (n > 1 ? dict.get("~" + norms.join("")) : undefined);
  }

  function replacementFor(original: string, entry: Entry): string {
    if (entry.mode === "keep") return original;
    if (original === entry.canonical) return original;
    // Keep sentence-initial capitalization for lowercase canonicals ("Commit" stays).
    if (
      entry.canonical === entry.canonical.toLowerCase() &&
      original.toLowerCase() === entry.canonical
    ) {
      return original;
    }
    return entry.canonical;
  }

  return {
    match(text: string): MatchResult {
      const tokens = tokenize(text);
      let out = "";
      let cursor = 0; // position in the original text
      const spans: TermSpan[] = [];

      let i = 0;
      while (i < tokens.length) {
        let found: { entry: Entry; n: number } | null = null;
        for (let n = Math.min(MAX_TOKENS, tokens.length - i); n >= 1; n--) {
          const entry = lookup(tokens, i, n, text);
          if (entry) {
            found = { entry, n };
            break;
          }
        }
        if (!found) {
          i++;
          continue;
        }
        const first = tokens[i];
        const last = tokens[i + found.n - 1];
        // Build output and spans in the same pass (never index the original text).
        out += text.slice(cursor, first.start);
        const replacement = replacementFor(text.slice(first.start, last.end), found.entry);
        const start = out.length;
        out += replacement;
        spans.push({ termId: found.entry.termId, start, end: out.length });
        cursor = last.end;
        i += found.n;
      }
      out += text.slice(cursor);
      return { text: out, terms: spans };
    },
  };
}
