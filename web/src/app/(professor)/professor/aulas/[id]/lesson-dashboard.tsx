"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { LessonReport, type TermRow } from "@/components/lesson-report";
import { PdfButton } from "@/components/pdf-button";
import { QuizPlayer } from "@/components/quiz-player";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { LessonReportData, QuizItem, Resumo } from "@/lib/api/types";
import { isQuiz, isResumo, lessonDate, validQuiz, validResumo, type LessonDates } from "@/lib/materials";
import { getTerm } from "@/lib/terms/pack";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

type MaterialStatus = "rascunho" | "aprovado" | "descartado";

interface Lesson extends LessonDates {
  title: string;
  code: string;
  status: "criada" | "ao_vivo" | "encerrada";
}

interface Data {
  lesson: Lesson;
  members: number | null;
  report: LessonReportData | null;
  terms: TermRow[];
  resumo: { status: MaterialStatus; content: Resumo } | null;
  quiz: { status: MaterialStatus; content: QuizItem[] } | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: MaterialStatus | null }) {
  if (!status) return <Badge variant="outline">{t.dashboard.notGenerated}</Badge>;
  return <Badge variant={status === "aprovado" ? "default" : "secondary"}>{t.review.status[status]}</Badge>;
}

export function LessonDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useProfile();
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data: lesson } = await supabase
      .from("lessons")
      .select("title,code,status,teacher_id,started_at,ended_at,created_at")
      .eq("id", id)
      .maybeSingle();
    if (!lesson || lesson.teacher_id !== user.id) return setNotFound(true);
    const [rep, termRep, count, mats] = await Promise.all([
      supabase.from("lesson_reports").select("data").eq("lesson_id", id).maybeSingle(),
      supabase.rpc("lesson_term_report", { p_lesson_id: id, p_min_students: 3 }),
      supabase.rpc("lesson_member_count", { p_lesson_id: id }),
      supabase.from("lesson_materials").select("kind,status,content").eq("lesson_id", id),
    ]);
    const snapshot = (rep.data?.data as LessonReportData | undefined) ?? null;
    const resumo = mats.data?.find((m) => m.kind === "resumo");
    const quiz = mats.data?.find((m) => m.kind === "quiz");
    setData({
      lesson: lesson as Lesson,
      members: typeof count.data === "number" ? count.data : null,
      report: snapshot && { ...snapshot, undefined_terms: snapshot.undefined_terms.filter((x) => getTerm(x)) },
      terms: ((termRep.data as TermRow[] | null) ?? []).filter((r) => getTerm(r.term_id)),
      resumo: resumo && isResumo(resumo.content) ? { status: resumo.status, content: resumo.content } : null,
      quiz: quiz && isQuiz(quiz.content) ? { status: quiz.status, content: quiz.content } : null,
    });
  }, [id, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    if (!loading) void load();
  }, [loading, load]);

  async function generate() {
    setBusy(true);
    setMessage(t.review.generating);
    try {
      await apiFetch(`/lessons/${id}/materials/regenerate`, { method: "POST", timeoutMs: 300_000 });
      setMessage(null);
      await load();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (notFound) return <p className="p-6">{t.lessons.notFound}</p>;
  if (!data) return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;

  const { lesson, report, resumo, quiz } = data;
  const date = lessonDate(lesson);
  const ended = lesson.status === "encerrada";
  const canPdf = resumo && validResumo(resumo.content);
  const quizOk = quiz && validQuiz(quiz.content);
  const tapsTotal = data.terms.reduce((s, r) => s + r.taps, 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <header className="space-y-2">
        <Link className="text-sm underline underline-offset-4" href="/professor">
          {t.review.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-bold">{lesson.title}</h1>
          <Badge variant={ended ? "secondary" : "default"}>{t.lessons.status[lesson.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.pdf.date(date)} · {t.lessons.code} <span className="font-mono">{lesson.code}</span>
        </p>
      </header>

      {!ended && (
        <section className="space-y-3 rounded-xl border p-4">
          <p>{t.dashboard.notEnded}</p>
          <Link className={buttonVariants()} href={`/professor/aulas/${id}/ao-vivo`}>
            {t.review.goLive}
          </Link>
        </section>
      )}

      <section aria-label={t.dashboard.numbers} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.dashboard.students} value={String(data.members ?? 0)} />
        <Stat label={t.dashboard.duration} value={report ? `${report.duration_minutes} min` : "–"} />
        <Stat label={t.dashboard.sentences} value={report ? String(report.total_utterances) : "–"} />
        <Stat label={t.dashboard.avgPace} value={report ? `${report.avg_wpm} ${t.dashboard.wpmUnit}` : "–"} />
      </section>

      {ended && (
        <section className="space-y-4 rounded-xl border p-4" aria-labelledby="mat-h">
          <h2 id="mat-h" className="text-xl font-semibold">
            {t.dashboard.materials}
          </h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="mr-auto font-medium">{t.review.summary}</span>
              <StatusBadge status={resumo?.status ?? null} />
            </li>
            <li className="flex items-center gap-3">
              <span className="mr-auto font-medium">{t.review.quiz}</span>
              <StatusBadge status={quiz?.status ?? null} />
            </li>
          </ul>
          {resumo?.status !== "aprovado" || quiz?.status !== "aprovado" ? (
            <p className="text-sm text-muted-foreground">{t.dashboard.approveHint}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t.dashboard.approvedHint}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {resumo || quiz ? (
              <Link className={buttonVariants()} href={`/professor/aulas/${id}/revisar`}>
                {t.dashboard.review}
              </Link>
            ) : (
              <Button onClick={generate} disabled={busy}>
                {t.review.retry}
              </Button>
            )}
            {canPdf && (
              <PdfButton
                label={t.pdf.downloadTeacher}
                data={{ lessonTitle: lesson.title, date, resumo: resumo.content, quiz: quizOk ? quiz.content : null }}
              />
            )}
            {quizOk && (
              <Button variant="outline" aria-expanded={showQuiz} onClick={() => setShowQuiz((v) => !v)}>
                {showQuiz ? t.dashboard.hideQuiz : t.dashboard.checkQuiz}
              </Button>
            )}
          </div>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}

          {resumo && (
            <div className="space-y-2 rounded-lg bg-muted/40 p-4">
              <p className="font-semibold">{resumo.content.titulo}</p>
              <ul className="list-disc space-y-1 pl-6">
                {resumo.content.topicos.map((topic, i) => (
                  <li key={i}>{topic}</li>
                ))}
              </ul>
            </div>
          )}

          {showQuiz && quizOk && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{t.dashboard.quizPreview}</p>
              <QuizPlayer items={quiz.content} />
            </div>
          )}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="rep-h">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id="rep-h" className="mr-auto text-xl font-semibold">
            {t.dashboard.report}
          </h2>
          <span className="text-sm text-muted-foreground">{t.dashboard.tapsTotal(tapsTotal)}</span>
        </div>
        <p className="rounded-lg border p-3 text-sm">{t.report.privacy}</p>
        {!report && ended ? <p>{t.report.noReport}</p> : <LessonReport report={report} terms={data.terms} />}
      </section>
    </main>
  );
}
