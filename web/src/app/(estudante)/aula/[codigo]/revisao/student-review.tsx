"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QuizPlayer } from "@/components/quiz-player";
import type { QuizItem, Resumo } from "@/lib/api/types";
import { isQuiz, isResumo } from "@/lib/materials";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

type State =
  | { kind: "loading" }
  | { kind: "not-member" }
  | { kind: "ready"; title: string; resumo: Resumo | null; quiz: QuizItem[] | null };

/** RLS returns only approved materials to members; drafts never reach this page. */
export function StudentReview() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, loading } = useProfile();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const supabase = getSupabase();
      const { data: lesson } = await supabase
        .from("lessons")
        .select("id,title")
        .eq("code", (codigo ?? "").toUpperCase())
        .maybeSingle();
      if (!lesson) {
        setState({ kind: "not-member" });
        return;
      }
      const { data } = await supabase.from("lesson_materials").select("kind,content").eq("lesson_id", lesson.id);
      const resumo = data?.find((m) => m.kind === "resumo")?.content;
      const quiz = data?.find((m) => m.kind === "quiz")?.content;
      setState({
        kind: "ready",
        title: lesson.title as string,
        resumo: isResumo(resumo) ? resumo : null,
        quiz: isQuiz(quiz) ? quiz : null,
      });
    })();
  }, [loading, user, codigo]);

  if (state.kind === "loading") return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;
  if (state.kind === "not-member") return <p className="p-6">{t.review.notMember}</p>;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-6 text-lg">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{t.review.studentTitle}</p>
        <h1 className="text-2xl font-bold">{state.title}</h1>
      </header>
      {!state.resumo && !state.quiz && <p>{t.review.notApproved}</p>}
      {state.resumo && (
        <section className="space-y-3" aria-labelledby="resumo-h">
          <h2 id="resumo-h" className="text-xl font-semibold">
            {state.resumo.titulo}
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            {state.resumo.topicos.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
          {!!state.resumo.termos_chave?.length && (
            <p className="text-base text-muted-foreground">{state.resumo.termos_chave.join(" · ")}</p>
          )}
        </section>
      )}
      {state.quiz && (
        <section className="space-y-3 rounded-xl border p-4" aria-label={t.review.quiz}>
          <h2 className="text-xl font-semibold">{t.review.quiz}</h2>
          <QuizPlayer items={state.quiz} />
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t.review.aiNotice}</p>
    </main>
  );
}
