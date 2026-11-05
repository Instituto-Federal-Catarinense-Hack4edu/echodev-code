"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizItem } from "@/lib/api/types";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/** One question at a time; shows right/wrong and the explanation. Answers are never saved. */
export function QuizPlayer({ items }: { items: QuizItem[] }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = index >= items.length;

  if (done)
    return (
      <div className="space-y-3" role="status">
        <p className="text-lg font-semibold">{t.review.finish(score, items.length)}</p>
        <Button
          variant="outline"
          onClick={() => {
            setIndex(0);
            setScore(0);
            setPicked(null);
          }}
        >
          {t.review.restart}
        </Button>
      </div>
    );

  const q = items[index];
  const answered = picked !== null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.review.quizProgress(index + 1, items.length)}</p>
      <p className="text-lg font-semibold">{q.pergunta}</p>
      {q.codigo && (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm">
          <code>{q.codigo}</code>
        </pre>
      )}
      <div role="radiogroup" aria-label={q.pergunta} className="grid gap-2">
        {q.opcoes.map((opt, i) => {
          const isRight = i === q.correta;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={answered}
              onClick={() => {
                setPicked(i);
                if (isRight) setScore((s) => s + 1);
              }}
              className={cn(
                "min-h-11 rounded-lg border px-4 py-2 text-left text-base",
                answered && isRight && "border-green-700 bg-green-50 dark:bg-green-950",
                answered && picked === i && !isRight && "border-destructive bg-red-50 dark:bg-red-950",
              )}
            >
              <span className="mr-2 font-mono font-semibold">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="space-y-3 rounded-lg border p-3" role="status">
          <p className="font-semibold">
            {picked === q.correta ? t.review.right : t.review.wrong(q.opcoes[q.correta])}
          </p>
          <p>{q.explicacao}</p>
          <Button
            onClick={() => {
              setIndex(index + 1);
              setPicked(null);
            }}
          >
            {t.review.next}
          </Button>
        </div>
      )}
    </div>
  );
}
