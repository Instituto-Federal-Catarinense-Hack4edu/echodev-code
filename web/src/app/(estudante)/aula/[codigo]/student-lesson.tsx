"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsentFlow, OPTIONAL_PURPOSES, REQUIRED_PURPOSES, type Purpose } from "@/components/consent-flow";
import { StudentView } from "@/components/student-view";
import { SupabaseTransport, utteranceFetcher } from "@/lib/realtime/supabase";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { useLocalPrefs } from "@/lib/use-local-prefs";
import { useDebugFlag } from "@/lib/use-debug-flag";
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
  return { message: t.join.error };
}

export function StudentLesson() {
  const params = useParams<{ codigo: string }>();
  const code = (params.codigo ?? "").toUpperCase();
  const { user, loading } = useProfile();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [prefs, setPrefs] = useLocalPrefs();
  const debug = useDebugFlag();

  const join = useCallback(async () => {
    const supabase = getSupabase();
    setPhase({ kind: "joining" });
    const { data: lessonId, error } = await supabase.rpc("join_lesson", { p_code: code });
    if (error || typeof lessonId !== "string") {
      setPhase({ kind: "error", ...joinErrorMessage(error?.message ?? "") });
      return;
    }
    const { data: lesson } = await supabase.from("lessons").select("title").eq("id", lessonId).single();
    setPhase({ kind: "live", lessonId, title: (lesson?.title as string | undefined) ?? code });
  }, [code]);

  // Consents first (only the missing ones), then join.
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
      depth={prefs.depth}
      lang={prefs.lang}
      literalMode={prefs.literal}
      onDepthChange={(depth) => setPrefs({ depth })}
      onLangChange={(lang) => setPrefs({ lang })}
      debug={debug}
    />
  );
}
