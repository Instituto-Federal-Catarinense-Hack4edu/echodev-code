"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Captions, ClipboardCheck, QrCode } from "lucide-react";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateLessonCode } from "@/lib/lesson-code";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

const MAX_ATTEMPTS = 5;
const MAX_TITLE = 120;

const NEXT_STEPS = [
  { icon: QrCode, text: t.lessons.nextSteps.code },
  { icon: Captions, text: t.lessons.nextSteps.live },
  { icon: ClipboardCheck, text: t.lessons.nextSteps.end },
];

export function NewLessonForm() {
  const router = useRouter();
  const { user, loading } = useProfile();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (loading) return <LoadingState text={t.common.loading} />;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(false);
    // Retry on the (rare) unique-code collision.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const { data, error: err } = await getSupabase()
        .from("lessons")
        .insert({ teacher_id: user.id, title: title.trim(), code: generateLessonCode() })
        .select("id")
        .single();
      if (!err && data) {
        router.push(`/professor/aulas/${data.id}/ao-vivo`);
        return;
      }
      if (err?.code !== "23505") break;
    }
    setBusy(false);
    setError(true);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="surface space-y-4 p-5 sm:p-6">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="title" className="text-base">
              {t.lessons.formTitle}
            </Label>
            <span className="font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
              {t.lessons.titleCount(title.length, MAX_TITLE)}
            </span>
          </div>
          <Input
            id="title"
            required
            autoFocus
            maxLength={MAX_TITLE}
            placeholder={t.lessons.formPlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 text-lg md:text-lg"
          />
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy || !title.trim()}>
          {busy && <Spinner className="text-current" />}
          {busy ? t.lessons.creating : t.lessons.create}
          {!busy && <ArrowRight aria-hidden />}
        </Button>
        {error && <Notice tone="error">{t.lessons.createError}</Notice>}
      </form>

      <section aria-labelledby="next-steps" className="space-y-3">
        <h2 id="next-steps" className="text-sm font-semibold text-muted-foreground">
          {t.lessons.nextSteps.title}
        </h2>
        <ol className="grid gap-2 sm:grid-cols-3">
          {NEXT_STEPS.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex gap-3 rounded-xl border bg-card/60 p-3.5 text-sm">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <span>
                <span className="sr-only">{i + 1}. </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
