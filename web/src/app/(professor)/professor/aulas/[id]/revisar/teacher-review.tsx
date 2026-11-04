"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/pdf-button";
import { ApiError, apiFetch, wakeApi } from "@/lib/api/client";
import type { QuizItem, RegenerateResponse, Resumo } from "@/lib/api/types";
import { cleanResumo, isQuiz, isResumo, validQuiz, validResumo } from "@/lib/materials";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";
import { QuizEditor, ResumoEditor } from "./editors";

type Status = "rascunho" | "aprovado" | "descartado";
interface Row<C> {
  id: string;
  kind: "resumo" | "quiz";
  status: Status;
  content: C;
}

export function TeacherReview() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useProfile();
  const [lesson, setLesson] = useState<{ title: string; code: string; status: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [resumo, setResumo] = useState<Row<Resumo> | null>(null);
  const [quiz, setQuiz] = useState<Row<QuizItem[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: l } = await supabase.from("lessons").select("title,code,status,teacher_id").eq("id", id).maybeSingle();
    if (!l || l.teacher_id !== user?.id) {
      setNotFound(true);
      return;
    }
    setLesson(l);
    const { data } = await supabase.from("lesson_materials").select("id,kind,status,content").eq("lesson_id", id);
    const rows = (data ?? []) as Row<unknown>[];
    const r = rows.find((x) => x.kind === "resumo");
    const q = rows.find((x) => x.kind === "quiz");
    setResumo(r && isResumo(r.content) ? (r as Row<Resumo>) : null);
    setQuiz(q && isQuiz(q.content) ? (q as Row<QuizItem[]>) : null);
  }, [id, user]);

  useEffect(() => {
    wakeApi();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    if (!loading && user) void load();
  }, [loading, user, load]);

  async function generate() {
    setBusy(true);
    setError(null);
    setMessage(t.review.generating);
    try {
      // /end is idempotent and also works for a lesson ended earlier without materials.
      const path = lesson?.status === "encerrada" ? `/lessons/${id}/materials/regenerate` : `/lessons/${id}/end`;
      await apiFetch<RegenerateResponse>(path, { method: "POST" });
      await load();
      setMessage(null);
    } catch (e) {
      setMessage(null);
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function save<C>(row: Row<C>, content: C, status: Status) {
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: err } = await getSupabase()
      .from("lesson_materials")
      .update({ content, status, approved_at: status === "aprovado" ? now : null, updated_at: now })
      .eq("id", row.id);
    setBusy(false);
    if (err) {
      setError(t.common.error);
      return;
    }
    setMessage(t.review.saved);
    await load();
  }

  if (notFound) return <p className="p-6">{t.lessons.notFound}</p>;
  if (!lesson) return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;

  const studentUrl = typeof window !== "undefined" ? `${window.location.origin}/aula/${lesson.code}/revisao` : "";
  const hasApproved = resumo?.status === "aprovado" || quiz?.status === "aprovado";
  const nothing = !resumo && !quiz;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t.review.teacherTitle(lesson.title)}</h1>
        <p className="text-muted-foreground">{t.review.intro}</p>
        <p className="text-sm">{t.review.studentLink(studentUrl)}</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4" href={`/professor/aulas/${id}/relatorio`}>
            {t.review.report}
          </Link>
          <Link className="underline underline-offset-4" href="/professor">
            {t.review.back}
          </Link>
        </nav>
      </header>

      {message && <p role="status" className="rounded-lg border p-3">{message}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}

      {nothing && (
        <section className="space-y-3 rounded-xl border p-4">
          <p>{lesson.status === "encerrada" ? t.review.noMaterials : t.review.notEnded}</p>
          <Button onClick={generate} disabled={busy}>
            {lesson.status === "encerrada" ? t.review.retry : t.review.generate}
          </Button>
        </section>
      )}
      {!nothing && !hasApproved && (
        <Button variant="outline" onClick={generate} disabled={busy}>
          {t.review.retry}
        </Button>
      )}
      {!nothing && hasApproved && <p className="text-sm text-muted-foreground">{t.review.discardFirst}</p>}
      {resumo && validResumo(cleanResumo(resumo.content)) && (
        <PdfButton
          label={t.pdf.downloadTeacher}
          data={{
            lessonTitle: lesson.title,
            date: new Date(),
            resumo: cleanResumo(resumo.content),
            quiz: quiz && validQuiz(quiz.content) ? quiz.content : null,
          }}
        />
      )}

      {resumo && (
        <MaterialCard
          title={t.review.summary}
          row={resumo}
          busy={busy}
          valid={validResumo(cleanResumo(resumo.content))}
          invalidText={t.review.invalidSummary}
          onSave={(status) => save(resumo, cleanResumo(resumo.content), status)}
        >
          <ResumoEditor value={resumo.content} onChange={(content) => setResumo({ ...resumo, content })} />
        </MaterialCard>
      )}
      {quiz && (
        <MaterialCard
          title={t.review.quiz}
          row={quiz}
          busy={busy}
          valid={validQuiz(quiz.content)}
          invalidText={t.review.invalidQuiz}
          onSave={(status) => save(quiz, quiz.content, status)}
        >
          <QuizEditor value={quiz.content} onChange={(content) => setQuiz({ ...quiz, content })} />
        </MaterialCard>
      )}
    </main>
  );
}

function MaterialCard(props: {
  title: string;
  row: { status: Status };
  busy: boolean;
  valid: boolean;
  invalidText: string;
  onSave: (status: Status) => void;
  children: React.ReactNode;
}) {
  const { title, row, busy, valid, invalidText, onSave, children } = props;
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-label={title}>
      <div className="flex items-center gap-3">
        <h2 className="mr-auto text-xl font-semibold">{title}</h2>
        <Badge variant={row.status === "aprovado" ? "default" : "secondary"}>{t.review.status[row.status]}</Badge>
      </div>
      {children}
      {!valid && <p className="text-sm text-destructive">{invalidText}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy || !valid} onClick={() => onSave("rascunho")}>
          {t.review.saveDraft}
        </Button>
        <Button disabled={busy || !valid} onClick={() => onSave("aprovado")}>
          {t.review.approve}
        </Button>
        <Button variant="destructive" disabled={busy || row.status === "descartado"} onClick={() => onSave("descartado")}>
          {t.review.discard}
        </Button>
      </div>
    </section>
  );
}
