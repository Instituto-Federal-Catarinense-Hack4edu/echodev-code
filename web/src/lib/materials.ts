import type { GenerateRequest, Glossario, QuizItem, Resumo, TermoGlossario } from "@/lib/api/types";
import { knownTermNames } from "@/lib/terms/pack";

/** Body of POST /end and /materials/regenerate: the AI glossary skips terms already known. */
export function generateBody(packIds?: string[]): string {
  const body: GenerateRequest = { known_terms: knownTermNames(packIds) };
  return JSON.stringify(body);
}

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

export function lessonDate(l: LessonDates): Date {
  const iso = l.started_at ?? l.ended_at ?? l.created_at;
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function isQuiz(content: unknown): content is QuizItem[] {
  return Array.isArray(content);
}

export function isGlossario(content: unknown): content is Glossario {
  return (
    !!content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    Array.isArray((content as Glossario).termos)
  );
}

const lines = (steps: string[]) => steps.map((s) => s.trim()).filter(Boolean);

/** Trims every field and drops empty steps and variants (before saving an edited glossary). */
export function cleanGlossario(g: Glossario): Glossario {
  return {
    termos: (g.termos ?? []).map((term) => ({
      ...term,
      termo: term.termo.trim(),
      nome_es: term.nome_es.trim(),
      en_curta: (term.en_curta ?? "").trim(),
      variacoes: lines(term.variacoes ?? []),
      pt: { curta: term.pt.curta.trim(), exemplo: term.pt.exemplo.trim(), passos: lines(term.pt.passos) },
      es: { curta: term.es.curta.trim(), exemplo: term.es.exemplo.trim(), passos: lines(term.es.passos) },
    })),
  };
}

/** Name and the short explanation in both languages are what students need. */
export function validTermo(term: TermoGlossario): boolean {
  return !!(term.termo.trim() && term.nome_es.trim() && term.pt.curta.trim() && term.es.curta.trim());
}

export function validGlossario(g: Glossario): boolean {
  return (g.termos ?? []).every(validTermo);
}
