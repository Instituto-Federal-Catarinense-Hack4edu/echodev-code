import rawPack from "@/content/packs/programacao-geral.json";
import { createMatcher, type Matcher } from "./matcher";
import { PackSchema, type Depth, type Lang, type Pack, type Term } from "./schemas";

export const DEFAULT_PACK_ID = "programacao-geral";

const packs: Record<string, Pack> = {
  [DEFAULT_PACK_ID]: PackSchema.parse(rawPack),
};

export function getPack(id: string = DEFAULT_PACK_ID): Pack {
  const p = packs[id];
  if (!p) throw new Error(`Unknown pack: ${id}`);
  return p;
}

/**
 * Terms approved from AI glossaries (Firestore `glossaryTerms`), added at runtime on top of the
 * versioned packs. They count for every pack: the dictionary grows for all lessons.
 */
const extraIndex = new Map<string, Term>();
let extraVersion = 0;

export function registerTerms(terms: Term[]): void {
  let changed = false;
  for (const term of terms) {
    if (termIndex.has(term.id)) continue; // a pack term always wins
    extraIndex.set(term.id, term);
    changed = true;
  }
  if (changed) extraVersion++;
}

/** Changes whenever registered terms change (to rebuild cached matchers). */
export function dictionaryVersion(): number {
  return extraVersion;
}

/** Terms of the given packs plus the registered ones; unknown pack ids are ignored. */
export function termsFor(packIds: string[] = [DEFAULT_PACK_ID]): Term[] {
  const known = packIds.filter((id) => id in packs);
  const base = (known.length ? known : [DEFAULT_PACK_ID]).flatMap((id) => getPack(id).terms);
  return [...base, ...extraIndex.values()];
}

const termIndex = new Map<string, Term>();
for (const p of Object.values(packs)) for (const t of p.terms) termIndex.set(t.id, t);

export function getTerm(id: string): Term | undefined {
  return termIndex.get(id) ?? extraIndex.get(id);
}

/** Canonical names the dictionary already explains: the AI glossary skips them. */
export function knownTermNames(packIds?: string[]): string[] {
  return termsFor(packIds).map((t) => t.canonical);
}

export function matcherFor(packIds: string[] = [DEFAULT_PACK_ID]): Matcher {
  return createMatcher(termsFor(packIds));
}

export interface ResolvedExplanation {
  lang: Lang;
  /** True when the requested language/depth was missing and Portuguese was used. */
  fellBack: boolean;
  text: string | string[];
}

export function literalMeaning(term: Term, lang: Lang): string | undefined {
  if (!term.figurative) return undefined;
  return (lang !== "pt" ? term.explanations[lang]?.literal : undefined) ?? term.literalMeaning;
}

export function explain(term: Term, depth: Depth, lang: Lang): ResolvedExplanation {
  const key = depth === "curta" ? "short" : depth === "exemplo" ? "example" : "steps";
  const wanted = term.explanations[lang];
  const value = wanted?.[key];
  if (value !== undefined) return { lang, fellBack: false, text: value };
  return { lang: "pt", fellBack: lang !== "pt", text: term.explanations.pt[key] };
}
