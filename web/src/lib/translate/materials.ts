import type { QuizItem, Resumo } from "@/lib/api/types";

type Translate = (text: string) => Promise<string>;

const CODE_LIKE = /[{}()[\];=<>`"']|^\s*-?[\d.]+\s*$|^\s*(true|false|null|undefined|NaN)\s*$/;

/** Options of code questions are often code or output: those stay exactly as written. */
export function looksLikeCode(option: string): boolean {
  return CODE_LIKE.test(option);
}

/** Spanish copy of the approved Portuguese materials. Code and key terms are never translated. */
export async function translateMaterials(
  translate: Translate,
  resumo: Resumo,
  quiz: QuizItem[],
): Promise<{ resumo: Resumo; quiz: QuizItem[] }> {
  const tr = async (s: string) => (s.trim() ? (await translate(s)).trim() || s : s);
  const translatedResumo: Resumo = {
    ...resumo,
    titulo: await tr(resumo.titulo),
    topicos: await Promise.all(resumo.topicos.map(tr)),
  };
  const translatedQuiz = await Promise.all(
    quiz.map(async (q) => ({
      ...q,
      pergunta: await tr(q.pergunta),
      explicacao: await tr(q.explicacao),
      opcoes: await Promise.all(q.opcoes.map((o) => (q.tipo === "codigo" && looksLikeCode(o) ? o : tr(o)))),
    })),
  );
  return { resumo: translatedResumo, quiz: translatedQuiz };
}
