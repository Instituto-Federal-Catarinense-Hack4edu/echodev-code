import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { TermoGlossario } from "@/lib/api/types";
import { correctionProblem } from "./corrections";
import { normalize } from "./matcher";
import { registerTerms, termsFor } from "./pack";
import { TermSchema, type Term } from "./schemas";

export const AI_TERMS = "glossaryTerms";
const MAX_LOADED = 1000;

export function aiTermId(name: string): string {
  const slug = normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `ia-${slug}`;
}

const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

/**
 * A glossary entry approved by the teacher, as a dictionary term. Null when the name is an
 * ordinary Portuguese word or already another term: the live corrector would then highlight
 * (or swap) everyday speech. AI-suggested misspellings go through the same checks as teacher
 * corrections, and these terms are never approximate-matched.
 */
export function toTerm(g: TermoGlossario, dictionary: Term[] = termsFor()): Term | null {
  const canonical = g.termo.trim();
  const id = aiTermId(canonical);
  if (id === "ia-" || correctionProblem(canonical, id, dictionary)) return null;
  // The dictionary needs an example and at least 2 steps; edited entries may lack them.
  const full = (e: TermoGlossario["pt"]) => {
    const short = e.curta.trim();
    const example = e.exemplo.trim() || short;
    const steps = clean(e.passos);
    return { short, example, steps: steps.length >= 2 ? steps : [...steps, short, example].slice(0, 2) };
  };
  const variants = clean(g.variacoes ?? []).filter(
    (v) => normalize(v) !== normalize(canonical) && !correctionProblem(v, id, dictionary),
  );
  const term = {
    id,
    canonical,
    variants: [...new Set(variants)].slice(0, 4),
    fuzzy: false,
    category: g.categoria,
    explanations: {
      pt: full(g.pt),
      ...(g.en_curta?.trim() ? { en: { short: g.en_curta.trim() } } : {}),
      // Only the Spanish name: when it equals the canonical, the translation keeps the jargon.
      es: { names: [g.nome_es.trim() || canonical], ...full(g.es) },
    },
    reviewed: true,
  };
  const parsed = TermSchema.safeParse(term);
  return parsed.success ? parsed.data : null;
}

let loading: Promise<number> | null = null;

/** Loads the approved AI terms once per page and adds them to the dictionary. */
export function loadAiTerms(db: Firestore): Promise<number> {
  loading ??= getDocs(query(collection(db, AI_TERMS), limit(MAX_LOADED)))
    .then((snap) => {
      const terms = snap.docs
        .map((d) => TermSchema.safeParse({ ...d.data(), id: d.id, fuzzy: false, reviewed: true }))
        .flatMap((r) => (r.success ? [r.data] : []));
      registerTerms(terms);
      return terms.length;
    })
    .catch((e: unknown) => {
      loading = null; // allow a retry later
      throw e;
    });
  return loading;
}

/**
 * Adds the approved glossary to the shared dictionary (next lessons highlight and explain these
 * terms). Existing terms are kept as they are: a term approved in another lesson is not
 * overwritten. Returns how many terms were added.
 */
export async function publishAiTerms(db: Firestore, glossary: TermoGlossario[]): Promise<number> {
  const fresh: Term[] = [];
  for (const g of glossary) {
    const term = toTerm(g);
    if (!term || fresh.some((t) => t.id === term.id)) continue;
    const ref = doc(db, AI_TERMS, term.id);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, {
      id: term.id,
      canonical: term.canonical,
      variants: term.variants,
      category: term.category,
      // JSON round trip: Firestore rejects `undefined` values.
      explanations: JSON.parse(JSON.stringify(term.explanations)),
      source: "ia",
      created_at: serverTimestamp(),
    });
    fresh.push(term);
  }
  registerTerms(fresh);
  return fresh.length;
}
