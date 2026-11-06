"use client";

import { ChevronDown } from "lucide-react";
import type { TermoGlossario } from "@/lib/api/types";
import type { Lang } from "@/lib/terms/schemas";
import { useT } from "@/lib/i18n/context";

/** The lesson's AI glossary (approved by the teacher), in the student's language. */
export function GlossaryList({ terms, lang }: { terms: TermoGlossario[]; lang: Lang }) {
  const t = useT();
  const spanish = lang === "es";
  return (
    <ul className="space-y-2">
      {terms.map((g, i) => {
        const full = spanish ? g.es : g.pt;
        const short = spanish ? g.es.curta : lang === "en" && g.en_curta ? g.en_curta : g.pt.curta;
        const shortLang = spanish ? "es" : lang === "en" && g.en_curta ? "en" : "pt-BR";
        const steps = full.passos.filter((s) => s.trim());
        return (
          <li key={`${g.termo}-${i}`} className="rounded-2xl border bg-card">
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-start gap-3 p-4">
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-mono text-lg font-bold">{spanish ? g.nome_es : g.termo}</span>
                  <span className="block text-base leading-relaxed" lang={shortLang}>
                    {short}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-4 border-t p-4 text-base" lang={spanish ? "es" : "pt-BR"}>
                {full.exemplo.trim() && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-muted-foreground">{t.review.example}</p>
                    <p className="rounded-xl border bg-muted/70 p-3 font-mono text-sm leading-relaxed">{full.exemplo}</p>
                  </div>
                )}
                {steps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-muted-foreground">{t.review.steps}</p>
                    <ol className="space-y-2">
                      {steps.map((s, j) => (
                        <li key={j} className="flex gap-3">
                          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {j + 1}
                          </span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
