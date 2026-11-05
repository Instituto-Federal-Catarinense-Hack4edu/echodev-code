"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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

  if (state.kind === "loading") return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;
  if (state.kind === "not-member") return <p className="p-6">{t.review.notMember}</p>;

  const spanish = lang === "es";
  const resumo = (spanish && state.resumoEs) || state.resumo;
  const quiz = (spanish && state.quizEs) || state.quiz;
  const fellBack = spanish && ((!!state.resumo && !state.resumoEs) || (!!state.quiz && !state.quizEs));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-6 text-lg">
      <header className="flex flex-wrap items-start gap-3">
        <div className="mr-auto space-y-1">
          <p className="text-sm text-muted-foreground">{t.review.studentTitle}</p>
          <h1 className="text-2xl font-bold">{state.title}</h1>
        </div>
        <LanguageSelect value={lang} onChange={changeLang} />
      </header>
      {fellBack && <p className="text-base text-muted-foreground">{t.review.esFallback}</p>}
      {(!state.resumo || !state.quiz) && (
        <p role="status" className="rounded-lg border p-4">
          {t.review.notApproved}
        </p>
      )}
      {resumo && (
        <PdfButton
          label={t.pdf.download}
          data={{
            lessonTitle: state.title,
            date: state.date,
            resumo,
            lang: resumo === state.resumoEs ? "es" : "pt",
          }}
        />
      )}
      {resumo && (
        <section className="space-y-3" aria-labelledby="resumo-h">
          <h2 id="resumo-h" className="text-xl font-semibold">
            {resumo.titulo}
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            {resumo.topicos.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
          {!!resumo.termos_chave?.length && (
            <p className="text-base text-muted-foreground">{resumo.termos_chave.join(" · ")}</p>
          )}
        </section>
      )}
      {quiz && (
        <section className="space-y-3 rounded-xl border p-4" aria-label={t.review.quiz}>
          <h2 className="text-xl font-semibold">{t.review.quiz}</h2>
          <QuizPlayer key={quiz === state.quizEs ? "es" : "pt"} items={quiz} />
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t.review.aiNotice}</p>
    </main>
  );
}
