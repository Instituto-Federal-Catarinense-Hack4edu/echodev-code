"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { useT } from "@/lib/i18n/context";
import { useProfileLang } from "@/lib/i18n/use-profile-lang";
import { LanguageSelect } from "@/components/language-select";
import { JoinForm } from "@/app/join-form";

interface JoinedLesson {
  id: string;
  title: string;
  code: string;
  status: "criada" | "ao_vivo" | "encerrada";
  joinedAt: string;
}

export function StudentHome() {
  const t = useT();
  const { user, profile, setProfile, loading } = useProfile();
  const [lang, changeLang] = useProfileLang(profile, setProfile);
  const [lessons, setLessons] = useState<JoinedLesson[] | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const supabase = getSupabase();
      const { data: rows } = await supabase
        .from("lesson_members")
        .select("lesson_id,joined_at")
        .order("joined_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.lesson_id as string);
      if (!ids.length) return setLessons([]);
      const { data } = await supabase.from("lessons").select("id,title,code,status").in("id", ids);
      const joined = new Map((rows ?? []).map((r) => [r.lesson_id as string, r.joined_at as string]));
      setLessons(
        (data ?? [])
          .map((l) => ({ ...(l as Omit<JoinedLesson, "joinedAt">), joinedAt: joined.get(l.id as string) ?? "" }))
          .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)),
      );
    })();
  }, [loading, user]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t.student_area.title}</h1>
        <LanguageSelect value={lang} onChange={changeLang} />
      </div>
      <section className="rounded-xl border p-4">
        <JoinForm />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.student_area.lessons}</h2>
        {lessons === null && <p className="text-muted-foreground">{t.common.loading}</p>}
        {lessons?.length === 0 && <p className="text-muted-foreground">{t.student_area.empty}</p>}
        <ul className="space-y-3">
          {lessons?.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
              <div className="mr-auto">
                <p className="font-semibold">{l.title}</p>
                <p className="font-mono text-sm text-muted-foreground">{l.code}</p>
              </div>
              <Badge variant={l.status === "ao_vivo" ? "default" : "secondary"}>{t.lessons.status[l.status]}</Badge>
              {l.status === "encerrada" ? (
                <Link className={buttonVariants({ variant: "outline" })} href={`/aula/${l.code}/revisao`}>
                  {t.student_area.review}
                </Link>
              ) : (
                <Link className={buttonVariants()} href={`/aula/${l.code}`}>
                  {t.student_area.live}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
