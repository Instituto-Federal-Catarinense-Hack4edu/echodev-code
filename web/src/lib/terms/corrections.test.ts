import { describe, expect, it } from "vitest";
import { correctionProblem } from "./corrections";
import { termsFor } from "./pack";

const terms = termsFor();

describe("correctionProblem", () => {
  it("accepts a real misrecognition", () => {
    expect(correctionProblem("comitê", "commit", terms)).toBeNull();
    expect(correctionProblem("puxe request", "pull-request", terms)).toBeNull();
  });

  it("refuses short, common or offensive phrases", () => {
    expect(correctionProblem("de", "commit", terms)).toBe("too_short");
    expect(correctionProblem("que", "commit", terms)).toBe("common_word");
    expect(correctionProblem("para isso", "commit", terms)).toBe("common_word");
    expect(correctionProblem("porra", "commit", terms)).toBe("profanity");
  });

  it("refuses phrases that are already another term", () => {
    expect(correctionProblem("guit", "commit", terms)).toBe("other_term");
    expect(correctionProblem("guit", "git", terms)).toBeNull();
  });
});
