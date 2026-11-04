import { describe, expect, it } from "vitest";
import demo from "@/content/demo/aula-demo.json";
import { createMatcher } from "./matcher";
import { termsFor } from "./pack";

describe("demo lesson", () => {
  it("approximate matching adds nothing beyond the exact dictionary", () => {
    const terms = termsFor();
    const exactOnly = createMatcher(terms.map((t) => ({ ...t, fuzzy: false })));
    const withFuzzy = createMatcher(terms);
    for (const { text } of demo.utterances) {
      expect(withFuzzy.match(text), text).toEqual(exactOnly.match(text));
    }
  });
});
