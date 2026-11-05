"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Hourglass, ListChecks, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LoadingState, MessageCard, Notice } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { PdfButton } from "@/components/pdf-button";
import { QuizPlayer } from "@/components/quiz-player";
import type { QuizItem, Resumo } from "@/lib/api/types";
import { isQuiz, isResumo, lessonDate } from "@/lib/materials";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { LanguageSelect } from "@/components/language-select";
import { useT } from "@/lib/i18n/context";
import { useProfileLang } from "@/lib/i18n/use-profile-lang";

const APPROVAL_POLL_MS = 15_000;

type State =
  | { kind: "loading" }
  | { kind: "not-member" }
  | {
      kind: "ready";
      title: string;
      date: Date;
      resumo: Resumo | null;
      quiz: QuizItem[] | null;
      resumoEs: Resumo | null;
      quizEs: QuizItem[] | null;
    };

/** RLS returns only approved materials to members; drafts never reach this page. */
export function StudentReview() {
  const t = useT();
  const { codigo } = useParams<{ codigo: string }>();
  const { user, profile, setProfile, loading } = useProfile();
  const [lang, changeLang] = useProfileLang(profile, setProfile);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (loading || !user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const load = async () => {
      const supabase = getSupabase();
      const { data: lesson } = await supabase
        .from("lessons")
        .select("id,title,started_at,ended_at,created_at")
        .eq("code", (codigo ?? "").toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (!lesson) {
        setState({ kind: "not-member" });
        return;
      }
      const { data } = await supabase.from("lesson_materials").select("kind,content").eq("lesson_id", lesson.id);
      if (cancelled) return;
      const content = (kind: string) => data?.find((m) => m.kind === kind)?.content;
      const asResumo = (c: unknown) => (isResumo(c) ? c : null);
      const asQuiz = (c: unknown) => (isQuiz(c) ? c : null);
      const next = {
        kind: "ready" as const,
        title: lesson.title as string,
        date: lessonDate(lesson),
        resumo: asResumo(content("resumo")),
        quiz: asQuiz(content("quiz")),
        resumoEs: asResumo(content("resumo_es")),
        quizEs: asQuiz(content("quiz_es")),
      };
      setState(next);
      if (!next.resumo || !next.quiz) timer = setTimeout(load, APPROVAL_POLL_MS);
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loading, user, codigo]);

  if (state.kind === "loading") return <LoadingState text={t.common.loading} />;
  if (state.kind === "not-member")
    return (
      <MessageCard
        icon={Lock}
        title={t.review.notMember}
        action={
          <Link href="/aluno" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden />
            {t.student_area.title}
          </Link>
        }
      />
    );

  const spanish = lang === "es";
  const resumo = (spanish && state.resumoEs) || state.resumo;
  const quiz = (spanish && state.quizEs) || state.quiz;
  const fellBack = spanish && ((!!state.resumo && !state.resumoEs) || (!!state.quiz && !state.quizEs));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-lg">
      <PageHeader
        back={{ href: "/aluno", label: t.student_area.title }}
        eyebrow={t.review.studentTitle}
        title={state.title}
        description={<span className="text-base">{t.pdf.date(state.date)}</span>}
        actions={<LanguageSelect value={lang} onChange={changeLang} />}
      />
      {fellBack && (
        <Notice tone="info" className="text-base">
          {t.review.esFallback}
        </Notice>
      )}
      {(!state.resumo || !state.quiz) && (
        <div role="status" className="surface flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning">
            <Hourglass aria-hidden className="size-6 motion-safe:animate-pulse" />
          </span>
          <p className="text-base">{t.review.notApproved}</p>
        </div>
      )}
      {resumo && (
        <section className="surface space-y-5 p-5 sm:p-7" aria-labelledby="resumo-h">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mr-auto min-w-0 space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <FileText aria-hidden className="size-4" />
                {t.review.summary} · {t.review.topicsCount(resumo.topicos.length)}
              </p>
              <h2 id="resumo-h" className="text-2xl font-bold tracking-tight">
                {resumo.titulo}
              </h2>
            </div>
            <PdfButton
              label={t.pdf.download}
              data={{
                lessonTitle: state.title,
                date: state.date,
                resumo,
                lang: resumo === state.resumoEs ? "es" : "pt",
              }}
            />
          </div>
          <ol className="space-y-3">
            {resumo.topicos.map((topic, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground">
                  {i + 1}
                </span>
                <span>{topic}</span>
              </li>
            ))}
          </ol>
          {!!resumo.termos_chave?.length && (
            <ul className="flex flex-wrap gap-2 border-t pt-4" aria-label={t.pdf.glossary}>
              {resumo.termos_chave.map((term) => (
                <li key={term} className="rounded-full bg-muted px-3 py-1 font-mono text-sm">
                  {term}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {quiz && (
        <section className="surface space-y-4 p-5 sm:p-7" aria-labelledby="quiz-h">
          <h2 id="quiz-h" className="flex items-center gap-2 text-xl font-bold">
            <ListChecks aria-hidden className="size-5 text-primary" />
            {t.review.quiz}
            <span className="text-sm font-medium text-muted-foreground">· {t.review.questionsCount(quiz.length)}</span>
          </h2>
          <QuizPlayer key={quiz === state.quizEs ? "es" : "pt"} items={quiz} />
        </section>
      )}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles aria-hidden className="size-4" />
        {t.review.aiNotice}
      </p>
    </main>
  );
}
