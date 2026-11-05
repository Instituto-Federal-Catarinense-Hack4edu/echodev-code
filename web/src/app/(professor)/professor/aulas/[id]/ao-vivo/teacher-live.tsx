"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TeacherConsole } from "@/components/teacher-console";
import { TermCorrection, loadCorrections, type Corrections } from "@/components/term-correction";
import { ApiError, apiFetch, wakeApi } from "@/lib/api/client";
import { SupabaseTransport, maxSeq, persistUtterance } from "@/lib/realtime/supabase";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { fire } from "@/lib/supabase/fire";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

/** Long lessons are summarized in several LLM calls; give the API time before giving up. */
const END_TIMEOUT_MS = 300_000;

interface Lesson {
  id: string;
  title: string;
  code: string;
  status: "criada" | "ao_vivo" | "encerrada";
  pack_ids: string[];
}

export function TeacherLive() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useProfile();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [initialSeq, setInitialSeq] = useState<number | null>(null);
  const [members, setMembers] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [transport, setTransport] = useState<SupabaseTransport | null>(null);
  const [corrections, setCorrections] = useState<Corrections>({});

  useEffect(() => {
    // Free hosts sleep after ~15 min idle; keep the API awake so "end" is fast later.
    wakeApi();
    const keepAwake = setInterval(wakeApi, 5 * 60_000);
    return () => clearInterval(keepAwake);
  }, []);

  const packKey = lesson?.pack_ids.join(",") ?? null;
  useEffect(() => {
    if (packKey === null) return;
    void loadCorrections(packKey ? packKey.split(",") : undefined).then(setCorrections);
  }, [packKey]);

  const addCorrection = useCallback((termId: string, heard: string) => {
    setCorrections((c) => ({ ...c, [termId]: [...(c[termId] ?? []), heard] }));
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const supabase = getSupabase();
    void (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id,title,code,status,pack_ids")
        .eq("id", id)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (!data) {
        setNotFound(true);
        return;
      }
      setLesson(data as Lesson);
      setInitialSeq(await maxSeq(supabase, id));
    })();
  }, [id, user, loading]);

  // Depend on the id and "ended" flag only: going live must not reopen the channel.
  const liveLessonId = lesson && lesson.status !== "encerrada" ? lesson.id : null;
  useEffect(() => {
    if (!liveLessonId) return;
    const tr = new SupabaseTransport(getSupabase(), liveLessonId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- channel lives only in the browser
    setTransport(tr);
    return () => tr.close();
  }, [liveLessonId]);

  const lessonId = lesson?.id ?? null;
  useEffect(() => {
    if (!lessonId) return;
    const supabase = getSupabase();
    const tick = async () => {
      const { data } = await supabase.rpc("lesson_member_count", { p_lesson_id: lessonId });
      if (typeof data === "number") setMembers(data);
    };
    void tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [lessonId]);

  const persist = useCallback(
    (msg: UtteranceMessage) => persistUtterance(getSupabase(), id, msg),
    [id],
  );
  const currentMaxSeq = useCallback(() => maxSeq(getSupabase(), id), [id]);
  const streamApi = useRef<{ stopAndFlush: () => Promise<void> } | null>(null);
  const onReady = useCallback((api: { stopAndFlush: () => Promise<void> }) => {
    streamApi.current = api;
  }, []);

  const goLive = useCallback(() => {
    if (!lesson || lesson.status !== "criada") return;
    setLesson({ ...lesson, status: "ao_vivo" });
    fire(
      getSupabase()
        .from("lessons")
        .update({ status: "ao_vivo", started_at: new Date().toISOString() })
        .eq("id", lesson.id),
      "lesson live",
    );
  }, [lesson]);

  async function endLesson() {
    if (!lesson || !window.confirm(t.lessons.endConfirm)) return;
    setEnding(true);
    setEndError(null);
    // Stop listening and wait for pending sentences, so nothing lands after the summary.
    await streamApi.current?.stopAndFlush();
    try {
      await apiFetch(`/lessons/${lesson.id}/end`, { method: "POST", timeoutMs: END_TIMEOUT_MS });
    } catch (e) {
      // 502 (LLM failed) or a timeout still leave the lesson ended on the server: trust the
      // real status, not the error.
      const { data } = await getSupabase().from("lessons").select("status").eq("id", lesson.id).maybeSingle();
      if (data?.status !== "encerrada") {
        setEnding(false);
        setEndError(e instanceof ApiError ? t.lessons.endError(e.message) : t.common.error);
        return;
      }
    }
    // Tell connected students right away (they also re-check the status on reconnect).
    await transport?.publishControl({ type: "lesson_ended", at: Date.now() }).catch(() => undefined);
    router.push(`/professor/aulas/${lesson.id}`);
  }

  const joinUrl = useMemo(
    () => (lesson && typeof window !== "undefined" ? `${window.location.origin}/aula/${lesson.code}` : ""),
    [lesson],
  );

  // "localhost" only works on this computer: a phone scanning the QR would get nothing.
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(joinUrl);

  if (notFound) return <p className="p-6">{t.lessons.notFound}</p>;
  if (!lesson || initialSeq === null) return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{lesson.title}</h1>
        <span className="font-mono text-2xl tracking-widest" aria-label={t.lessons.code}>
          {lesson.code}
        </span>
        <Badge variant="secondary">{t.teacher.studentsConnected(members)}</Badge>
        <Button variant="outline" onClick={() => setQrOpen(true)}>
          {t.lessons.showQr}
        </Button>
        {lesson.status !== "encerrada" ? (
          <Button variant="destructive" onClick={endLesson} disabled={ending}>
            {ending ? t.lessons.ending : t.teacher.end}
          </Button>
        ) : (
          <Link className="underline underline-offset-4" href={`/professor/aulas/${lesson.id}`}>
            {t.dashboard.open}
          </Link>
        )}
      </header>
      {endError && <p className="text-destructive">{endError}</p>}
      {lesson.status === "encerrada" ? (
        <p>{t.lessons.ended}</p>
      ) : (
        <>
          <TeacherConsole
            transport={transport}
            persist={persist}
            currentMaxSeq={currentMaxSeq}
            onReady={onReady}
            initialSeq={initialSeq}
            packIds={lesson.pack_ids}
            extraVariants={corrections}
            onFirstStart={goLive}
          />
          <TermCorrection packIds={lesson.pack_ids} onSaved={addCorrection} />
        </>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[min(95vw,48rem)] items-center p-8 text-center">
          <DialogTitle className="text-3xl">{lesson.title}</DialogTitle>
          <div className="mx-auto w-full max-w-[min(70vh,32rem)] bg-white p-4">
            <QRCodeSVG value={joinUrl} size={512} className="h-auto w-full" level="M" />
          </div>
          <p className="font-mono text-6xl font-bold tracking-[0.3em]">{lesson.code}</p>
          <p className="text-lg">{t.lessons.qrHint(joinUrl.replace(/\/aula\/.*/, ""))}</p>
          {isLocalOrigin && <p className="text-base font-medium text-amber-700">{t.lessons.qrLocalWarning}</p>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
