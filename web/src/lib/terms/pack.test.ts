import { describe, expect, it } from "vitest";
import { normalize } from "./matcher";
import { explain, getPack, getTerm, matcherFor } from "./pack";

describe("programacao-geral pack", () => {
  const pack = getPack();

  it("has 40 unique terms, all pending human review", () => {
    expect(pack.terms).toHaveLength(40);
    expect(new Set(pack.terms.map((t) => t.id)).size).toBe(40);
    expect(pack.terms.every((t) => t.reviewed === false)).toBe(true);
  });

  it("has en/es short explanations for at least 15 terms", () => {
    const both = pack.terms.filter((t) => t.explanations.en?.short && t.explanations.es?.short);
    expect(both.length).toBeGreaterThanOrEqual(15);
  });

  it("figurative terms carry a literal meaning", () => {
    for (const t of pack.terms.filter((x) => x.figurative)) expect(t.literalMeaning).toBeTruthy();
  });

  it("no spoken key points to two different terms", () => {
    const owner = new Map<string, string>();
    for (const t of pack.terms) {
      for (const phrase of [t.canonical, ...t.variants, ...(t.forms ?? [])]) {
        const key = normalize(phrase).replace(/[^\p{L}\p{N}]+/gu, "");
        const prev = owner.get(key);
        expect(prev === undefined || prev === t.id, `${phrase} in ${t.id} and ${prev}`).toBe(true);
        owner.set(key, t.id);
      }
    }
  });

  it("corrects typical pt-BR misrecognitions end to end", () => {
    const m = matcherFor();
    const r = m.match("Agora faça o comiti e abra um pul rikuesti no guit hub.");
    expect(r.text).toBe("Agora faça o commit e abra um pull request no GitHub.");
    expect(r.terms.map((s) => s.termId)).toEqual(["commit", "pull-request", "github"]);
  });

  it("falls back to Portuguese when a language is missing", () => {
    const html = getTerm("html")!;
    expect(explain(html, "curta", "en").fellBack).toBe(true);
    const commit = getTerm("commit")!;
    const r = explain(commit, "curta", "es");
    expect(r.fellBack).toBe(false);
    expect(r.lang).toBe("es");
    expect(explain(commit, "passos", "en").lang).toBe("pt");
  });
});
