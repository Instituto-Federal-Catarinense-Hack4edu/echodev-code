import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import type { QuizItem } from "@/lib/api/types";
import { buildSummaryPdf, glossary, pdfFileName, toPdfText } from "./summary-pdf";

const resumo = {
  titulo: "Git e primeiros passos",
  topicos: ["Um commit é um ponto salvo → com mensagem…", "A branch é uma linha separada"],
  termos_chave: ["commit", "pull request", "algo que não é termo"],
};
const quiz: QuizItem[] = Array.from({ length: 5 }, (_, i) => ({
  pergunta: `Pergunta ${i + 1}?`,
  tipo: i < 2 ? "codigo" : "conceito",
  codigo: i < 2 ? 'git commit -m "x"' : null,
  opcoes: ["a", "b", "c", "d"],
  correta: i % 4,
  explicacao: `Porque ${i + 1}.`,
}));

describe("summary pdf", () => {
  it("maps characters outside the standard fonts", () => {
    expect(toPdfText("a → b… “c” – d ação")).toBe('a -> b... "c" - d ação');
  });

  it("builds a safe file name", () => {
    expect(pdfFileName("Introdução ao Git / aula 1")).toBe("resumo-introducao-ao-git-aula-1.pdf");
    expect(pdfFileName("!!!")).toBe("resumo-aula.pdf");
  });

  it("explains key terms from the pack and keeps unknown ones", () => {
    const g = glossary(resumo.termos_chave);
    expect(g[0].term).toBe("commit");
    expect(g[0].short).toMatch(/ponto salvo/);
    expect(g[1].term).toBe("pull request");
    expect(g[2]).toEqual({ term: "algo que não é termo", short: null });
  });

  it("produces a student PDF without the quiz and a teacher PDF with the answer key", () => {
    const date = new Date("2026-11-03T12:00:00Z");
    const student = buildSummaryPdf(jsPDF, { lessonTitle: "Aula 1", date, resumo });
    const teacher = buildSummaryPdf(jsPDF, { lessonTitle: "Aula 1", date, resumo, quiz });
    const s = student.output();
    const tch = teacher.output();
    expect(s.startsWith("%PDF-")).toBe(true);
    expect(s).toContain("Termos-chave");
    expect(s).not.toContain("Gabarito");
    expect(tch).toContain("Gabarito");
    expect(teacher.getNumberOfPages()).toBeGreaterThanOrEqual(student.getNumberOfPages());
  });
});
