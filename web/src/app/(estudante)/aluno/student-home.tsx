"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, Captions, GraduationCap, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { getPlain, plain } from "@/lib/firebase/data";
import { useProfile } from "@/lib/firebase/use-profile";
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
    if (loading || !user || !profile) return;
    void (async () => {
      const db = getDb();
      // Own memberships only (by pseudonym); the rules refuse anything else.
      const snap = await getDocs(
        query(collection(db, "lessonMembers"), where("pseudonym_id", "==", profile.pseudonym_id)),
      ).catch(() => null);
      const rows = (snap?.docs ?? [])
        .map((d) => plain<{ lesson_id: string; joined_at: string | null }>(d))
        .filter((r) => r !== null);
      const found = await Promise.all(
        rows.map(async (r) => {
          const l = await getPlain<Omit<JoinedLesson, "joinedAt">>(doc(db, "lessons", r.lesson_id)).catch(() => null);
          return l ? { ...l, joinedAt: r.joined_at ?? "" } : null;
        }),
      );
      setLessons(
        found.filter((l) => l !== null).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)),
      );
    })();
  }, [loading, user, profile]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:py-10">
      <PageHeader
        title={t.student_area.title}
        description={t.student_area.subtitle}
        actions={<LanguageSelect value={lang} onChange={changeLang} />}
      />
      <section className="surface bg-glow p-5 sm:p-6" aria-labelledby="join-title">
        <JoinForm />
      </section>
      <section className="space-y-4" aria-labelledby="my-lessons">
        <h2 id="my-lessons" className="text-lg font-semibold">
          {t.student_area.lessons}
        </h2>
        {lessons === null && (
          <ul className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="surface h-20 animate-pulse bg-muted/60" />
            ))}
          </ul>
        )}
        {lessons?.length === 0 && (
          <EmptyState icon={GraduationCap} title={t.student_area.lessons}>
            {t.student_area.empty}
          </EmptyState>
        )}
        <ul className="space-y-3">
          {lessons?.map((l) => (
            <li
              key={l.id}
              className={cn(
                "surface flex flex-wrap items-center gap-x-4 gap-y-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]",
                l.status === "ao_vivo" && "ring-2 ring-live/20",
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                {l.status === "encerrada" ? (
                  <BookOpenCheck aria-hidden className="size-5" />
                ) : (
                  <Captions aria-hidden className="size-5" />
                )}
              </span>
              <div className="mr-auto min-w-0 flex-1 basis-40">
                <p className="truncate font-semibold">{l.title}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono">{l.code}</span>
                  {l.joinedAt && <> · {t.student_area.joinedOn(new Date(l.joinedAt))}</>}
                </p>
              </div>
              <StatusPill tone={l.status === "ao_vivo" ? "live" : l.status === "criada" ? "busy" : "idle"}>
                {t.lessons.status[l.status]}
              </StatusPill>
              {l.status === "encerrada" ? (
                <Link className={buttonVariants({ variant: "outline" })} href={`/aula/${l.code}/revisao`}>
                  <ListChecks aria-hidden />
                  {t.student_area.review}
                </Link>
              ) : (
                <Link className={buttonVariants()} href={`/aula/${l.code}`}>
                  {t.student_area.live}
                  <ArrowRight aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
