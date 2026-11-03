"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

interface LessonRow {
  id: string;
  title: string;
  code: string;
  status: "criada" | "ao_vivo" | "encerrada";
  created_at: string;
}

export function LessonsList() {
  const { user, profile, loading } = useProfile();
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== "professor") return;
    void getSupabase()
      .from("lessons")
      .select("id,title,code,status,created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLessons((data as LessonRow[]) ?? []));
  }, [user, profile]);

  if (loading) return <p className="text-muted-foreground">{t.common.loading}</p>;
  if (profile?.role !== "professor") return <p>{t.lessons.notTeacher}</p>;

  return (
    <div className="space-y-4">
      <Link href="/professor/aulas/nova" className={buttonVariants()}>
        {t.lessons.new}
      </Link>
      {lessons?.length === 0 && <p className="text-muted-foreground">{t.lessons.empty}</p>}
      <ul className="space-y-3">
        {lessons?.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <div className="mr-auto">
              <p className="font-semibold">{l.title}</p>
              <p className="font-mono text-sm text-muted-foreground">
                {t.lessons.code}: {l.code}
              </p>
            </div>
            <Badge variant={l.status === "ao_vivo" ? "default" : "secondary"}>{t.lessons.status[l.status]}</Badge>
            {l.status !== "encerrada" ? (
              <Link className={buttonVariants({ variant: "outline" })} href={`/professor/aulas/${l.id}/ao-vivo`}>
                {t.lessons.live}
              </Link>
            ) : (
              <>
                <Link className={buttonVariants({ variant: "outline" })} href={`/professor/aulas/${l.id}/revisar`}>
                  {t.lessons.reviewMaterials}
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href={`/professor/aulas/${l.id}/relatorio`}>
                  {t.lessons.report}
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
