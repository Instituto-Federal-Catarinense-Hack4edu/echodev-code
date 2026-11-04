"use client";

import { useMemo, useState } from "react";
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const term = terms.find((x) => x.id === termId);
    const value = heard.trim().replace(/\s+/g, " ");
    if (!term || !value) return;
    const problem = correctionProblem(value, term.id, terms);
    if (problem) {
      setMsg(t.correction.problems[problem]);
      return;
    }
    setBusy(true);
    const { error } = await getSupabase()
      .from("term_corrections")
      .insert({ term_id: term.id, heard: value, correct: term.canonical });
    setBusy(false);
    if (error) {
      setMsg(t.correction.error);
      return;
    }
    onSaved(term.id, value);
    setMsg(t.correction.saved(value, term.canonical));
    setHeard("");
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t.correction.title}</h2>
      <p className="text-sm text-muted-foreground">{t.correction.hint}</p>
      <div className="space-y-1">
        <Label htmlFor="corr-heard">{t.correction.heard}</Label>
        <Input
          id="corr-heard"
          maxLength={80}
          placeholder={t.correction.heardPlaceholder}
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
          className="h-11"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="corr-term">{t.correction.term}</Label>
        <select
          id="corr-term"
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className="h-11 w-full rounded-lg border bg-background px-3"
        >
          {terms.map((x) => (
            <option key={x.id} value={x.id}>
              {x.canonical}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={busy || !heard.trim()}>
        {t.correction.save}
      </Button>
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
    </form>
  );
}
