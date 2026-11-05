"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import { MicTest } from "@/components/mic-test";
import { TermSheet } from "@/components/term-sheet";
import type { Depth, Lang } from "@/lib/terms/schemas";
import { controlPhase, type Source } from "@/lib/stt/control-phase";
import { FakeSttProvider } from "@/lib/stt/fake";
import { WebSpeechProvider } from "@/lib/stt/webspeech";
import type { SttProvider } from "@/lib/stt/types";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import type { RealtimeTransport, TransportStatus } from "@/lib/realtime/types";
import type { PersistFn } from "@/lib/realtime/persist";
import { useTeacherStream } from "@/lib/realtime/use-teacher-stream";
import { useEsTranslation } from "@/lib/translate/use-es-translation";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

/** Chrome restarts recognition at every pause in speech; only a long restart is worth showing. */
const RECONNECT_NOTICE_MS = 4000;
const SLOW_START_MS = 6000;

interface Props {
  transport: RealtimeTransport | null;
  persist?: PersistFn;
  currentMaxSeq?: () => Promise<number>;
  initialSeq?: number;
  packIds?: string[];
  extraVariants?: Record<string, string[]>;
  /** Called once the stream helpers exist (local history server, stop before ending). */
  onReady?: (api: {
    historySince: (afterSeq: number) => UtteranceMessage[];
    stopAndFlush: () => Promise<void>;
  }) => void;
  onFirstStart?: () => void;
}

