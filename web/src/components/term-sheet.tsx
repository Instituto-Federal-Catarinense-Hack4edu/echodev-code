"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, CircleHelp, Quote, ThumbsDown, ThumbsUp } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { explain, getTerm, literalMeaning } from "@/lib/terms/pack";
import type { Depth, Lang } from "@/lib/terms/schemas";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type FeedbackKind = "helped" | "not_helped" | "doubt";

interface Props {
  termId: string | null;
  onClose: () => void;
  depth: Depth;
  lang: Lang;
  onDepthChange: (d: Depth) => void;
  onLangChange: (l: Lang) => void;
  onFeedback?: (termId: string, kind: FeedbackKind, depth: Depth) => void;
}

const DEPTHS: Depth[] = ["curta", "exemplo", "passos"];
const LANGS: Lang[] = ["pt", "en", "es"];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  size = "md",
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
  size?: "md" | "sm";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-xl bg-muted p-1", size === "md" ? "grid-cols-3" : "inline-grid grid-cols-3")}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "min-h-11 rounded-lg px-3 text-sm font-semibold transition-all",
            value === o
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function TermSheet(props: Props) {
  const t = useT();
  const { termId, onClose, depth, lang, onDepthChange, onLangChange, onFeedback } = props;
  const term = termId ? getTerm(termId) : undefined;
  const [sentFor, setSentFor] = useState<string | null>(null);
  const resolved = term ? explain(term, depth, lang) : null;
  const literal = term ? literalMeaning(term, lang) : undefined;

  const feedback = [
    ["helped", t.termSheet.helped, ThumbsUp],
    ["not_helped", t.termSheet.notHelped, ThumbsDown],
    ["doubt", t.termSheet.doubt, CircleHelp],
  ] as const;

  return (
    <Sheet open={!!term} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="nice-scroll max-h-[88dvh] gap-5 overflow-y-auto rounded-t-3xl p-5 pt-3 sm:mx-auto sm:max-w-2xl sm:p-7 sm:pt-4"
      >
        {term && resolved && (
          <>
            <span aria-hidden className="mx-auto h-1.5 w-12 shrink-0 rounded-full bg-foreground/15" />
            <SheetHeader className="flex-row items-center gap-3 p-0 pr-10">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                <BookOpen aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {t.termSheet.termLabel}
                </p>
                <SheetTitle className="font-mono text-2xl font-bold">{term.canonical}</SheetTitle>
              </div>
              <SheetDescription className="sr-only">{t.termSheet.depth}</SheetDescription>
            </SheetHeader>

            <Segmented
              label={t.termSheet.depth}
              options={DEPTHS}
              value={depth}
              onChange={onDepthChange}
              render={(d) => t.termSheet.depths[d]}
            />

            <div
              key={`${term.id}-${depth}-${lang}`}
              lang={resolved.lang === "pt" ? "pt-BR" : resolved.lang}
              className="animate-rise text-lg leading-relaxed"
            >
              {Array.isArray(resolved.text) ? (
                <ol className="space-y-2.5">
                  {resolved.text.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : depth === "exemplo" ? (
                <p className="rounded-xl border bg-muted/70 p-4 font-mono text-base leading-relaxed">{resolved.text}</p>
              ) : (
                <p>{resolved.text}</p>
              )}
            </div>
            {resolved.fellBack && <p className="text-sm text-muted-foreground">{t.termSheet.fallback}</p>}

            {literal && (
              <p className="flex gap-3 rounded-xl border-l-4 border-primary bg-primary-soft/50 p-4 text-base">
                <Quote aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                <span>
                  <strong>{t.termSheet.literal}: </strong>
                  {literal}
                </span>
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t.termSheet.language}</p>
              <Segmented
                label={t.termSheet.language}
                options={LANGS}
                value={lang}
                onChange={onLangChange}
                render={(l) => t.termSheet.langs[l]}
              />
            </div>

            {onFeedback && (
              <div className="space-y-3 border-t pt-4">
                {sentFor === term.id ? (
                  <p role="status" className="animate-rise flex items-center gap-2 text-sm font-medium text-success">
                    <CheckCircle2 aria-hidden className="size-5" />
                    {t.termSheet.thanks}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium">{t.termSheet.feedbackTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      {feedback.map(([kind, label, Icon]) => (
                        <Button
                          key={kind}
                          variant="outline"
                          className="flex-1 basis-36"
                          onClick={() => {
                            onFeedback(term.id, kind, depth);
                            setSentFor(term.id);
                          }}
                        >
                          <Icon aria-hidden />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t.termSheet.unreviewed}</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
