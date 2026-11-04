import type { TermSpan } from "@/lib/realtime/schemas";

/** Minimal shape the matcher needs (a subset of Term). */
export interface MatchableTerm {
  id: string;
  canonical: string;
  variants: string[];
  forms?: string[];
  /** false for terms that are ordinary Portuguese words (never approximate-matched). */
  fuzzy?: boolean;
}

/** Common Portuguese words one letter away from a term: never approximate-match them. */
const FUZZY_BLOCKLIST = new Set([
  "branco", "branca", "brancos", "brancas", // ~ branch
  "merece", "mergulho", // ~ merge
  "reage", "reacao", // ~ react
  "retorno", "retornar", // ~ return
  "comite", "comites", "commita", "comida", // ~ commit / comiti (comitê = committee)
  "debate", "debito", // ~ debug
  "deplora", // ~ deploy
  "strong", // ~ string
  "arroba", // ~ array
]);
const FUZZY_MIN_LEN = 5;

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

/** Optimal string alignment distance (Levenshtein + adjacent transposition), capped. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const fuzzyLimit = (len: number) => (len >= 9 ? 2 : 1);

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

  // Approximate-match keys of non-Portuguese terms:
  // - single words: every spelling joined ("javascript", "usestate", "commit");
  // - word pairs: only spellings that really are two words ("use effect", "pull request").
  const fuzzyKeys: { key: string; entry: Entry }[] = [];
  const fuzzyPairs: { a: string; b: string; entry: Entry }[] = [];
  for (const t of terms) {
    if (t.fuzzy === false) continue;
    const entry: Entry = { termId: t.id, canonical: t.canonical, mode: "replace" };
    for (const phrase of new Set([t.canonical, ...t.variants])) {
      const toks = phraseKey(phrase);
      const key = toks.join("");
      if (key.length >= FUZZY_MIN_LEN) fuzzyKeys.push({ key, entry });
      if (toks.length === 2) fuzzyPairs.push({ a: toks[0], b: toks[1], entry });
    }
  }

  /** Picks the single closest entry; undefined when none or when two terms tie. */
  function pickBest(candidates: { d: number; entry: Entry }[]): Entry | undefined {
    let best: Entry | undefined;
    let bestDist = Infinity;
    let tie = false;
    for (const { d, entry } of candidates) {
      if (d < bestDist) {
        best = entry;
        bestDist = d;
        tie = false;
      } else if (d === bestDist && best && best.termId !== entry.termId) {
        tie = true;
      }
    }
    return tie ? undefined : best;
  }

  function fuzzyWord(word: string): Entry | undefined {
    if (word.length < FUZZY_MIN_LEN || FUZZY_BLOCKLIST.has(word) || /^\d/.test(word)) return undefined;
    const candidates: { d: number; entry: Entry }[] = [];
    for (const { key, entry } of fuzzyKeys) {
      if (key[0] !== word[0]) continue;
      const limit = fuzzyLimit(key.length);
      const d = editDistance(word, key, limit);
      if (d > 0 && d <= limit) candidates.push({ d, entry }); // d === 0 is an exact match
    }
    return pickBest(candidates);
  }

  /** Two spoken words against a two-word term, compared word by word (≤1 edit each). */
  function fuzzyPair(a: Token, b: Token): Entry | undefined {
    const isExactTerm = (t: Token) => dict.has(t.norm);
    if (a.norm.length < 3 || b.norm.length < 3 || isExactTerm(a) || isExactTerm(b)) return undefined;
    if (FUZZY_BLOCKLIST.has(a.norm) || FUZZY_BLOCKLIST.has(b.norm)) return undefined;
    const candidates: { d: number; entry: Entry }[] = [];
    for (const p of fuzzyPairs) {
      if (p.a[0] !== a.norm[0] || p.b[0] !== b.norm[0]) continue;
      const da = editDistance(a.norm, p.a, 1);
      const db = editDistance(b.norm, p.b, 1);
      const d = da + db;
      if (da <= 1 && db <= 1 && d > 0 && d <= fuzzyLimit(p.a.length + p.b.length)) {
        candidates.push({ d, entry: p.entry });
      }
    }
    return pickBest(candidates);
  }

  function fuzzyLookup(tokens: Token[], i: number, n: number, text: string): Entry | undefined {
    if (n === 1) return fuzzyWord(tokens[i].norm);
    const [a, b] = [tokens[i], tokens[i + 1]];
    if (!JOINER_RE.test(text.slice(a.end, b.start))) return undefined;
    return fuzzyPair(a, b);
  }

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
        // Exact matches always win; only then try an approximate match: one word first,
        // then two words joined (each with 3+ letters, so short words like "é" are never eaten).
        if (!found) {
          for (let n = 1; n <= Math.min(2, tokens.length - i); n++) {
            const entry = fuzzyLookup(tokens, i, n, text);
            if (entry) {
              found = { entry, n };
              break;
            }
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
