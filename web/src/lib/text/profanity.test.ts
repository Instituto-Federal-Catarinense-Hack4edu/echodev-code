import { describe, expect, it } from "vitest";
import { MASK, censor } from "./profanity";

describe("censor", () => {
  it("masks swear words, ignoring case and accents", () => {
    expect(censor("Porra, deu erro de novo").text).toBe(`${MASK}, deu erro de novo`);
    expect(censor("que MERDA de bug").text).toBe(`que ${MASK} de bug`);
    expect(censor("esse código é uma bosta").masked).toBe(1);
    expect(censor("Desgraçado do compilador").text).toBe(`${MASK} do compilador`);
  });

  it("masks compound forms", () => {
    expect(censor("foda-se o teste").text).toBe(`${MASK} o teste`);
    expect(censor("what the fuck").text).toBe(`what the ${MASK}`);
  });

  it("never touches words that only contain a swear word", () => {
    const clean = "o computador disputa o recurso; a abelha pica; cubo, cueca e currículo";
    expect(censor(clean)).toEqual({ text: clean, masked: 0 });
  });

  it("leaves programming terms alone", () => {
    const text = "faça o merge e o commit, depois o push";
    expect(censor(text).text).toBe(text);
  });
});
