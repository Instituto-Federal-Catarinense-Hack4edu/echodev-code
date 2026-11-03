import { describe, expect, it } from "vitest";
import type { QuizItem } from "@/lib/api/types";
import { cleanResumo, isQuiz, isResumo, validQuiz, validResumo } from "./materials";

const item: QuizItem = {
  pergunta: "O que é um commit?",
  tipo: "conceito",
  codigo: null,
  opcoes: ["a", "b", "c", "d"],
  correta: 0,
  explicacao: "porque sim",
};

describe("materials validation", () => {
  it("accepts a complete quiz and rejects blanks", () => {
    expect(validQuiz([item])).toBe(true);
    expect(validQuiz([{ ...item, opcoes: ["a", "", "c", "d"] }])).toBe(false);
    expect(validQuiz([{ ...item, tipo: "codigo", codigo: "  " }])).toBe(false);
    expect(validQuiz([{ ...item, correta: 4 }])).toBe(false);
  });

  it("cleans and validates the summary", () => {
    const r = cleanResumo({ titulo: " Git ", topicos: ["a", " "], termos_chave: ["", "git"] });
    expect(r).toEqual({ titulo: "Git", topicos: ["a"], termos_chave: ["git"] });
    expect(validResumo(r)).toBe(true);
    expect(validResumo({ ...r, topicos: [" "] })).toBe(false);
  });

  it("tells content kinds apart", () => {
    expect(isResumo({ titulo: "x", topicos: [] })).toBe(true);
    expect(isQuiz([item])).toBe(true);
    expect(isResumo([item])).toBe(false);
  });
});
