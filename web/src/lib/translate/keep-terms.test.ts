import { describe, expect, it } from "vitest";
import { getTerm, matcherFor } from "@/lib/terms/pack";
import { keepingTerms, keepsInSpanish, maskTerms, translateKeepingTerms, unmaskTerms } from "./keep-terms";

/** Word-by-word Portuguese → Spanish, translating jargon the way Chrome does. */
const WORDS: [string, string][] = [
  ["pull request", "solicitud de extracción"],
  ["commit", "confirmación"],
  ["push", "empujar"],
  ["Agora", "Ahora"],
  ["agora", "ahora"],
  ["faça", "haz"],
  ["Faça", "Haz"],
  ["abra", "abre"],
  ["Crie", "Crea"],
  ["variável", "variable"],
  ["uma", "una"],
  ["um", "un"],
  ["o", "el"],
  ["e", "y"],
  ["no", "en"],
  ["se", "si"],
  ["if", "si"],
];

function chromeLike(text: string): Promise<string> {
  let out = text;
  for (const [pt, es] of WORDS) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${pt}(?![\\p{L}\\p{N}_])`, "gu"), es);
  }
  return Promise.resolve(out);
}

/** Same, but it also drops the placeholders (forces the fallback path). */
const losesPlaceholders = async (text: string) => (await chromeLike(text)).replace(/XQZ\d+\s?/g, "");

async function viaStream(text: string, translate = chromeLike) {
  const matched = matcherFor().match(text);
  return translateKeepingTerms(translate, matched.text, matched.terms);
}

describe("keepsInSpanish", () => {
  it("keeps jargon and translates Portuguese words that have a Spanish name", () => {
    for (const id of ["commit", "push", "branch", "pull-request", "use-state", "objeto", "metodo"])
      expect(keepsInSpanish(getTerm(id)!), id).toBe(true);
    for (const id of ["variavel", "funcao", "parametro", "classe", "repositorio"])
      expect(keepsInSpanish(getTerm(id)!), id).toBe(false);
  });
});

describe("translateKeepingTerms", () => {
  it("keeps commit and pull request instead of translating them", async () => {
    expect(await viaStream("Agora faça o commit e abra um pull request")).toBe(
      "Ahora haz el commit y abre un pull request",
    );
  });

  it("still translates terms that have a Spanish word", async () => {
    expect(await viaStream("Crie uma variável")).toBe("Crea una variable");
  });

  it("falls back to swapping the Spanish rendering back when placeholders are lost", async () => {
    expect(await viaStream("Agora faça o commit e abra um pull request", losesPlaceholders)).toBe(
      "Ahora haz el commit y abre un pull request",
    );
  });

  it("keeps sentence-initial capitals in the fallback", async () => {
    const out = await translateKeepingTerms(losesPlaceholders, "commit agora", [
      { termId: "commit", start: 0, end: 6 },
    ]);
    expect(out).toBe("commit ahora");
    const capital = await translateKeepingTerms(async () => "Confirmación ahora", "commit agora", [
      { termId: "commit", start: 0, end: 6 },
    ]);
    expect(capital).toBe("Commit ahora");
  });

  it("never swaps everyday Spanish words back in the fallback", async () => {
    // "si" is the Spanish for "if", but also an ordinary word: left alone.
    expect(await viaStream("o if testa se", losesPlaceholders)).toBe("el si testa si");
  });

  it("calls the translator once when the sentence has no kept term", async () => {
    let calls = 0;
    const counting = async (s: string) => {
      calls++;
      return chromeLike(s);
    };
    expect(await viaStream("Crie uma variável", counting)).toBe("Crea una variable");
    expect(calls).toBe(1);
  });
});

describe("placeholders", () => {
  it("round-trips and rejects a lost or repeated placeholder", () => {
    const text = "faça o commit e o push";
    const { masked, slots } = maskTerms(text, matcherFor().match(text).terms);
    expect(masked).toBe("faça o XQZ1 e o XQZ2");
    expect(unmaskTerms("haz el XQZ1 y el XQZ2", slots)).toBe("haz el commit y el push");
    expect(unmaskTerms("haz el xqz1 y el XQZ2", slots)).toBe("haz el commit y el push");
    expect(unmaskTerms("haz el XQZ1 y el XQZ1", slots)).toBeNull();
    expect(unmaskTerms("haz el XQZ1", slots)).toBeNull();
  });
});

describe("keepingTerms (summary and quiz)", () => {
  it("finds the terms itself", async () => {
    expect(await keepingTerms(chromeLike)("Faça um commit")).toBe("Haz un commit");
  });
});
