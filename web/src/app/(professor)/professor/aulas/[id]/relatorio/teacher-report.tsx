"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LessonReportData } from "@/lib/api/types";
import { getTerm } from "@/lib/terms/pack";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

interface TermRow {
  term_id: string;
  taps: number;
  students: number;
  doubts: number;
  helped: number;
  not_helped: number;
}

const FAST_WPM = 160;
const termName = (id: string) => getTerm(id)?.canonical ?? id;

/** Aggregates only: lesson_reports snapshot + lesson_term_report() + lesson_member_count(). */
export function TeacherReport() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useProfile();
  const [title, setTitle] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState<LessonReportData | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [members, setMembers] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const supabase = getSupabase();
      const { data: lesson } = await supabase
        .from("lessons")
        .select("title,teacher_id")
        .eq("id", id)
        .maybeSingle();
      if (!lesson || lesson.teacher_id !== user.id) {
        setNotFound(true);
        return;
      }
      setTitle(lesson.title as string);
      const [rep, termRep, count] = await Promise.all([
        supabase.from("lesson_reports").select("data").eq("lesson_id", id).maybeSingle(),
        supabase.rpc("lesson_term_report", { p_lesson_id: id, p_min_students: 3 }),
        supabase.rpc("lesson_member_count", { p_lesson_id: id }),
      ]);
      setReport((rep.data?.data as LessonReportData | undefined) ?? null);
      setTerms((termRep.data as TermRow[] | null) ?? []);
      setMembers(typeof count.data === "number" ? count.data : null);
    })();
  }, [id, user, loading]);

  if (notFound) return <p className="p-6">{t.lessons.notFound}</p>;
  if (!title) return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;

  const maxWpm = Math.max(1, ...(report?.pace.map((p) => p.wpm) ?? [1]));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t.report.title(title)}</h1>
        <p className="rounded-lg border p-3 text-sm">{t.report.privacy}</p>
        <nav className="flex gap-4 text-sm">
          <Link className="underline underline-offset-4" href={`/professor/aulas/${id}/revisar`}>
            {t.lessons.reviewMaterials}
          </Link>
          <Link className="underline underline-offset-4" href="/professor">
            {t.review.back}
          </Link>
        </nav>
      </header>

      {!report ? (
        <p>{t.report.noReport}</p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {members !== null && <li className="rounded-lg border p-3">{t.report.students(members)}</li>}
            <li className="rounded-lg border p-3">{t.report.duration(report.duration_minutes)}</li>
            <li className="rounded-lg border p-3">{t.report.avgWpm(report.avg_wpm)}</li>
            <li className="rounded-lg border p-3">{t.report.sentences(report.total_utterances)}</li>
          </ul>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.report.pace}</h2>
            <ol className="space-y-1">
              {report.pace.map((p) => (
                <li key={p.minute} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-mono">{p.minute + 1} min</span>
                  <span
                    aria-label={t.report.paceRow(p.minute, p.wpm)}
                    role="img"
                    className={`h-4 rounded ${p.wpm > FAST_WPM ? "bg-amber-600" : "bg-primary"}`}
                    style={{ width: `${Math.round((p.wpm / maxWpm) * 100)}%` }}
                  />
                  <span className="w-16 shrink-0 text-right font-mono">{p.wpm}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.report.fastest}</h2>
            <p className="text-sm text-muted-foreground">{t.report.fastHint}</p>
            <ul className="list-disc pl-6">
              {report.fastest.map((p) => (
                <li key={p.minute}>{t.report.paceRow(p.minute, p.wpm)}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.report.undefined}</h2>
            <p className="text-sm text-muted-foreground">{t.report.undefinedHint}</p>
            <p>{report.undefined_terms.length ? report.undefined_terms.map(termName).join(", ") : t.report.none}</p>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.report.terms}</h2>
        {terms.length === 0 ? (
          <p>{t.report.noTerms}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">{t.report.termCols.term}</th>
                  <th>{t.report.termCols.taps}</th>
                  <th>{t.report.termCols.students}</th>
                  <th>{t.report.termCols.doubts}</th>
                  <th>{t.report.termCols.helped}</th>
                  <th>{t.report.termCols.notHelped}</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((r) => (
                  <tr key={r.term_id} className="border-b">
                    <td className="py-2 font-mono">{termName(r.term_id)}</td>
                    <td>{r.taps}</td>
                    <td>{r.students}</td>
                    <td>{r.doubts}</td>
                    <td>{r.helped}</td>
                    <td>{r.not_helped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
