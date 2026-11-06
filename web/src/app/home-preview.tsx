"use client";

import { useState } from "react";
import { BookOpen, Captions, MousePointerClick } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { explain, getTerm } from "@/lib/terms/pack";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

type PreviewTerm = "commit" | "pull-request";

/** Small, self-contained caption sample on the home page; uses the real term pack. */
export function HomePreview() {
  const [open, setOpen] = useState<PreviewTerm>("commit");
  const term = getTerm(open);
  const text = term ? explain(term, "curta", "pt").text : "";

  const termButton = (id: PreviewTerm, label: string) => (
    <button
      type="button"
      aria-pressed={open === id}
      aria-label={t.student.termAria(label)}
      onClick={() => setOpen(id)}
      className={cn("term-highlight", open === id && "ring-2 ring-primary/40")}
    >
      {label}
    </button>
  );

  return (
    <div className="surface relative overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Captions aria-hidden className="size-4 text-muted-foreground" />
        <span className="mr-auto text-sm font-medium">{t.home.features.captions.title}</span>
        <StatusPill tone="live">{t.lessons.live}</StatusPill>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs font-medium text-muted-foreground">
          <MousePointerClick aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
          {t.home.previewLabel}
        </p>
        <p className="text-xl leading-relaxed sm:text-2xl">
          {t.home.previewBefore}
          {termButton("commit", t.home.previewTerm)}
          {t.home.previewAfter}
          {termButton("pull-request", t.home.previewTerm2)}
          {t.home.previewEnd}
        </p>
        <div key={open} aria-live="polite" className="animate-rise rounded-xl border bg-muted/50 p-4">
          <p className="mb-1 flex items-center gap-2 font-mono text-sm font-semibold text-primary">
            <BookOpen aria-hidden className="size-4" />
            {term?.canonical}
          </p>
          <p className="text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
