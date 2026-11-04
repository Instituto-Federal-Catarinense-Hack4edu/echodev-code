import type { QuizItem, Resumo } from "@/lib/api/types";

/** Client-side checks before saving/approving an edited material (mirrors the Pydantic rules). */
export function validResumo(r: Resumo): boolean {
  return r.titulo.trim().length > 0 && r.topicos.some((t) => t.trim().length > 0);
}

export function validQuiz(q: QuizItem[]): boolean {
  return (
    q.length > 0 &&
    q.every(
      (item) =>
        item.pergunta.trim() &&
        item.explicacao.trim() &&
        item.opcoes.length === 4 &&
        item.opcoes.every((o) => o.trim()) &&
        item.correta >= 0 &&
        item.correta <= 3 &&
        (item.tipo === "conceito" || !!item.codigo?.trim()),
    )
  );
}

/** Removes blank topics/terms before saving. */
export function cleanResumo(r: Resumo): Resumo {
  return {
    titulo: r.titulo.trim(),
    topicos: r.topicos.map((t) => t.trim()).filter(Boolean),
    termos_chave: (r.termos_chave ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

export function isResumo(content: unknown): content is Resumo {
  return !!content && typeof content === "object" && !Array.isArray(content) && "titulo" in content;
}

export interface LessonDates {
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
}

/** The date a lesson happened (start, then end, then creation), for the PDF header. */
export function lessonDate(l: LessonDates): Date {
  const iso = l.started_at ?? l.ended_at ?? l.created_at;
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function isQuiz(content: unknown): content is QuizItem[] {
  return Array.isArray(content);
}
