"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Languages,
  Link2,
  ListChecks,
  Loader2,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { NotFoundCard } from "@/components/not-found-card";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { ApiError, apiFetch, wakeApi } from "@/lib/api/client";
import type { QuizItem, RegenerateResponse, Resumo } from "@/lib/api/types";
import { cleanResumo, isQuiz, isResumo, lessonDate, validQuiz, validResumo, type LessonDates } from "@/lib/materials";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";
import { createEsTranslator, esAvailability } from "@/lib/translate/browser";
import { translateMaterials } from "@/lib/translate/materials";
import { QuizEditor, ResumoEditor } from "./editors";

type Status = "rascunho" | "aprovado" | "descartado";
interface LessonInfo extends LessonDates {
  title: string;
  code: string;
  status: string;
}
interface Row<C> {
  id: string;
  kind: "resumo" | "quiz" | "resumo_es" | "quiz_es";
  status: Status;
  content: C;
}

export function TeacherReview() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useProfile();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [resumo, setResumo] = useState<Row<Resumo> | null>(null);
  const [quiz, setQuiz] = useState<Row<QuizItem[]> | null>(null);
  const [resumoEs, setResumoEs] = useState<Row<Resumo> | null>(null);
  const [quizEs, setQuizEs] = useState<Row<QuizItem[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: l } = await supabase
      .from("lessons")
      .select("title,code,status,teacher_id,started_at,ended_at,created_at")
      .eq("id", id)
      .maybeSingle();
    if (!l || l.teacher_id !== user?.id) {
      setNotFound(true);
      return;
    }
    setLesson(l);
    const { data } = await supabase.from("lesson_materials").select("id,kind,status,content").eq("lesson_id", id);
    const rows = (data ?? []) as Row<unknown>[];
    const resumoRow = (kind: Row<unknown>["kind"]) => {
      const r = rows.find((x) => x.kind === kind);
      return r && isResumo(r.content) ? (r as Row<Resumo>) : null;
    };
    const quizRow = (kind: Row<unknown>["kind"]) => {
      const q = rows.find((x) => x.kind === kind);
      return q && isQuiz(q.content) ? (q as Row<QuizItem[]>) : null;
    };
    setResumo(resumoRow("resumo"));
    setQuiz(quizRow("quiz"));
    setResumoEs(resumoRow("resumo_es"));
    setQuizEs(quizRow("quiz_es"));
  }, [id, user]);

  useEffect(() => {
    wakeApi();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    if (!loading && user) void load();
  }, [loading, user, load]);

  async function generate() {
    // Regenerating replaces the drafts, including edits that were not saved yet.
    if ((resumo || quiz) && !window.confirm(t.review.regenerateConfirm)) return;
    setBusy(true);
    setError(null);
    setMessage(t.review.generating);
    try {
      await apiFetch<RegenerateResponse>(`/lessons/${id}/materials/regenerate`, {
        method: "POST",
        timeoutMs: 300_000,
      });
      await load();
      setMessage(null);
    } catch (e) {
      setMessage(null);
      setError(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function translateToSpanish() {
    if (!resumo || !quiz) {
      setError(t.review.esNeedsPt);
      return;
    }
    if ((resumoEs || quizEs) && !window.confirm(t.review.esConfirm)) return;
    setBusy(true);
    setError(null);
    setMessage(t.review.esTranslating);
    try {
      const translate = await createEsTranslator();
      const out = await translateMaterials(translate, cleanResumo(resumo.content), quiz.content);
      await storeSpanish("resumo_es", resumoEs, out.resumo);
      await storeSpanish("quiz_es", quizEs, out.quiz);
      await load();
      setMessage(t.review.esDone);
    } catch {
      const a = await esAvailability();
      setMessage(null);
      setError(
        a === "unsupported"
          ? t.teacher.translation.unsupported
          : a === "unavailable"
            ? t.teacher.translation.unavailable
            : t.teacher.translation.error,
      );
    } finally {
      setBusy(false);
    }
  }

  async function storeSpanish(kind: "resumo_es" | "quiz_es", existing: Row<unknown> | null, content: unknown) {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    const { error: err } = existing
      ? await supabase
          .from("lesson_materials")
          .update({ content, status: "rascunho", approved_at: null, updated_at: now })
          .eq("id", existing.id)
      : await supabase.from("lesson_materials").insert({ lesson_id: id, kind, content });
    if (err) throw new Error(err.message);
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

  if (notFound) return <NotFoundCard />;
  if (!lesson) return <LoadingState text={t.common.loading} />;

  const studentUrl = typeof window !== "undefined" ? `${window.location.origin}/aula/${lesson.code}/revisao` : "";
  const hasApproved = resumo?.status === "aprovado" || quiz?.status === "aprovado";
  const nothing = !resumo && !quiz;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        back={{ href: `/professor/aulas/${id}`, label: t.review.backToDashboard }}
        eyebrow={t.dashboard.materials}
        title={t.review.teacherTitle(lesson.title)}
        description={t.review.intro}
      >
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/70 py-1.5 pr-1.5 pl-3.5 text-sm">
          <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-all">{t.review.studentLink(studentUrl)}</span>
          <CopyButton value={studentUrl} label={t.common.copyLink} />
        </div>
      </PageHeader>

      {message && (
        <Notice tone={busy ? "info" : "success"} icon={busy ? Loader2 : undefined} className={busy ? "[&>svg]:animate-spin" : undefined}>
          {message}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {nothing && (
        <section className="surface space-y-4 p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <Sparkles aria-hidden className="size-7" />
          </span>
          {lesson.status === "encerrada" ? (
            <>
              <p className="text-lg font-semibold">{t.review.noMaterials}</p>
              <Button onClick={generate} disabled={busy}>
                {busy ? <Spinner className="text-current" /> : <RefreshCw aria-hidden />}
                {t.review.retry}
              </Button>
            </>
          ) : (
            <>
              {/* Ending happens only on the live screen (stops listening, notifies students). */}
              <p className="text-lg font-semibold">{t.review.notEnded}</p>
              <Link className={buttonVariants()} href={`/professor/aulas/${id}/ao-vivo`}>
                <Radio aria-hidden />
                {t.review.goLive}
              </Link>
            </>
          )}
        </section>
      )}

      {!nothing && (
        <div className="flex flex-wrap items-center gap-2">
          {!hasApproved && (
            <Button variant="outline" onClick={generate} disabled={busy}>
              <RefreshCw aria-hidden />
              {t.review.retry}
            </Button>
          )}
          {resumo && validResumo(cleanResumo(resumo.content)) && (
            <PdfButton
              label={t.pdf.downloadTeacher}
              data={{
                lessonTitle: lesson.title,
                date: lessonDate(lesson),
                resumo: cleanResumo(resumo.content),
                quiz: quiz && validQuiz(quiz.content) ? quiz.content : null,
              }}
            />
          )}
          {hasApproved && <p className="text-sm text-muted-foreground">{t.review.discardFirst}</p>}
        </div>
      )}

      {resumo && (
        <MaterialCard
          icon={FileText}
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
          icon={ListChecks}
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

      {!nothing && (
        <section className="space-y-4 border-t pt-8" aria-labelledby="es-title">
          <div className="surface space-y-3 p-5">
            <SectionTitle icon={Languages} id="es-title">
              {t.review.esTitle}
            </SectionTitle>
            <p className="text-sm text-muted-foreground">{t.review.esIntro}</p>
            <Button variant="outline" onClick={translateToSpanish} disabled={busy || !resumo || !quiz}>
              <Languages aria-hidden />
              {t.review.esTranslate}
            </Button>
          </div>
          {resumoEs && (
            <MaterialCard
              icon={FileText}
              title={t.review.esSummary}
              row={resumoEs}
              busy={busy}
              valid={validResumo(cleanResumo(resumoEs.content))}
              invalidText={t.review.invalidSummary}
              onSave={(status) => save(resumoEs, cleanResumo(resumoEs.content), status)}
            >
              <ResumoEditor value={resumoEs.content} onChange={(content) => setResumoEs({ ...resumoEs, content })} />
            </MaterialCard>
          )}
          {quizEs && (
            <MaterialCard
              icon={ListChecks}
              title={t.review.esQuiz}
              row={quizEs}
              busy={busy}
              valid={validQuiz(quizEs.content)}
              invalidText={t.review.invalidQuiz}
              onSave={(status) => save(quizEs, quizEs.content, status)}
            >
              <QuizEditor value={quizEs.content} onChange={(content) => setQuizEs({ ...quizEs, content })} />
            </MaterialCard>
          )}
        </section>
      )}
    </main>
  );
}

function MaterialCard(props: {
  icon: LucideIcon;
  title: string;
  row: { status: Status };
  busy: boolean;
  valid: boolean;
  invalidText: string;
  onSave: (status: Status) => void;
  children: React.ReactNode;
}) {
  const { icon, title, row, busy, valid, invalidText, onSave, children } = props;
  const variant = row.status === "aprovado" ? "success" : row.status === "rascunho" ? "warning" : "secondary";
  return (
    <section className="surface overflow-hidden" aria-label={title}>
      <div className="border-b bg-muted/30 px-5 py-4">
        <SectionTitle icon={icon} action={<Badge variant={variant}>{t.review.status[row.status]}</Badge>}>
          <span className="text-lg">{title}</span>
        </SectionTitle>
      </div>
      <div className="space-y-4 p-5">
        {children}
        {!valid && <Notice tone="warning">{invalidText}</Notice>}
      </div>
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <Button variant="outline" disabled={busy || !valid} onClick={() => onSave("rascunho")}>
          <Save aria-hidden />
          {t.review.saveDraft}
        </Button>
        <Button disabled={busy || !valid} onClick={() => onSave("aprovado")}>
          <CheckCircle2 aria-hidden />
          {t.review.approve}
        </Button>
        <Button
          variant="destructive"
          className="sm:ml-auto"
          disabled={busy || row.status === "descartado"}
          onClick={() => onSave("descartado")}
        >
          <Trash2 aria-hidden />
          {t.review.discard}
        </Button>
      </div>
    </section>
  );
}
