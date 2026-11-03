import { describe, expect, it } from "vitest";
import { CODE_RE, generateLessonCode, normalizeCode } from "./lesson-code";

describe("lesson code", () => {
  it("generates valid codes without ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateLessonCode();
      expect(c).toMatch(CODE_RE);
      expect(c).not.toMatch(/[ILO01]/);
    }
  });
  it("normalizes typed codes", () => {
    expect(normalizeCode(" abc-234 ")).toBe("ABC234");
  });
});
