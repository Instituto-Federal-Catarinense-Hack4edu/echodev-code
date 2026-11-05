import { describe, expect, it } from "vitest";
import { createMatcher, editDistance, normalize, type MatchableTerm } from "./matcher";

const terms: MatchableTerm[] = [
  { id: "commit", canonical: "commit", variants: ["comiti", "comit"] },
  { id: "pull-request", canonical: "pull request", variants: ["pul rikuesti", "pou request"] },
  { id: "use-state", canonical: "useState", variants: ["iuse steite"] },
  { id: "git", canonical: "git", variants: ["guit"] },
  { id: "github", canonical: "GitHub", variants: ["guit hub"] },
  { id: "push", canonical: "push", variants: ["puxi"] },
  { id: "variavel", canonical: "variável", variants: [], forms: ["variáveis"] },
  { id: "console-log", canonical: "console.log", variants: ["consoli log"] },
  { id: "front-end", canonical: "front-end", variants: [] },
];
const m = createMatcher(terms);

function spanTexts(text: string) {
  const r = m.match(text);
  return { text: r.text, found: r.terms.map((s) => [s.termId, r.text.slice(s.start, s.end)]) };
}

describe("normalize", () => {
  it("lowercases and strips accents", () => {
    expect(normalize("Variável Função")).toBe("variavel funcao");
  });
});

describe("editDistance", () => {
  it("counts edits and adjacent transpositions, capped", () => {
    expect(editDistance("commit", "comitt", 2)).toBe(2);
    expect(editDistance("merge", "merje", 1)).toBe(1);
    expect(editDistance("branch", "barnch", 1)).toBe(1); // transposition
    expect(editDistance("abc", "xyzxyz", 1)).toBe(2); // capped at max + 1
  });
});

describe("approximate matching", () => {
  const fm = createMatcher([
    { id: "commit", canonical: "commit", variants: ["comiti"] },
    { id: "branch", canonical: "branch", variants: [] },
    { id: "classe", canonical: "classe", variants: [], fuzzy: false },
    { id: "merge", canonical: "merge", variants: [] },
    { id: "merde", canonical: "merde", variants: [] },
  ]);

  it("fixes one-letter misspellings of long-enough terms", () => {
    expect(fm.match("faça o comitti").text).toBe("faça o commit");
    expect(fm.match("na brench nova").text).toBe("na branch nova");
  });

  it("skips blocked Portuguese words, short words and fuzzy:false terms", () => {
    expect(fm.match("quadro branco").text).toBe("quadro branco");
    expect(fm.match("classi").text).toBe("classi");
    expect(fm.match("git").terms).toHaveLength(0);
  });

  it("does nothing when two terms are equally close", () => {
    expect(fm.match("merse").text).toBe("merse");
  });

  it("keeps exact matches ahead of approximate ones", () => {
    expect(fm.match("comiti").text).toBe("commit");
  });
});

describe("matcher", () => {
  it("returns empty for empty sentence", () => {
    expect(m.match("")).toEqual({ text: "", terms: [] });
  });

  it("leaves text without matches untouched", () => {
    expect(m.match("Bom dia, turma!")).toEqual({ text: "Bom dia, turma!", terms: [] });
  });

  it("replaces a shorter variant and fixes later offsets", () => {
    const r = spanTexts("Faça o comiti e depois o puxi.");
    expect(r.text).toBe("Faça o commit e depois o push.");
    expect(r.found).toEqual([
      ["commit", "commit"],
      ["push", "push"],
    ]);
  });

  it("replaces a longer 2-token variant with a different-length canonical", () => {
    const r = spanTexts("Abra um pul rikuesti agora, pou request também");
    expect(r.text).toBe("Abra um pull request agora, pull request também");
    expect(r.found).toEqual([
      ["pull-request", "pull request"],
      ["pull-request", "pull request"],
    ]);
  });

  it("is case and accent insensitive", () => {
    const r = spanTexts("COMITI e Guit");
    expect(r.text).toBe("commit e git");
    expect(r.found.map((f) => f[0])).toEqual(["commit", "git"]);
  });

  it("keeps sentence-initial capitalization of lowercase canonical", () => {
    expect(spanTexts("Commit feito.").text).toBe("Commit feito.");
  });

  it("fixes accents to the canonical form", () => {
    expect(spanTexts("crie a variavel x").text).toBe("crie a variável x");
  });

  it("highlights forms without replacing them", () => {
    const r = spanTexts("duas variáveis");
    expect(r.text).toBe("duas variáveis");
    expect(r.found).toEqual([["variavel", "variáveis"]]);
  });

  it('turns "use state" into "useState" via joined tokens', () => {
    const r = spanTexts("vamos usar o use state aqui");
    expect(r.text).toBe("vamos usar o useState aqui");
    expect(r.found).toEqual([["use-state", "useState"]]);
  });

  it("keeps punctuation out of the span", () => {
    const r = m.match("Fiz o commit, depois push.");
    expect(r.terms).toEqual([
      { termId: "commit", start: 6, end: 12 },
      { termId: "push", start: 21, end: 25 },
    ]);
    expect(r.text.slice(12, 13)).toBe(",");
  });

  it("handles adjacent terms", () => {
    const r = spanTexts("git push");
    expect(r.found).toEqual([
      ["git", "git"],
      ["push", "push"],
    ]);
  });

  it("prefers the longest overlapping match", () => {
    const r = spanTexts("suba no guit hub");
    expect(r.text).toBe("suba no GitHub");
    expect(r.found).toEqual([["github", "GitHub"]]);
  });

  it("does not join tokens across punctuation", () => {
    const r = spanTexts("pull, request");
    expect(r.found).toEqual([]);
  });

  it("matches canonicals with internal punctuation", () => {
    expect(spanTexts("use o consoli log").text).toBe("use o console.log");
    expect(spanTexts("o front end e o front-end").found).toEqual([
      ["front-end", "front-end"],
      ["front-end", "front-end"],
    ]);
  });

  it("produces spans that are always inside the output", () => {
    const text = "comiti pul rikuesti iuse steite guit hub puxi variavel";
    const r = m.match(text);
    for (const s of r.terms) {
      expect(s.start).toBeLessThan(s.end);
      expect(s.end).toBeLessThanOrEqual(r.text.length);
    }
    expect(r.text).toBe("commit pull request useState GitHub push variável");
  });
});
