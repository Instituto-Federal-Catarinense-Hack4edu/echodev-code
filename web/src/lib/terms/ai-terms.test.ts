import { describe, expect, it } from "vitest";
import type { TermoGlossario } from "@/lib/api/types";
import { keepsInSpanish, translateKeepingTerms } from "@/lib/translate/keep-terms";
import { aiTermId, toTerm } from "./ai-terms";
import { dictionaryVersion, getTerm, knownTermNames, matcherFor, registerTerms, termsFor } from "./pack";

const entry = (over: Partial<TermoGlossario> = {}): TermoGlossario => ({
  termo: "Docker",
  nome_es: "Docker",
  categoria: "ferramentas",
  pt: { curta: "Roda programas em contêineres.", exemplo: "docker run app", passos: ["Instale.", "Rode."] },
  es: { curta: "Ejecuta programas en contenedores.", exemplo: "docker run app", passos: ["Instala.", "Ejecuta."] },
  en_curta: "Runs programs in containers.",
  variacoes: ["dóquer", "aula", "ok", "docker"],
  ...over,
});

describe("toTerm", () => {
  it("turns an approved glossary entry into a dictionary term", () => {
    const term = toTerm(entry())!;
    expect(term.id).toBe("ia-docker");
    expect(term.canonical).toBe("Docker");
    expect(term.fuzzy).toBe(false);
    expect(term.reviewed).toBe(true);
    expect(term.explanations.es?.names).toEqual(["Docker"]);
    expect(term.explanations.en?.short).toMatch(/containers/);
  });

  it("drops misspellings that are common words, too short or the term itself", () => {
    expect(toTerm(entry())!.variants).toEqual(["dóquer"]);
  });

  it("refuses names that are ordinary Portuguese words or another term", () => {
    expect(toTerm(entry({ termo: "aula" }))).toBeNull();
    expect(toTerm(entry({ termo: "commit" }))).toBeNull();
    expect(toTerm(entry({ termo: "  " }))).toBeNull();
  });

  it("fills a missing example and steps so the term sheet always has 3 depths", () => {
    const term = toTerm(entry({ pt: { curta: "Curta.", exemplo: "", passos: [""] } }))!;
    expect(term.explanations.pt.example).toBe("Curta.");
    expect(term.explanations.pt.steps).toHaveLength(2);
  });

  it("builds stable ids without accents or symbols", () => {
    expect(aiTermId("Laço for…of")).toBe("ia-laco-for-of");
  });
});

describe("registered AI terms", () => {
  it("join the corrector, the term sheet and the known names", () => {
    const before = dictionaryVersion();
    registerTerms([toTerm(entry())!]);
    expect(dictionaryVersion()).toBe(before + 1);
    expect(getTerm("ia-docker")?.canonical).toBe("Docker");
    expect(termsFor().some((t) => t.id === "ia-docker")).toBe(true);
    expect(knownTermNames()).toContain("Docker");
    const m = matcherFor().match("vamos usar o dóquer hoje");
    expect(m.text).toBe("vamos usar o Docker hoje");
    expect(m.terms).toEqual([{ termId: "ia-docker", start: 13, end: 19 }]);
  });

  it("never replace a pack term with the same id", () => {
    const fake = { ...toTerm(entry())!, id: "commit", canonical: "outro" };
    registerTerms([fake]);
    expect(getTerm("commit")?.canonical).toBe("commit");
  });

  it("keep jargon in the Spanish caption and translate words that have a Spanish name", async () => {
    const docker = toTerm(entry())!;
    const laco = toTerm(entry({ termo: "laço de repetição", nome_es: "bucle", variacoes: [] }))!;
    registerTerms([docker, laco]);
    expect(keepsInSpanish(docker)).toBe(true);
    expect(keepsInSpanish(laco)).toBe(false);
    const translate = async (s: string) => s.replace("rode o", "ejecuta el").replace("Docker", "estibador");
    const text = "rode o Docker";
    const out = await translateKeepingTerms(translate, text, matcherFor().match(text).terms);
    expect(out).toBe("ejecuta el Docker");
  });
});
