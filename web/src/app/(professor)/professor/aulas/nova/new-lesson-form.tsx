"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateLessonCode } from "@/lib/lesson-code";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

const MAX_ATTEMPTS = 5;

export function NewLessonForm() {
  const router = useRouter();
  const { user, loading } = useProfile();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (loading) return <p className="text-muted-foreground">{t.common.loading}</p>;

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
    <form onSubmit={create} className="space-y-3">
      <Label htmlFor="title">{t.lessons.formTitle}</Label>
      <Input
        id="title"
        required
        maxLength={120}
        placeholder={t.lessons.formPlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-11"
      />
      <Button type="submit" disabled={busy || !title.trim()}>
        {busy ? t.lessons.creating : t.lessons.create}
      </Button>
      {error && <p className="text-destructive">{t.lessons.createError}</p>}
    </form>
  );
}
