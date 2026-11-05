"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, LayoutDashboard, QrCode, Square, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";
import { NotFoundCard } from "@/components/not-found-card";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { TeacherConsole } from "@/components/teacher-console";
import { TermCorrection, loadCorrections, type Corrections } from "@/components/term-correction";
import { ApiError, apiFetch, wakeApi } from "@/lib/api/client";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FirestoreTransport, maxSeq, persistUtterance } from "@/lib/realtime/firestore";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { getDb } from "@/lib/firebase/client";
import { getPlain } from "@/lib/firebase/data";
import { fire } from "@/lib/firebase/fire";
import { useProfile } from "@/lib/firebase/use-profile";
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
  const [transport, setTransport] = useState<FirestoreTransport | null>(null);
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
    const db = getDb();
    void (async () => {
      const data = await getPlain<Lesson & { teacher_id: string }>(doc(db, "lessons", id)).catch(() => null);
      if (!data || data.teacher_id !== user.id) {
        setNotFound(true);
        return;
      }
      setLesson(data);
      setInitialSeq(await maxSeq(db, id));
    })();
  }, [id, user, loading]);

  // Depend on the id and "ended" flag only: going live must not reopen the channel.
  const liveLessonId = lesson && lesson.status !== "encerrada" ? lesson.id : null;
  useEffect(() => {
    if (!liveLessonId) return;
    const tr = new FirestoreTransport(getDb(), liveLessonId, { listenUtterances: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- channel lives only in the browser
    setTransport(tr);
    return () => tr.close();
  }, [liveLessonId]);

  const lessonId = lesson?.id ?? null;
  useEffect(() => {
    if (!lessonId) return;
    // Counted by the API: the teacher cannot read memberships (they hold pseudonyms).
    const tick = async () => {
      const r = await apiFetch<{ count: number }>(`/lessons/${lessonId}/member-count`).catch(() => null);
      if (r) setMembers(r.count);
    };
    void tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [lessonId]);

  const persist = useCallback(
    (msg: UtteranceMessage) => persistUtterance(getDb(), id, msg),
    [id],
  );
  const currentMaxSeq = useCallback(() => maxSeq(getDb(), id), [id]);
  const streamApi = useRef<{ stopAndFlush: () => Promise<void> } | null>(null);
  const onReady = useCallback((api: { stopAndFlush: () => Promise<void> }) => {
    streamApi.current = api;
  }, []);

  const goLive = useCallback(() => {
    if (!lesson || lesson.status !== "criada") return;
    setLesson({ ...lesson, status: "ao_vivo" });
    fire(
      updateDoc(doc(getDb(), "lessons", lesson.id), { status: "ao_vivo", started_at: serverTimestamp() }),
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
      const data = await getPlain<{ status: string }>(doc(getDb(), "lessons", lesson.id)).catch(() => null);
      if (data?.status !== "encerrada") {
        setEnding(false);
        setEndError(e instanceof ApiError ? t.lessons.endError(e.message) : t.common.error);
        return;
      }
    }
    // Students see the "encerrada" status through their lesson listener right away.
    await transport?.publishControl({ type: "lesson_ended", at: Date.now() }).catch(() => undefined);
    router.push(`/professor/aulas/${lesson.id}`);
  }

  const joinUrl = useMemo(
    () => (lesson && typeof window !== "undefined" ? `${window.location.origin}/aula/${lesson.code}` : ""),
    [lesson],
  );

  // "localhost" only works on this computer: a phone scanning the QR would get nothing.
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(joinUrl);

  if (notFound) return <NotFoundCard />;
  if (!lesson || initialSeq === null) return <LoadingState text={t.common.loading} />;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <header className="surface flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <div className="mr-auto min-w-0 space-y-1.5">
          <Link
            href="/professor"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {t.lessons.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{lesson.title}</h1>
            <StatusPill tone={lesson.status === "ao_vivo" ? "live" : lesson.status === "encerrada" ? "idle" : "busy"}>
              {t.lessons.status[lesson.status]}
            </StatusPill>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border bg-muted/60 py-1 pr-1 pl-4">
          <span className="sr-only">{t.lessons.code}</span>
          <span className="font-mono text-2xl font-bold tracking-[0.2em]">{lesson.code}</span>
          <CopyButton value={lesson.code} label={t.common.copyCode(lesson.code)} />
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-semibold">
          <Users aria-hidden className="size-4 text-muted-foreground" />
          <span aria-live="polite">{t.teacher.studentsConnected(members)}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setQrOpen(true)}>
            <QrCode aria-hidden />
            {t.lessons.showQr}
          </Button>
          {lesson.status !== "encerrada" ? (
            <Button variant="destructive" onClick={endLesson} disabled={ending}>
              {ending ? <Spinner className="text-current" /> : <Square aria-hidden />}
              {ending ? t.lessons.ending : t.teacher.end}
            </Button>
          ) : (
            <Link className={buttonVariants()} href={`/professor/aulas/${lesson.id}`}>
              <LayoutDashboard aria-hidden />
              {t.dashboard.open}
            </Link>
          )}
        </div>
      </header>
      {endError && <Notice tone="error">{endError}</Notice>}
      {lesson.status === "encerrada" ? (
        <Notice tone="success">{t.lessons.ended}</Notice>
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
        <DialogContent className="max-h-[95dvh] max-w-[min(95vw,48rem)] items-center gap-5 overflow-y-auto rounded-3xl p-8 text-center sm:max-w-[min(95vw,48rem)]">
          <DialogTitle className="text-3xl leading-tight font-bold">{lesson.title}</DialogTitle>
          <div className="mx-auto w-full max-w-[min(60vh,30rem)] rounded-3xl bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-black/5">
            <QRCodeSVG value={joinUrl} size={512} className="h-auto w-full" level="M" />
          </div>
          <p className="font-mono text-6xl font-bold tracking-[0.3em] text-primary">{lesson.code}</p>
          <p className="text-lg text-muted-foreground">{t.lessons.qrHint(joinUrl.replace(/\/aula\/.*/, ""))}</p>
          {isLocalOrigin && <Notice tone="warning" className="text-left text-base">{t.lessons.qrLocalWarning}</Notice>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
