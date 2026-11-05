import { describe, expect, it } from "vitest";
import { spansInTranslation } from "./translated-spans";

const word = (text: string, s: { start: number; end: number }) => text.slice(s.start, s.end);

describe("spansInTranslation", () => {
  it("highlights the Spanish name of a translated term", () => {
    const text = "Creamos una variable y una función.";
    const { spans, missing } = spansInTranslation(text, ["variavel", "funcao"], "es");
    expect(spans.map((s) => word(text, s))).toEqual(["variable", "función"]);
    expect(missing).toEqual([]);
  });

  it("keeps English terms that stay the same", () => {
    const text = "Haz un commit y después un push.";
    const { spans } = spansInTranslation(text, ["commit", "push"], "es");
    expect(spans.map((s) => word(text, s))).toEqual(["commit", "push"]);
  });

  it("is case-insensitive and respects word boundaries", () => {
    const text = "La Rama nueva; no confundir con ramal.";
    const { spans } = spansInTranslation(text, ["branch"], "es");
    expect(spans.map((s) => word(text, s))).toEqual(["Rama"]);
  });

  it("reports terms it cannot find", () => {
    const { spans, missing } = spansInTranslation("Hola a todos.", ["git"], "es");
    expect(spans).toEqual([]);
    expect(missing).toEqual(["git"]);
  });

  it("does not match inside dotted code like console.log", () => {
    const text = "Usa console.log para ver el valor.";
    const { spans } = spansInTranslation(text, ["console-log"], "es");
    expect(spans.map((s) => word(text, s))).toEqual(["console.log"]);
  });
});