export function TeacherConsole(props: Props) {
  const translation = useEsTranslation();
  const stream = useTeacherStream({
    translate: translation.translate,
    transport: props.transport,
    persist: props.persist,
    currentMaxSeq: props.currentMaxSeq,
    initialSeq: props.initialSeq,
    packIds: props.packIds,
    extraVariants: props.extraVariants,
  });
  const { status, partial, sentences, error, persistError, wpm, start, pause, historySince, stopAndFlush } =
    stream;
  const { onReady, onFirstStart } = props;

  const [supported, setSupported] = useState(true);
  const [micTesting, setMicTesting] = useState(false);
  const [channel, setChannel] = useState<TransportStatus>("connecting");
  const [source, setSource] = useState<Source | null>(null);
  const [starting, setStarting] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [slowRestart, setSlowRestart] = useState(false);
  const speech = useRef<WebSpeechProvider | null>(null);
  const demo = useRef<FakeSttProvider | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [depth, setDepth] = useState<Depth>("curta");
  const [lang, setLang] = useState<Lang>("pt");

  const phase = controlPhase({ status, error, source, starting, pausedByUser });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    setSupported(new WebSpeechProvider().isSupported());
  }, []);

  useEffect(() => {
    const tr = props.transport;
    if (!tr) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the transport status
    setChannel(tr.status);
    return tr.onStatus(setChannel);
  }, [props.transport]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the provider status
    if (status === "listening" || status === "restarting" || error) setStarting(false);
  }, [status, error]);

  // Permission question not answered after a while: it may be hidden in the address bar.
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => {
    if (phase !== "starting") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when starting ends
      setSlowStart(false);
      return;
    }
    const timer = setTimeout(() => setSlowStart(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (status !== "restarting") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the restart ends
      setSlowRestart(false);
      return;
    }
    const timer = setTimeout(() => setSlowRestart(true), RECONNECT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    onReady?.({ historySince, stopAndFlush });
  }, [onReady, historySince, stopAndFlush]);

  // Scroll only the sentence list (not the whole page) to the newest sentence.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sentences.length]);

  function begin(kind: Source, opts: { restartDemo?: boolean } = {}) {
    let provider: SttProvider;
    if (kind === "mic") {
      speech.current ??= new WebSpeechProvider();
      provider = speech.current;
    } else {
      demo.current ??= new FakeSttProvider();
      if (opts.restartDemo) demo.current.reset();
      provider = demo.current;
    }
    onFirstStart?.();
    setSource(kind);
    setPausedByUser(false);
    setStarting(true);
    start(provider);
  }

  function onPause() {
    setPausedByUser(true);
    setStarting(false);
    pause();
  }

  function onCancelStart() {
    pause();
    setStarting(false);
    setPausedByUser(false);
    setSource(null);
  }

  const errorText = error ? (t.teacher.errors[error.kind] ?? t.teacher.errors.transient) : null;

  const sourceLabel = source === "demo" ? t.teacher.sourceDemo : t.teacher.sourceMic;
  const headline = {
    idle: t.teacher.phase.idle,
    starting: source === "mic" ? t.teacher.phase.startingMic : t.teacher.phase.startingDemo,
    live: t.teacher.phase.live,
    paused: t.teacher.phase.paused,
    finished: t.teacher.phase.finished,
    error: t.teacher.phase.error,
  }[phase];
  const hint = {
    idle: t.teacher.hint.idle,
    starting: source === "mic" ? (slowStart ? t.teacher.hint.startingSlow : t.teacher.hint.startingMic) : null,
    live: slowRestart ? t.teacher.restarting : null,
    paused: t.teacher.hint.paused,
    finished: t.teacher.hint.finished,
    error: errorText,
  }[phase];

  const blocked = micTesting;
  const micDisabled = blocked || !supported;

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <MicTest disabled={phase === "live" || phase === "starting"} onTestingChange={setMicTesting} />

        <section className="space-y-3 rounded-xl border p-4" aria-labelledby="stt-headline">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span
              aria-hidden
              className={cn(
                "inline-block size-3 rounded-full",
                phase === "live" && "bg-red-600 motion-safe:animate-pulse",
                phase === "starting" && "bg-amber-500",
                phase === "error" && "bg-destructive",
                (phase === "idle" || phase === "paused" || phase === "finished") && "bg-muted-foreground",
              )}
            />
            <h2 id="stt-headline" className="font-semibold">
              {headline}
            </h2>
            {source && phase !== "idle" && <Badge variant="outline">{sourceLabel}</Badge>}
            {phase === "live" && <Badge variant="secondary">{t.teacher.wpm(wpm)}</Badge>}
          </div>
          {hint && (
            <p className={cn("text-sm", phase === "error" ? "text-destructive" : "text-muted-foreground")}>
              {hint}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {phase === "idle" && (
              <>
                <Button onClick={() => begin("mic")} disabled={micDisabled}>
                  <Mic aria-hidden />
                  {t.teacher.start}
                </Button>
                <Button variant="outline" onClick={() => begin("demo")} disabled={blocked}>
                  {t.teacher.useDemo}
                </Button>
              </>
            )}

            {phase === "starting" && (
              <>
                <Button disabled>{t.teacher.startingButton}</Button>
                <Button variant="outline" onClick={onCancelStart}>
                  {t.common.cancel}
                </Button>
              </>
            )}

            {phase === "live" && (
              <Button variant="secondary" onClick={onPause}>
                <Pause aria-hidden />
                {t.teacher.pause}
              </Button>
            )}

            {(phase === "paused" || phase === "error") && source && (
              <>
                <Button onClick={() => begin(source)} disabled={source === "mic" ? micDisabled : blocked}>
                  <Play aria-hidden />
                  {phase === "error" ? t.common.retry : t.teacher.resume}
                </Button>
                {source === "mic" ? (
                  <Button variant="outline" onClick={() => begin("demo")} disabled={blocked}>
                    {t.teacher.switchToDemo}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => begin("mic")} disabled={micDisabled}>
                    <Mic aria-hidden />
                    {t.teacher.switchToMic}
                  </Button>
                )}
              </>
            )}

            {phase === "finished" && (
              <>
                <Button onClick={() => begin("demo", { restartDemo: true })} disabled={blocked}>
                  <RotateCcw aria-hidden />
                  {t.teacher.restartDemo}
                </Button>
                <Button variant="outline" onClick={() => begin("mic")} disabled={micDisabled}>
                  <Mic aria-hidden />
                  {t.teacher.switchToMic}
                </Button>
              </>
            )}
          </div>

          {!supported && phase !== "error" && <p className="text-sm text-destructive">{t.teacher.unsupported}</p>}
          {micTesting && <p className="text-sm text-muted-foreground">{t.teacher.waitMicTest}</p>}
          {props.transport && (
            <p
              className={cn("text-sm", channel === "connected" ? "text-muted-foreground" : "font-medium text-amber-700")}
              aria-live="polite"
            >
              {channel === "connected" ? t.teacher.channelOk : t.teacher.channelDown}
            </p>
          )}
          {persistError && <p className="text-sm text-destructive">{t.teacher.persistError(persistError)}</p>}
        </section>

        <TranslationPanel translation={translation} />
      </div>

      <section className="flex max-h-[75dvh] min-h-[50dvh] flex-col rounded-xl border">
        <h2 className="border-b px-4 py-3 font-semibold">{t.teacher.sentencesTitle}</h2>
        <div ref={list} className="flex-1 space-y-2 overflow-y-auto p-4 text-lg">
          {sentences.length === 0 && <p className="text-muted-foreground">{t.teacher.noSentences}</p>}
          {sentences.map((s) => (
            <p key={s.seq}>
              <span className="mr-2 font-mono text-xs text-muted-foreground">#{s.seq}</span>
              <CaptionText text={s.text} terms={s.terms} onTermClick={setOpenTerm} />
              {s.es && (
                <span lang="es" className="mt-0.5 block pl-8 text-base text-muted-foreground">
                  {s.es}
                </span>
              )}
            </p>
          ))}
        </div>
        {partial && (
          <div className="border-t bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t.teacher.partialLabel} </span>
            <span className="italic">{partial}</span>
          </div>
        )}
      </section>

      <TermSheet
        termId={openTerm}
        onClose={() => setOpenTerm(null)}
        depth={depth}
        lang={lang}
        onDepthChange={setDepth}
        onLangChange={setLang}
      />
    </div>
  );
}

function TranslationPanel({ translation }: { translation: ReturnType<typeof useEsTranslation> }) {
  const { state, enable, disable } = translation;
  const tr = t.teacher.translation;
  const status = {
    checking: tr.checking,
    unsupported: tr.unsupported,
    unavailable: tr.unavailable,
    off: null,
    downloading: state.kind === "downloading" ? tr.downloading(state.percent) : null,
    on: tr.on,
    error: tr.error,
  }[state.kind];

  return (
    <section className="space-y-3 rounded-xl border p-4" aria-labelledby="translation-title">
      <h2 id="translation-title" className="font-semibold">
        {tr.title}
      </h2>
      <p className="text-sm text-muted-foreground">{tr.hint}</p>
      {status && (
        <p
          aria-live="polite"
          className={cn("text-sm", state.kind === "on" ? "font-medium text-emerald-700 dark:text-emerald-400" : "")}
        >
          {status}
        </p>
      )}
      {(state.kind === "off" || state.kind === "error") && (
        <Button variant="outline" onClick={() => void enable()}>
          {tr.enable}
        </Button>
      )}
      {state.kind === "on" && (
        <Button variant="ghost" onClick={disable}>
          {tr.disable}
        </Button>
      )}
    </section>
  );
}