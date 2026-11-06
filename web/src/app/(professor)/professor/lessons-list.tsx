"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, LayoutDashboard, Plus, Presentation, Radio } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { plain } from "@/lib/firebase/data";
import { useProfile } from "@/lib/firebase/use-profile";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

type Status = "criada" | "ao_vivo" | "encerrada";

interface LessonRow {
  id: string;
  title: string;
  code: string;
  status: Status;
  created_at: string;
}

const FILTERS: (Status | "all")[] = ["all", "ao_vivo", "criada", "encerrada"];

export function LessonsList() {
  const { user, profile, loading } = useProfile();
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");

  useEffect(() => {
    if (!user || profile?.role !== "professor") return;
    const q = query(
      collection(getDb(), "lessons"),
      where("teacher_id", "==", user.id),
      orderBy("created_at", "desc"),
    );
    void getDocs(q)
      .then((snap) => setLessons(snap.docs.map((d) => plain<LessonRow>(d)).filter((l) => l !== null)))
      .catch((e: unknown) => {
        console.warn("[echodev] lessons:", e);
        setLessons([]);
      });
  }, [user, profile]);

  const newButton = (
    <Link href="/professor/aulas/nova" className={buttonVariants({ size: "lg" })}>
      <Plus aria-hidden />
      {t.lessons.new}
    </Link>
  );

  const count = (s: Status | "all") => (lessons ?? []).filter((l) => s === "all" || l.status === s).length;
  const shown = (lessons ?? []).filter((l) => filter === "all" || l.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader title={t.lessons.title} description={t.lessons.subtitle} actions={newButton} />

      {(loading || lessons === null) && (
        <ul className="grid gap-3 md:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="surface h-36 animate-pulse bg-muted/60" />
          ))}
        </ul>
      )}

      {lessons?.length === 0 && (
        <EmptyState icon={Presentation} title={t.lessons.empty} action={newButton}>
          {t.lessons.emptyHint}
        </EmptyState>
      )}

      {!!lessons?.length && (
        <>
          <div role="radiogroup" aria-label={t.lessons.filterLabel} className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                  filter === f
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? t.lessons.filterAll : t.lessons.status[f]}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    filter === f ? "bg-background/20" : "bg-muted",
                  )}
                >
                  {count(f)}
                </span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              {t.lessons.filterEmpty}
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((l) => {
                const live = l.status !== "encerrada";
                return (
                  <li
                    key={l.id}
                    className={cn(
                      "surface group flex flex-col gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)]",
                      l.status === "ao_vivo" && "ring-2 ring-live/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mr-auto min-w-0 space-y-1">
                        <p className="truncate text-lg font-semibold">{l.title}</p>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays aria-hidden className="size-3.5" />
                          {t.lessons.createdOn(new Date(l.created_at))}
                        </p>
                      </div>
                      <StatusPill
                        tone={l.status === "ao_vivo" ? "live" : l.status === "criada" ? "busy" : "idle"}
                      >
                        {t.lessons.status[l.status]}
                      </StatusPill>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
                      <span className="mr-auto inline-flex items-center gap-1 rounded-xl bg-muted py-0.5 pr-0.5 pl-3">
                        <span className="sr-only">{t.lessons.code}:</span>
                        <span className="font-mono text-base font-bold tracking-[0.18em]">{l.code}</span>
                        <CopyButton value={l.code} label={t.common.copyCode(l.code)} />
                      </span>
                      {live ? (
                        <Link className={buttonVariants()} href={`/professor/aulas/${l.id}/ao-vivo`}>
                          <Radio aria-hidden />
                          {t.lessons.live}
                          <ArrowRight aria-hidden />
                        </Link>
                      ) : (
                        <Link className={buttonVariants({ variant: "outline" })} href={`/professor/aulas/${l.id}`}>
                          <LayoutDashboard aria-hidden />
                          {t.dashboard.open}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
