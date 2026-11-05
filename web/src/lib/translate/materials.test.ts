import { describe, expect, it } from "vitest";
import type { QuizItem, Resumo } from "@/lib/api/types";
import { looksLikeCode, translateMaterials } from "./materials";

const fake = async (s: string) => `ES(${s})`;

const resumo: Resumo = { titulo: "Git", topicos: ["Commits", "Branches", "Merge"], termos_chave: ["commit"] };
const quiz: QuizItem[] = [
  { pergunta: "O que é?", tipo: "conceito", codigo: null, opcoes: ["a", "b", "c", "d"], correta: 1, explicacao: "Porque sim" },
  {
    pergunta: "O que mostra?",
    tipo: "codigo",
    codigo: "console.log(1 + 1)",
    opcoes: ["2", '"11"', "Um erro", "undefined"],
    correta: 0,
    explicacao: "Soma",
  },
];

describe("translateMaterials", () => {
  it("translates text but keeps code, answers and key terms", async () => {
    const out = await translateMaterials(fake, resumo, quiz);
    expect(out.resumo.titulo).toBe("ES(Git)");
    expect(out.resumo.topicos).toEqual(["ES(Commits)", "ES(Branches)", "ES(Merge)"]);
    expect(out.resumo.termos_chave).toEqual(["commit"]);
    expect(out.quiz[0].opcoes).toEqual(["ES(a)", "ES(b)", "ES(c)", "ES(d)"]);
    expect(out.quiz[1].codigo).toBe("console.log(1 + 1)");
    expect(out.quiz[1].opcoes).toEqual(["2", '"11"', "ES(Um erro)", "undefined"]);
    expect(out.quiz[1].correta).toBe(0);
  });

  it("detects code-like options", () => {
    expect(looksLikeCode("x = 1")).toBe(true);
    expect(looksLikeCode("42")).toBe(true);
    expect(looksLikeCode("Uma variável")).toBe(false);
  });
});
