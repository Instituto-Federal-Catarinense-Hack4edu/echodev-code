"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import { MicTest } from "@/components/mic-test";
import { FakeSttProvider } from "@/lib/stt/fake";
import { WebSpeechProvider } from "@/lib/stt/webspeech";
import type { SttProvider } from "@/lib/stt/types";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import type { RealtimeTransport, TransportStatus } from "@/lib/realtime/types";
import type { PersistFn } from "@/lib/realtime/persist";
import { useTeacherStream } from "@/lib/realtime/use-teacher-stream";
import { t } from "@/lib/i18n/pt-BR";

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
  /** Called when the first sentence of a session is about to be sent (lesson goes live). */
  onFirstStart?: () => void;
  /** Rendered when the teacher clicks a term in the sent list (e.g., correction form). */
  renderTermAction?: (termId: string, sentence: UtteranceMessage) => React.ReactNode;
}

export function TeacherConsole(props: Props) {
  const stream = useTeacherStream({
    transport: props.transport,
    persist: props.persist,
    currentMaxSeq: props.currentMaxSeq,
    initialSeq: props.initialSeq,
    packIds: props.packIds,
    extraVariants: props.extraVariants,
  });
  const { status, partial, sentences, error, persistError, wpm, start, pause, historySince, stopAndFlush } =
    stream;
  const [supported, setSupported] = useState(true);
  const [micTesting, setMicTesting] = useState(false);
  const [channel, setChannel] = useState<TransportStatus>("connecting");

  // Show the teacher whether students can actually receive the caption.
  useEffect(() => {
    const tr = props.transport;
    if (!tr) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the transport status
    setChannel(tr.status);
    return tr.onStatus(setChannel);
  }, [props.transport]);
  const [mode, setMode] = useState<"none" | "speech" | "demo">("none");
  const speech = useRef<WebSpeechProvider | null>(null);
  const demo = useRef<FakeSttProvider | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ termId: string; seq: number } | null>(null);
  const { onReady, onFirstStart } = props;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    setSupported(new WebSpeechProvider().isSupported());
  }, []);

  useEffect(() => {
    onReady?.({ historySince, stopAndFlush });
  }, [onReady, historySince, stopAndFlush]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [sentences.length]);

  const begin = (kind: "speech" | "demo") => {
    let provider: SttProvider;
    if (kind === "speech") {
      speech.current ??= new WebSpeechProvider();
      provider = speech.current;
    } else {
      demo.current ??= new FakeSttProvider();
      provider = demo.current;
    }
    onFirstStart?.();
    setMode(kind);
    start(provider);
  };

  const running = status === "listening" || status === "restarting";
  const statusLabel =
    status === "listening"
      ? t.teacher.active
      : status === "restarting"
        ? t.teacher.restarting
        : mode !== "none"
          ? t.teacher.paused
          : t.teacher.idle;

  const errorText =
    error?.kind === "permission"
      ? t.teacher.permissionDenied
      : error?.kind === "too-many-errors"
        ? t.teacher.tooManyErrors
        : error?.kind === "unsupported"
          ? t.teacher.unsupported
          : null;

  const selectedSentence = selected ? sentences.find((s) => s.seq === selected.seq) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <MicTest disabled={running} onTestingChange={setMicTesting} />
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span
              className={`inline-block size-3 rounded-full ${running ? "bg-red-600 motion-safe:animate-pulse" : "bg-muted-foreground"}`}
              aria-hidden
            />
            <span className="font-semibold">{statusLabel}</span>
            {running && <Badge variant="secondary">{t.teacher.wpm(wpm)}</Badge>}
          </div>
          {props.transport && (
            <p
              className={`text-sm ${channel === "connected" ? "text-muted-foreground" : "font-medium text-amber-700"}`}
              aria-live="polite"
            >
              {channel === "connected" ? t.teacher.channelOk : t.teacher.channelDown}
            </p>
          )}
          {!supported && <p className="text-sm text-destructive">{t.teacher.unsupported}</p>}
          {errorText && <p className="text-sm text-destructive">{errorText}</p>}
          {persistError && <p className="text-sm text-destructive">{t.teacher.persistError(persistError)}</p>}
          {micTesting && <p className="text-sm text-muted-foreground">{t.teacher.waitMicTest}</p>}
          <div className="flex flex-wrap gap-2">
            {!running && (
              <Button
                onClick={() => begin(mode === "demo" ? "demo" : "speech")}
                disabled={micTesting || (!supported && mode !== "demo")}
              >
                {mode === "none" ? t.teacher.start : t.teacher.resume}
              </Button>
            )}
            {running && (
              <Button variant="secondary" onClick={pause}>
                {t.teacher.pause}
              </Button>
            )}
            {mode !== "speech" && !running && (
              <Button variant="outline" onClick={() => begin("demo")} disabled={micTesting}>
                {t.teacher.useDemo}
              </Button>
            )}
          </div>
        </section>
      </div>

      <section className="flex min-h-[50dvh] flex-col rounded-xl border">
        <h2 className="border-b px-4 py-3 font-semibold">{t.teacher.sentencesTitle}</h2>
        <div className="flex-1 space-y-2 overflow-y-auto p-4 text-lg">
          {sentences.length === 0 && <p className="text-muted-foreground">{t.teacher.noSentences}</p>}
          {sentences.map((s) => (
            <p key={s.seq}>
              <span className="mr-2 font-mono text-xs text-muted-foreground">#{s.seq}</span>
              <CaptionText
                text={s.text}
                terms={s.terms}
                onTermClick={
                  props.renderTermAction ? (termId) => setSelected({ termId, seq: s.seq }) : undefined
                }
              />
            </p>
          ))}
          <div ref={listEnd} />
        </div>
        {selected && selectedSentence && props.renderTermAction && (
          <div className="border-t p-4">{props.renderTermAction(selected.termId, selectedSentence)}</div>
        )}
        {partial && (
          <div className="border-t bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t.teacher.partialLabel} </span>
            <span className="italic">{partial}</span>
          </div>
        )}
      </section>
    </div>
  );
}
