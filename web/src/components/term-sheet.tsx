"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { explain, getTerm } from "@/lib/terms/pack";
import type { Depth, Lang } from "@/lib/terms/schemas";
import { t } from "@/lib/i18n/pt-BR";
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
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium",
            value === o ? "border-primary bg-primary text-primary-foreground" : "bg-background",
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function TermSheet(props: Props) {
  const { termId, onClose, depth, lang, onDepthChange, onLangChange, onFeedback } = props;
  const term = termId ? getTerm(termId) : undefined;
  const [sentFor, setSentFor] = useState<string | null>(null);
  const resolved = term ? explain(term, depth, lang) : null;

  return (
    <Sheet open={!!term} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5">
        {term && resolved && (
          <>
            <SheetHeader className="p-0">
              <SheetTitle className="font-mono text-2xl">{term.canonical}</SheetTitle>
              <SheetDescription className="sr-only">{t.termSheet.depth}</SheetDescription>
            </SheetHeader>

            <Segmented
              label={t.termSheet.depth}
              options={DEPTHS}
              value={depth}
              onChange={onDepthChange}
              render={(d) => t.termSheet.depths[d]}
            />

            <div lang={resolved.lang === "pt" ? "pt-BR" : resolved.lang} className="text-lg leading-relaxed">
              {Array.isArray(resolved.text) ? (
                <ol className="list-decimal space-y-1 pl-6">
                  {resolved.text.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : depth === "exemplo" ? (
                <p className="rounded-lg bg-muted p-3 font-mono text-base">{resolved.text}</p>
              ) : (
                <p>{resolved.text}</p>
              )}
            </div>
            {resolved.fellBack && <p className="text-sm text-muted-foreground">{t.termSheet.fallback}</p>}

            {term.figurative && term.literalMeaning && (
              <p className="rounded-lg border p-3 text-base">
                <strong>{t.termSheet.literal}: </strong>
                {term.literalMeaning}
              </p>
            )}

            <Segmented
              label={t.termSheet.language}
              options={LANGS}
              value={lang}
              onChange={onLangChange}
              render={(l) => t.termSheet.langs[l]}
            />

            {onFeedback && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {sentFor === term.id ? (
                  <p className="text-sm text-muted-foreground">{t.termSheet.thanks}</p>
                ) : (
                  (
                    [
                      ["helped", t.termSheet.helped],
                      ["not_helped", t.termSheet.notHelped],
                      ["doubt", t.termSheet.doubt],
                    ] as const
                  ).map(([kind, label]) => (
                    <Button
                      key={kind}
                      variant="outline"
                      onClick={() => {
                        onFeedback(term.id, kind, depth);
                        setSentFor(term.id);
                      }}
                    >
                      {label}
                    </Button>
                  ))
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
