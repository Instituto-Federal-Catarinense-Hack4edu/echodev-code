"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw, Trophy, X } from "lucide-react";
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

  if (done) {
    const pct = items.length ? Math.round((score / items.length) * 100) : 0;
    return (
      <div className="animate-rise flex flex-col items-center gap-4 py-4 text-center" role="status">
        <div
          className="grid size-28 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--muted) 0)` }}
          aria-hidden
        >
          <span className="grid size-22 place-items-center rounded-full bg-card">
            <Trophy className="size-9 text-primary" />
          </span>
        </div>
        <p className="text-2xl font-bold">{t.review.finishTitle}</p>
        <p className="text-lg font-semibold">{t.review.finish(score, items.length)}</p>
        <Button
          variant="outline"
          onClick={() => {
            setIndex(0);
            setScore(0);
            setPicked(null);
          }}
        >
          <RotateCcw aria-hidden />
          {t.review.restart}
        </Button>
      </div>
    );
  }

  const q = items[index];
  const answered = picked !== null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium">{t.review.quizProgress(index + 1, items.length)}</span>
          <span className="tabular-nums">
            <Check aria-hidden className="mr-1 inline size-4 text-success" />
            {score}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < index ? "bg-primary" : i === index ? "bg-primary/45" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>
      <p key={index} className="animate-rise text-lg leading-snug font-semibold sm:text-xl">
        {q.pergunta}
      </p>
      {q.codigo && (
        <pre className="nice-scroll overflow-x-auto rounded-xl bg-[#17181c] p-4 font-mono text-sm leading-relaxed text-[#f3efe8]">
          <code>{q.codigo}</code>
        </pre>
      )}
      <div role="radiogroup" aria-label={q.pergunta} className="grid gap-2">
        {q.opcoes.map((opt, i) => {
          const isRight = i === q.correta;
          const showRight = answered && isRight;
          const showWrong = answered && picked === i && !isRight;
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
                "group flex min-h-13 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-base transition-all",
                !answered && "hover:-translate-y-px hover:border-primary/50 hover:shadow-[var(--shadow-soft)]",
                answered && !showRight && !showWrong && "opacity-60",
                showRight && "border-success bg-success-soft",
                showWrong && "border-destructive bg-danger-soft",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold transition-colors",
                  showRight
                    ? "bg-success text-white dark:text-background"
                    : showWrong
                      ? "bg-destructive text-white dark:text-background"
                      : "bg-muted group-hover:bg-primary-soft group-hover:text-primary-soft-foreground",
                )}
              >
                {showRight ? (
                  <Check aria-hidden className="size-4" />
                ) : showWrong ? (
                  <X aria-hidden className="size-4" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          className={cn(
            "animate-rise space-y-3 rounded-xl border-l-4 p-4",
            picked === q.correta ? "border-success bg-success-soft" : "border-destructive bg-danger-soft",
          )}
          role="status"
        >
          <p className="font-semibold">
            {picked === q.correta ? t.review.right : t.review.wrong(q.opcoes[q.correta])}
          </p>
          <p className="text-base leading-relaxed">{q.explicacao}</p>
          <Button
            onClick={() => {
              setIndex(index + 1);
              setPicked(null);
            }}
          >
            {t.review.next}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
