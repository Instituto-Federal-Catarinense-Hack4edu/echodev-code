"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuizItem, Resumo } from "@/lib/api/types";
import { t } from "@/lib/i18n/pt-BR";

export function ResumoEditor({ value, onChange }: { value: Resumo; onChange: (r: Resumo) => void }) {
  const set = (patch: Partial<Resumo>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="resumo-titulo">{t.review.title}</Label>
        <Input
          id="resumo-titulo"
          value={value.titulo}
          onChange={(e) => set({ titulo: e.target.value })}
          className="h-11"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t.review.topics}</legend>
        {value.topicos.map((topic, i) => (
          <div key={i} className="flex gap-2">
            <Textarea
              aria-label={t.review.topic(i + 1)}
              value={topic}
              rows={2}
              onChange={(e) => set({ topicos: value.topicos.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <Button
              variant="outline"
              onClick={() => set({ topicos: value.topicos.filter((_, j) => j !== i) })}
            >
              {t.review.remove}
            </Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => set({ topicos: [...value.topicos, ""] })}>
          {t.review.addTopic}
        </Button>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="resumo-termos">{t.review.keyTerms}</Label>
        <Input
          id="resumo-termos"
          value={(value.termos_chave ?? []).join(", ")}
          onChange={(e) => set({ termos_chave: e.target.value.split(",") })}
          className="h-11"
        />
      </div>
    </div>
  );
}

export function QuizEditor({ value, onChange }: { value: QuizItem[]; onChange: (q: QuizItem[]) => void }) {
  const setItem = (i: number, patch: Partial<QuizItem>) =>
    onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <ol className="space-y-6">
      {value.map((q, i) => (
        <li key={i} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">{t.review.question(i + 1)}</h3>
          <div className="space-y-1">
            <Label htmlFor={`q${i}-pergunta`}>{t.review.questionText}</Label>
            <Textarea
              id={`q${i}-pergunta`}
              rows={2}
              value={q.pergunta}
              onChange={(e) => setItem(i, { pergunta: e.target.value })}
            />
          </div>
          <div role="radiogroup" aria-label={t.review.kind} className="flex gap-2">
            {(["conceito", "codigo"] as const).map((k) => (
              <Button
                key={k}
                role="radio"
                aria-checked={q.tipo === k}
                variant={q.tipo === k ? "default" : "outline"}
                onClick={() => setItem(i, { tipo: k, codigo: k === "conceito" ? null : (q.codigo ?? "") })}
              >
                {t.review.kinds[k]}
              </Button>
            ))}
          </div>
          {q.tipo === "codigo" && (
            <div className="space-y-1">
              <Label htmlFor={`q${i}-codigo`}>{t.review.code}</Label>
              <Textarea
                id={`q${i}-codigo`}
                rows={4}
                className="font-mono"
                value={q.codigo ?? ""}
                onChange={(e) => setItem(i, { codigo: e.target.value })}
              />
            </div>
          )}
          <fieldset className="space-y-2">
            {q.opcoes.map((opt, o) => (
              <div key={o} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`q${i}-correta`}
                  aria-label={`${t.review.correct}: ${t.review.option(o)}`}
                  checked={q.correta === o}
                  onChange={() => setItem(i, { correta: o })}
                  className="size-6 shrink-0"
                />
                <Input
                  aria-label={t.review.option(o)}
                  value={opt}
                  onChange={(e) => setItem(i, { opcoes: q.opcoes.map((x, j) => (j === o ? e.target.value : x)) })}
                  className="h-11"
                />
              </div>
            ))}
          </fieldset>
          <div className="space-y-1">
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
