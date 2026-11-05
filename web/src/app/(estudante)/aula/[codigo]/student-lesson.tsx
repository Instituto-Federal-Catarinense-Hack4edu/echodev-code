"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsentFlow, OPTIONAL_PURPOSES, REQUIRED_PURPOSES, type Purpose } from "@/components/consent-flow";
import { StudentView } from "@/components/student-view";
import { SupabaseTransport, utteranceFetcher } from "@/lib/realtime/supabase";
import { getSupabase } from "@/lib/supabase/client";
import { fire } from "@/lib/supabase/fire";
import type { Depth } from "@/lib/terms/schemas";
import { useProfile, type Profile } from "@/lib/supabase/use-profile";
import { useDebugFlag } from "@/lib/use-debug-flag";

const ENDED_POLL_MS = 30_000;
import { t } from "@/lib/i18n/pt-BR";

type Phase =
  | { kind: "loading" }
  | { kind: "consent"; purposes: Purpose[] }
  | { kind: "joining" }
  | { kind: "live"; lessonId: string; title: string }
  | { kind: "error"; message: string; reviewLink?: boolean };

function joinErrorMessage(message: string): { message: string; reviewLink?: boolean } {
  if (message.includes("invalid_code")) return { message: t.join.invalidCode };
  if (message.includes("lesson_ended")) return { message: t.join.ended, reviewLink: true };
  if (message.includes("teacher_cannot_join")) return { message: t.join.teacherCannotJoin };
  return { message: t.join.error };
}

export function StudentLesson() {
  const params = useParams<{ codigo: string }>();
  const code = (params.codigo ?? "").toUpperCase();
  const { user, profile, setProfile, loading } = useProfile();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const debug = useDebugFlag();
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const updatePrefs = useCallback(
    (patch: Partial<Pick<Profile, "depth_pref" | "lang_pref">>) => {
      if (!profile) return;
      setProfile({ ...profile, ...patch });
      fire(getSupabase().from("profiles").update(patch).eq("user_id", profile.user_id), "save prefs");
    },
    [profile, setProfile],
  );

  const join = useCallback(async () => {
    const supabase = getSupabase();
    setPhase({ kind: "joining" });
    const { data: lessonId, error } = await supabase.rpc("join_lesson", { p_code: code });
    if (error || typeof lessonId !== "string") {
      setPhase({ kind: "error", ...joinErrorMessage(error?.message ?? "") });
      return;
    }
    const { data: lesson } = await supabase.from("lessons").select("title").eq("id", lessonId).single();
    const { data: pseudo } = await supabase.rpc("current_pseudonym");
    setPseudonym(typeof pseudo === "string" ? pseudo : null);
    setPhase({ kind: "live", lessonId, title: (lesson?.title as string | undefined) ?? code });
  }, [code]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await getSupabase()
        .from("consents")
        .select("purpose,revoked_at")
        .eq("user_id", user.id);
      if (cancelled) return;
      const rows = data ?? [];
      const active = new Set(rows.filter((r) => !r.revoked_at).map((r) => r.purpose as Purpose));
      const missing = REQUIRED_PURPOSES.filter((p) => !active.has(p));
      if (missing.length) {
        // Optional purposes are offered only on the very first visit.
        const purposes = rows.length === 0 ? [...missing, ...OPTIONAL_PURPOSES] : missing;
        setPhase({ kind: "consent", purposes });
      } else {
        await join();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, join]);

  const onConsentDone = async (granted: Purpose[]) => {
    if (!user) return;
    if (granted.length) {
      const { error } = await getSupabase()
        .from("consents")
        .insert(granted.map((purpose) => ({ user_id: user.id, purpose })));
      if (error && error.code !== "23505") {
        setPhase({ kind: "error", message: t.common.error });
        return;
      }
    }
    await join();
  };

  const lessonId = phase.kind === "live" ? phase.lessonId : null;
  const [transport, setTransport] = useState<SupabaseTransport | null>(null);
  useEffect(() => {
    if (!lessonId) return;
    const tr = new SupabaseTransport(getSupabase(), lessonId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- channel lives only in the browser
    setTransport(tr);
    return () => tr.close();
  }, [lessonId]);
  const fetchSince = useMemo(() => (lessonId ? utteranceFetcher(getSupabase(), lessonId) : null), [lessonId]);

  // Lesson end: instant signal on the channel, plus a status check on every (re)connection
  // and a slow poll, so a student who missed the signal still gets the button.
  useEffect(() => {
    if (!transport || !lessonId) return;
    const check = async () => {
      const { data } = await getSupabase().from("lessons").select("status").eq("id", lessonId).maybeSingle();
      if (data?.status === "encerrada") setEnded(true);
    };
    const offControl = transport.onControl((m) => {
      if (m.type === "lesson_ended") setEnded(true);
    });
    const offStatus = transport.onStatus((s) => {
      if (s === "connected") void check();
    });
    void check();
    const timer = setInterval(check, ENDED_POLL_MS);
    return () => {
      offControl();
      offStatus();
      clearInterval(timer);
    };
  }, [transport, lessonId]);

  /** Anonymous term event (own pseudonym only; nobody can read these rows back). */
  const logEvent = useCallback(
    (termId: string, kind: "tap" | "doubt" | "helped" | "not_helped", depth: Depth) => {
      if (!lessonId || !pseudonym) return;
      fire(
        getSupabase()
          .from("term_events")
          .insert({ lesson_id: lessonId, pseudonym_id: pseudonym, term_id: termId, kind, depth }),
        "term event",
      );
    },
    [lessonId, pseudonym],
  );

  if (phase.kind === "consent") return <ConsentFlow purposes={phase.purposes} onDone={onConsentDone} />;
  if (phase.kind === "error")
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-lg">{phase.message}</p>
        {phase.reviewLink && (
          <Link className="underline underline-offset-4" href={`/aula/${code}/revisao`}>
            {t.join.review}
          </Link>
        )}
      </main>
    );
  if (phase.kind !== "live")
    return <p className="p-6 text-muted-foreground">{phase.kind === "joining" ? t.join.joining : t.common.loading}</p>;

  return (
    <StudentView
      transport={transport}
      fetchSince={fetchSince}
      title={phase.title}
      depth={profile?.depth_pref ?? "curta"}
      lang={profile?.lang_pref ?? "pt"}
      onDepthChange={(depth_pref) => updatePrefs({ depth_pref })}
      onLangChange={(lang_pref) => updatePrefs({ lang_pref })}
      onTermOpen={(termId, depth) => logEvent(termId, "tap", depth)}
      onFeedback={(termId, kind, depth) => logEvent(termId, kind, depth)}
      reviewHref={ended ? `/aula/${code}/revisao` : null}
      debug={debug}
      headerExtra={
        <Link href="/conta" className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">
          {t.student.account}
        </Link>
      }
    />
  );
}
