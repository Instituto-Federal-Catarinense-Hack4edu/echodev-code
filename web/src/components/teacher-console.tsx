"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Gauge, Languages, Mic, Pause, Play, Radio, RotateCcw, ScrollText, Wifi, WifiOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import { MicTest } from "@/components/mic-test";
import { SectionTitle } from "@/components/page-header";
import { Notice, Spinner } from "@/components/states";
import { StatusPill, type PillTone } from "@/components/status-pill";
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

  const tone: PillTone = {
    idle: "idle",
    starting: "warn",
    live: "live",
    paused: "idle",
    finished: "ok",
    error: "error",
  }[phase] as PillTone;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[23rem_1fr]">
      <div className="space-y-4">
        <section
          className={cn(
            "surface space-y-4 p-5 transition-shadow",
            phase === "live" && "ring-2 ring-live/25",
            phase === "error" && "ring-2 ring-destructive/25",
          )}
          aria-labelledby="stt-headline"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl transition-colors",
                phase === "live" ? "bg-live text-white" : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              {phase === "starting" ? <Spinner className="text-current" /> : <Radio aria-hidden className="size-5" />}
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t.teacher.transcription}
              </p>
              <h2 id="stt-headline" className="leading-tight font-semibold">
                {headline}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={tone}>{phase === "live" ? t.teacher.listening : headline}</StatusPill>
            {source && phase !== "idle" && <Badge variant="outline">{sourceLabel}</Badge>}
            {phase === "live" && (
              <Badge variant="soft">
                <Gauge aria-hidden />
                {t.teacher.wpm(wpm)}
              </Badge>
            )}
          </div>

          {hint &&
            (phase === "error" ? (
              <Notice tone="error">{hint}</Notice>
            ) : (
              <p className="text-sm text-muted-foreground">{hint}</p>
            ))}

          <div className="flex flex-col gap-2">
            {phase === "idle" && (
              <>
                <Button size="lg" onClick={() => begin("mic")} disabled={micDisabled}>
                  <Mic aria-hidden />
                  {t.teacher.start}
                </Button>
                <Button size="lg" variant="outline" onClick={() => begin("demo")} disabled={blocked}>
                  <ScrollText aria-hidden />
                  {t.teacher.useDemo}
                </Button>
              </>
            )}

            {phase === "starting" && (
              <>
                <Button size="lg" disabled>
                  <Spinner className="text-current" />
                  {t.teacher.startingButton}
                </Button>
                <Button variant="outline" onClick={onCancelStart}>
                  <X aria-hidden />
                  {t.common.cancel}
                </Button>
              </>
            )}

            {phase === "live" && (
              <Button size="lg" variant="secondary" onClick={onPause}>
                <Pause aria-hidden />
                {t.teacher.pause}
              </Button>
            )}

            {(phase === "paused" || phase === "error") && source && (
              <>
                <Button size="lg" onClick={() => begin(source)} disabled={source === "mic" ? micDisabled : blocked}>
                  <Play aria-hidden />
                  {phase === "error" ? t.common.retry : t.teacher.resume}
                </Button>
                {source === "mic" ? (
                  <Button variant="outline" onClick={() => begin("demo")} disabled={blocked}>
                    <ScrollText aria-hidden />
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
                <Button size="lg" onClick={() => begin("demo", { restartDemo: true })} disabled={blocked}>
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

          {!supported && phase !== "error" && <Notice tone="warning">{t.teacher.unsupported}</Notice>}
          {micTesting && <p className="text-sm text-muted-foreground">{t.teacher.waitMicTest}</p>}
          {props.transport && (
            <p
              className={cn(
                "flex items-start gap-2 border-t pt-3 text-sm",
                channel === "connected" ? "text-muted-foreground" : "font-medium text-warning",
              )}
              aria-live="polite"
            >
              {channel === "connected" ? (
                <Wifi aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              {channel === "connected" ? t.teacher.channelOk : t.teacher.channelDown}
            </p>
          )}
          {persistError && <Notice tone="error">{t.teacher.persistError(persistError)}</Notice>}
        </section>

        <MicTest disabled={phase === "live" || phase === "starting"} onTestingChange={setMicTesting} />

        <TranslationPanel translation={translation} />
      </div>

      <section
        className="surface flex h-[min(78dvh,52rem)] min-h-[28rem] flex-col overflow-hidden"
        aria-labelledby="sentences-title"
      >
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
          <Captions aria-hidden className="size-5 text-muted-foreground" />
          <h2 id="sentences-title" className="mr-auto font-semibold">
            {t.teacher.sentencesTitle}
          </h2>
          {sentences.length > 0 && <Badge variant="secondary">{t.teacher.sentencesCount(sentences.length)}</Badge>}
          {phase === "live" && <StatusPill tone="live">{t.lessons.live}</StatusPill>}
        </div>
        <div ref={list} className="nice-scroll flex-1 overflow-y-auto px-3 py-3 text-lg">
          {sentences.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <span className="grid size-14 place-items-center rounded-2xl bg-muted">
                {phase === "live" || phase === "starting" ? (
                  <span className="typing-dots text-primary" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <Mic aria-hidden className="size-6" />
                )}
              </span>
              <p className="max-w-xs text-base">{t.teacher.noSentences}</p>
            </div>
          ) : (
            <>
              <p className="px-2 pb-2 text-xs text-muted-foreground">{t.teacher.tapTermHint}</p>
              <ol className="space-y-1">
                {sentences.map((s, i) => (
                  <li
                    key={s.seq}
                    className={cn(
                      "animate-rise flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60",
                      i === sentences.length - 1 && "bg-primary-soft/40",
                    )}
                  >
                    <span className="mt-1.5 h-fit shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground tabular-nums">
                      #{s.seq}
                    </span>
                    <span className="min-w-0 leading-relaxed">
                      <CaptionText text={s.text} terms={s.terms} onTermClick={setOpenTerm} />
                      {s.es && (
                        <span lang="es" className="mt-1 flex items-start gap-1.5 text-base text-muted-foreground">
                          <Languages aria-hidden className="mt-1 size-3.5 shrink-0" />
                          {s.es}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        {partial && (
          <div className="flex items-start gap-3 border-t bg-muted/50 px-5 py-3">
            <span className="typing-dots mt-2 shrink-0 text-xs text-primary" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <p className="min-w-0">
              <span className="text-sm text-muted-foreground">{t.teacher.partialLabel} </span>
              <span className="italic">{partial}</span>
            </p>
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
    <section className="surface space-y-3 p-5" aria-labelledby="translation-title">
      <SectionTitle
        icon={Languages}
        id="translation-title"
        action={state.kind === "on" ? <StatusPill tone="ok">ES</StatusPill> : undefined}
      >
        {tr.title}
      </SectionTitle>
      <p className="text-sm text-muted-foreground">{tr.hint}</p>
      {status && (
        <p
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 text-sm",
            state.kind === "on" && "font-medium text-success",
            (state.kind === "unsupported" || state.kind === "unavailable" || state.kind === "error") && "text-warning",
          )}
        >
          {(state.kind === "checking" || state.kind === "downloading") && <Spinner className="size-4" />}
          {status}
        </p>
      )}
      {state.kind === "downloading" && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${state.percent}%` }} />
        </div>
      )}
      {(state.kind === "off" || state.kind === "error") && (
        <Button variant="outline" className="w-full" onClick={() => void enable()}>
          <Languages aria-hidden />
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
