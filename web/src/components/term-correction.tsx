"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, SpellCheck } from "lucide-react";
import { SectionTitle } from "@/components/page-header";
import { Notice } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { correctionProblem } from "@/lib/terms/corrections";
import { termsFor } from "@/lib/terms/pack";
import { getSupabase } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/pt-BR";

export type Corrections = Record<string, string[]>;

/**
 * Loads all teacher corrections as extra variants per term id. Rows that would be unsafe
 * (common words, unknown terms, rows saved before validation existed) are skipped.
 */
export async function loadCorrections(packIds?: string[]): Promise<Corrections> {
  const terms = termsFor(packIds);
  const known = new Set(terms.map((x) => x.id));
  const { data } = await getSupabase().from("term_corrections").select("term_id,heard").limit(1000);
  const out: Corrections = {};
  for (const row of data ?? []) {
    const termId = row.term_id as string;
    const heard = row.heard as string;
    if (!known.has(termId) || correctionProblem(heard, termId, terms)) continue;
    (out[termId] ??= []).push(heard);
  }
  return out;
}

export function TermCorrection({
  packIds,
  onSaved,
}: {
  packIds?: string[];
  onSaved: (termId: string, heard: string) => void;
}) {
  const terms = useMemo(
    () => [...termsFor(packIds)].sort((a, b) => a.canonical.localeCompare(b.canonical, "pt-BR")),
    [packIds],
  );
  const [heard, setHeard] = useState("");
  const [termId, setTermId] = useState(terms[0]?.id ?? "");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const term = terms.find((x) => x.id === termId);
    const value = heard.trim().replace(/\s+/g, " ");
    if (!term || !value) return;
    const problem = correctionProblem(value, term.id, terms);
    if (problem) {
      setMsg({ text: t.correction.problems[problem], ok: false });
      return;
    }
    setBusy(true);
    const { error } = await getSupabase()
      .from("term_corrections")
      .insert({ term_id: term.id, heard: value, correct: term.canonical });
    setBusy(false);
    if (error) {
      setMsg({ text: t.correction.error, ok: false });
      return;
    }
    onSaved(term.id, value);
    setMsg({ text: t.correction.saved(value, term.canonical), ok: true });
    setHeard("");
  }

  return (
    <form onSubmit={save} className="surface space-y-4 p-5" aria-labelledby="corr-title">
      <SectionTitle icon={SpellCheck} id="corr-title">
        {t.correction.title}
      </SectionTitle>
      <p className="text-sm text-muted-foreground">{t.correction.hint}</p>
      <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="corr-heard">{t.correction.heard}</Label>
          <Input
            id="corr-heard"
            maxLength={80}
            placeholder={t.correction.heardPlaceholder}
            value={heard}
            onChange={(e) => setHeard(e.target.value)}
          />
        </div>
        <ArrowRight aria-hidden className="mb-3.5 hidden size-5 text-muted-foreground md:block" />
        <div className="space-y-1.5">
          <Label htmlFor="corr-term">{t.correction.term}</Label>
          <div className="relative">
            <select
              id="corr-term"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-input bg-card pr-10 pl-3.5 font-mono shadow-xs"
            >
              {terms.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.canonical}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
        <Button type="submit" disabled={busy || !heard.trim()}>
          {t.correction.save}
        </Button>
      </div>
      {msg && <Notice tone={msg.ok ? "success" : "warning"}>{msg.text}</Notice>}
    </form>
  );
}
