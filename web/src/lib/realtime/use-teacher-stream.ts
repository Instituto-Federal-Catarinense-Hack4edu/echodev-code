"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMatcher, type MatchableTerm } from "@/lib/terms/matcher";
import { termsFor } from "@/lib/terms/pack";
import type { SttError, SttProvider, SttStatus } from "@/lib/stt/types";
import { createWpmMeter } from "@/lib/stt/wpm";
import type { UtteranceMessage } from "./schemas";
import type { RealtimeTransport } from "./types";

export interface TeacherStreamOptions {
  transport: RealtimeTransport | null;
  packIds?: string[];
  /** Extra variants (teacher corrections) merged into the dictionary. */
  extraVariants?: Record<string, string[]>;
  /** Persists one sentence (DB). Errors are reported but do not stop the live caption. */
  persist?: (msg: UtteranceMessage) => Promise<void>;
  /** Highest seq already stored for this lesson (reload safety). */
  initialSeq?: number;
}

export function useTeacherStream(opts: TeacherStreamOptions) {
  const { transport, persist, initialSeq = 0 } = opts;
  const [status, setStatus] = useState<SttStatus>("idle");
  const [partial, setPartial] = useState("");
  const [sentences, setSentences] = useState<UtteranceMessage[]>([]);
  const [error, setError] = useState<SttError | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [wpm, setWpm] = useState(0);

  const providerRef = useRef<SttProvider | null>(null);
  const seqRef = useRef(initialSeq);
  const historyRef = useRef<UtteranceMessage[]>([]);
  const meterRef = useRef(createWpmMeter());
  const transportRef = useRef(transport);
  const persistRef = useRef(persist);

  useEffect(() => {
    transportRef.current = transport;
    persistRef.current = persist;
  }, [transport, persist]);

  useEffect(() => {
    if (initialSeq > seqRef.current) seqRef.current = initialSeq;
  }, [initialSeq]);

  const packKey = (opts.packIds ?? []).join(",");
  const extraKey = JSON.stringify(opts.extraVariants ?? {});
  const matcher = useMemo(() => {
    const extra = JSON.parse(extraKey) as Record<string, string[]>;
    const terms: MatchableTerm[] = termsFor(packKey ? packKey.split(",") : undefined).map((term) => ({
      ...term,
      variants: [...term.variants, ...(extra[term.id] ?? [])],
    }));
    return createMatcher(terms);
  }, [packKey, extraKey]);
  const matcherRef = useRef(matcher);
  useEffect(() => {
    matcherRef.current = matcher;
  }, [matcher]);

  const handleFinal = useCallback((raw: string) => {
    const { text, terms } = matcherRef.current.match(raw);
    const now = Date.now();
    const msg: UtteranceMessage = {
      seq: ++seqRef.current,
      text,
      terms,
      wpm: meterRef.current(text, now),
      sentAt: now,
    };
    historyRef.current.push(msg);
    setSentences((s) => [...s, msg]);
    setWpm(msg.wpm);
    void transportRef.current?.publish(msg).catch(() => undefined);
    const p = persistRef.current;
    if (p) {
      p(msg)
        .then(() => setPersistError(null))
        .catch((e: unknown) => setPersistError(e instanceof Error ? e.message : String(e)));
    }
  }, []);

  const start = useCallback(
    (provider: SttProvider) => {
      if (providerRef.current && providerRef.current !== provider) providerRef.current.stop();
      providerRef.current = provider;
      setError(null);
      provider.start({
        onFinal: handleFinal,
        onPartial: setPartial,
        onStatus: setStatus,
        onError: (e) => {
          if (e.fatal) setError(e);
        },
      });
    },
    [handleFinal],
  );

  const pause = useCallback(() => {
    providerRef.current?.stop();
    setPartial("");
    setStatus("stopped");
  }, []);

  // Stop recognition on unmount (also covers StrictMode double-mount).
  useEffect(() => () => providerRef.current?.stop(), []);

  /** Sentences after a seq, for the local demo history server. */
  const historySince = useCallback(
    (afterSeq: number) => historyRef.current.filter((m) => m.seq > afterSeq),
    [],
  );

  return {
    status,
    partial,
    sentences,
    error,
    persistError,
    wpm,
    start,
    pause,
    historySince,
    activeProvider: () => providerRef.current,
  };
}
