"use client";

import { Code2, Lightbulb, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuizItem, Resumo } from "@/lib/api/types";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export function ResumoEditor({ value, onChange }: { value: Resumo; onChange: (r: Resumo) => void }) {
  const set = (patch: Partial<Resumo>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="resumo-titulo">{t.review.title}</Label>
        <Input
          id="resumo-titulo"
          value={value.titulo}
          onChange={(e) => set({ titulo: e.target.value })}
          className="text-base font-semibold"
        />
      </div>
      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 text-sm font-medium">{t.review.topics}</legend>
        {value.topicos.map((topic, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-2.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground"
            >
              {i + 1}
            </span>
            <Textarea
              aria-label={t.review.topic(i + 1)}
              value={topic}
              rows={2}
              onChange={(e) => set({ topicos: value.topicos.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t.review.remove}: ${t.review.topic(i + 1)}`}
              title={t.review.remove}
              className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
              onClick={() => set({ topicos: value.topicos.filter((_, j) => j !== i) })}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button variant="outline" className="border-dashed" onClick={() => set({ topicos: [...value.topicos, ""] })}>
          <Plus aria-hidden />
          {t.review.addTopic}
        </Button>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="resumo-termos">{t.review.keyTerms}</Label>
        <Input
          id="resumo-termos"
          value={(value.termos_chave ?? []).join(", ")}
          onChange={(e) => set({ termos_chave: e.target.value.split(",") })}
          className="font-mono"
        />
      </div>
    </div>
  );
}

export function QuizEditor({ value, onChange }: { value: QuizItem[]; onChange: (q: QuizItem[]) => void }) {
  const setItem = (i: number, patch: Partial<QuizItem>) =>
    onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <ol className="space-y-5">
      {value.map((q, i) => (
        <li key={i} className="space-y-4 rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="mr-auto flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              {t.review.question(i + 1)}
            </h3>
            <div role="radiogroup" aria-label={t.review.kind} className="inline-grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["conceito", "codigo"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={q.tipo === k}
                  onClick={() => setItem(i, { tipo: k, codigo: k === "conceito" ? null : (q.codigo ?? "") })}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all",
                    q.tipo === k
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k === "codigo" ? <Code2 aria-hidden className="size-4" /> : <Lightbulb aria-hidden className="size-4" />}
                  {t.review.kinds[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`q${i}-pergunta`}>{t.review.questionText}</Label>
            <Textarea
              id={`q${i}-pergunta`}
              rows={2}
              value={q.pergunta}
              onChange={(e) => setItem(i, { pergunta: e.target.value })}
            />
          </div>
          {q.tipo === "codigo" && (
            <div className="space-y-1.5">
              <Label htmlFor={`q${i}-codigo`}>{t.review.code}</Label>
              <Textarea
                id={`q${i}-codigo`}
                rows={4}
                className="bg-[#17181c] font-mono text-[#f3efe8] dark:bg-[#0c0b0a]"
                value={q.codigo ?? ""}
                onChange={(e) => setItem(i, { codigo: e.target.value })}
              />
            </div>
          )}
          <fieldset className="space-y-2">
            {q.opcoes.map((opt, o) => {
              const right = q.correta === o;
              return (
                <div
                  key={o}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 p-1 pl-2 transition-colors",
                    right ? "border-success bg-success-soft" : "border-transparent",
                  )}
                >
                  <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-1">
                    <input
                      type="radio"
                      name={`q${i}-correta`}
                      aria-label={`${t.review.correct}: ${t.review.option(o)}`}
                      checked={right}
                      onChange={() => setItem(i, { correta: o })}
                      className="size-5 shrink-0 accent-[var(--success)]"
                    />
                    <span aria-hidden className="w-5 font-mono text-sm font-bold">
                      {String.fromCharCode(65 + o)}
                    </span>
                  </label>
                  <Input
                    aria-label={t.review.option(o)}
                    value={opt}
                    onChange={(e) => setItem(i, { opcoes: q.opcoes.map((x, j) => (j === o ? e.target.value : x)) })}
                  />
                  {right && (
                    <span className="hidden shrink-0 px-2 text-xs font-semibold text-success sm:inline">
                      {t.review.correct}
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor={`q${i}-explicacao`}>{t.review.explanation}</Label>
            <Textarea
              id={`q${i}-explicacao`}
              rows={2}
              value={q.explicacao}
              onChange={(e) => setItem(i, { explicacao: e.target.value })}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
