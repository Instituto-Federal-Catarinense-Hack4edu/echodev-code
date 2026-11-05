"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  ListChecks,
  MessageSquareText,
  PenLine,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { LessonReport, type TermRow } from "@/components/lesson-report";
import { NotFoundCard } from "@/components/not-found-card";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { QuizPlayer } from "@/components/quiz-player";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { LessonReportData, QuizItem, Resumo } from "@/lib/api/types";
import { isQuiz, isResumo, lessonDate, validQuiz, validResumo, type LessonDates } from "@/lib/materials";
import { getTerm } from "@/lib/terms/pack";
import { collection, doc, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { getPlain } from "@/lib/firebase/data";
import { useProfile } from "@/lib/firebase/use-profile";
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

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="surface flex items-center gap-4 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MaterialStatus | null }) {
  if (!status) return <Badge variant="outline">{t.dashboard.notGenerated}</Badge>;
  const variant = status === "aprovado" ? "success" : status === "rascunho" ? "warning" : "secondary";
  return <Badge variant={variant}>{t.review.status[status]}</Badge>;
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
    const db = getDb();
    const lesson = await getPlain<Lesson & { teacher_id: string }>(doc(db, "lessons", id)).catch(() => null);
    if (!lesson || lesson.teacher_id !== user.id) return setNotFound(true);
    // Counts and the term report (minimum 3 students) come from the API: the teacher
    // cannot read memberships or term events.
    const [rep, termRep, count, mats] = await Promise.all([
      getPlain<{ data: LessonReportData }>(doc(db, "lessonReports", id)).catch(() => null),
      apiFetch<TermRow[]>(`/lessons/${id}/term-report`).catch(() => [] as TermRow[]),
      apiFetch<{ count: number }>(`/lessons/${id}/member-count`).catch(() => null),
      getDocs(collection(db, "lessons", id, "materials")).then((s) => s.docs.map((d) => d.data())),
    ]);
    const snapshot = rep?.data ?? null;
    const resumo = mats.find((m) => m.kind === "resumo");
    const quiz = mats.find((m) => m.kind === "quiz");
    setData({
      lesson,
      members: count ? count.count : null,
      report: snapshot && { ...snapshot, undefined_terms: snapshot.undefined_terms.filter((x) => getTerm(x)) },
      terms: termRep.filter((r) => getTerm(r.term_id)),
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

  if (notFound) return <NotFoundCard />;
  if (!data) return <LoadingState text={t.common.loading} />;

  const { lesson, report, resumo, quiz } = data;
  const date = lessonDate(lesson);
  const ended = lesson.status === "encerrada";
  const canPdf = resumo && validResumo(resumo.content);
  const quizOk = quiz && validQuiz(quiz.content);
  const tapsTotal = data.terms.reduce((s, r) => s + r.taps, 0);
  const allApproved = resumo?.status === "aprovado" && quiz?.status === "aprovado";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ href: "/professor", label: t.review.back }}
        eyebrow={t.dashboard.open}
        title={lesson.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4" />
              {t.pdf.date(date)}
            </span>
            <span className="inline-flex items-center gap-1">
              {t.lessons.code} <span className="font-mono font-semibold text-foreground">{lesson.code}</span>
              <CopyButton value={lesson.code} label={t.common.copyCode(lesson.code)} className="size-9 min-h-9 min-w-9" />
            </span>
          </span>
        }
        actions={
          <StatusPill tone={ended ? "idle" : lesson.status === "ao_vivo" ? "live" : "busy"}>
            {t.lessons.status[lesson.status]}
          </StatusPill>
        }
      />

      {!ended && (
        <Notice tone="info" icon={Radio}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto flex-1 basis-64">{t.dashboard.notEnded}</p>
            <Link className={buttonVariants()} href={`/professor/aulas/${id}/ao-vivo`}>
              <Radio aria-hidden />
              {t.review.goLive}
            </Link>
          </div>
        </Notice>
      )}

      <section aria-label={t.dashboard.numbers} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label={t.dashboard.students} value={String(data.members ?? 0)} />
        <Stat icon={Clock} label={t.dashboard.duration} value={report ? `${report.duration_minutes} min` : "–"} />
        <Stat
          icon={MessageSquareText}
          label={t.dashboard.sentences}
          value={report ? String(report.total_utterances) : "–"}
        />
        <Stat
          icon={Gauge}
          label={t.dashboard.avgPace}
          value={report ? `${report.avg_wpm} ${t.dashboard.wpmUnit}` : "–"}
        />
      </section>

      {ended && (
        <section className="surface space-y-5 p-5 sm:p-6" aria-labelledby="mat-h">
          <SectionTitle icon={Sparkles} id="mat-h">
            {t.dashboard.materials}
          </SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <FileText aria-hidden className="size-5 text-muted-foreground" />
              <span className="mr-auto font-medium">{t.review.summary}</span>
              <StatusBadge status={resumo?.status ?? null} />
            </li>
            <li className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <ListChecks aria-hidden className="size-5 text-muted-foreground" />
              <span className="mr-auto font-medium">{t.review.quiz}</span>
              <StatusBadge status={quiz?.status ?? null} />
            </li>
          </ul>
          <Notice tone={allApproved ? "success" : "info"} live={false}>
            {allApproved ? t.dashboard.approvedHint : t.dashboard.approveHint}
          </Notice>

          <div className="flex flex-wrap gap-2">
            {resumo || quiz ? (
              <Link className={buttonVariants()} href={`/professor/aulas/${id}/revisar`}>
                <PenLine aria-hidden />
                {t.dashboard.review}
              </Link>
            ) : (
              <Button onClick={generate} disabled={busy}>
                {busy ? <Spinner className="text-current" /> : <RefreshCw aria-hidden />}
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
                {showQuiz ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                {showQuiz ? t.dashboard.hideQuiz : t.dashboard.checkQuiz}
              </Button>
            )}
          </div>
          {message && <Notice tone={busy ? "info" : "error"}>{message}</Notice>}

          {resumo && (
            <div className="space-y-3 rounded-xl border-l-4 border-primary bg-muted/40 p-4 sm:p-5">
              <p className="text-lg font-semibold">{resumo.content.titulo}</p>
              <ol className="space-y-2">
                {resumo.content.topicos.map((topic, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">
                      {i + 1}
                    </span>
                    <span>{topic}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {showQuiz && quizOk && (
            <div className="animate-rise space-y-4 rounded-xl border p-4 sm:p-5">
              <Notice tone="info" live={false}>
                {t.dashboard.quizPreview}
              </Notice>
              <QuizPlayer items={quiz.content} />
            </div>
          )}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="rep-h">
        <SectionTitle
          icon={BarChart3}
          id="rep-h"
          action={<Badge variant="secondary">{t.dashboard.tapsTotal(tapsTotal)}</Badge>}
        >
          <span className="text-xl">{t.dashboard.report}</span>
        </SectionTitle>
        <Notice tone="success" icon={ShieldCheck} live={false}>
          {t.report.privacy}
        </Notice>
        {!report && ended ? (
          <p className="text-muted-foreground">{t.report.noReport}</p>
        ) : (
          <LessonReport report={report} terms={data.terms} />
        )}
      </section>
    </main>
  );
}
