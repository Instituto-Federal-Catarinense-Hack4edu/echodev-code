"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMatcher, type MatchableTerm } from "@/lib/terms/matcher";
import { termsFor } from "@/lib/terms/pack";
import type { SttError, SttProvider, SttStatus } from "@/lib/stt/types";
import { createWpmMeter } from "@/lib/stt/wpm";
import { censor } from "@/lib/text/profanity";
import { translateKeepingTerms } from "@/lib/translate/keep-terms";
import { persistWithRenumber, type PersistFn } from "./persist";
import type { TermSpan, UtteranceMessage } from "./schemas";
import type { RealtimeTransport } from "./types";

export interface TeacherStreamOptions {
  transport: RealtimeTransport | null;
  packIds?: string[];
  /** Extra variants (teacher corrections) merged into the dictionary. */
  extraVariants?: Record<string, string[]>;
  /**
   * Persists one sentence (DB) before it is published. "duplicate" means the seq is already
   * taken (e.g. a second teacher tab); the stream then renumbers and retries.
   */
  persist?: PersistFn;
  currentMaxSeq?: () => Promise<number>;
  /** Highest seq already stored for this lesson (reload safety). */
  initialSeq?: number;
  /** Translates each sentence to Spanish; a failure only drops the translation. */
  translate?: ((text: string) => Promise<string>) | null;
}

async function translateText(
  translate: ((text: string) => Promise<string>) | null,
  text: string,
  terms: TermSpan[],
): Promise<string | undefined> {
  if (!translate || !text.trim()) return undefined;
  try {
    // Jargon ("commit", "push") stays as spoken instead of becoming "confirmación", "empujar".
    const es = (await translateKeepingTerms(translate, text, terms)).trim();
    return es ? censor(es).text.slice(0, 5000) : undefined;
  } catch {
    return undefined;
  }
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
  const maxSeqRef = useRef(opts.currentMaxSeq);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const translateRef = useRef(opts.translate ?? null);

  useEffect(() => {
    transportRef.current = transport;
    persistRef.current = persist;
    maxSeqRef.current = opts.currentMaxSeq;
    translateRef.current = opts.translate ?? null;
  }, [transport, persist, opts.currentMaxSeq, opts.translate]);

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

  const processFinal = useCallback(async (raw: string) => {
    // Swear words are masked before anything else, so they never leave this browser.
    const { text, terms } = matcherRef.current.match(censor(raw).text);
    const now = Date.now();
    const es = await translateText(translateRef.current, text, terms);
    let msg: UtteranceMessage = {
      seq: seqRef.current + 1,
      text,
      ...(es ? { es } : {}),
      terms,
      wpm: meterRef.current(text, now),
      sentAt: now,
    };
    // Store first, then publish: what students see live is exactly what backfill returns.
    const p = persistRef.current;
    if (p) {
      try {
        msg = await persistWithRenumber(msg, p, maxSeqRef.current);
        setPersistError(null);
      } catch (e: unknown) {
        // Still publish live; students recover nothing for this one, but the lesson goes on.
        setPersistError(e instanceof Error ? e.message : String(e));
      }
    }
    seqRef.current = msg.seq;
    historyRef.current.push(msg);
    setSentences((s) => [...s, msg]);
    setWpm(msg.wpm);
    await transportRef.current?.publish(msg).catch(() => undefined);
  }, []);

  const handleFinal = useCallback(
    (raw: string) => {
      queueRef.current = queueRef.current.then(() => processFinal(raw)).catch(() => undefined);
    },
    [processFinal],
  );

  const start = useCallback(
    (provider: SttProvider) => {
      if (providerRef.current && providerRef.current !== provider) providerRef.current.stop();
      providerRef.current = provider;
      setError(null);
      provider.start({
        onFinal: handleFinal,
        onPartial: (p) => setPartial(censor(p).text),
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

  const stopAndFlush = useCallback(async () => {
    pause();
    await queueRef.current;
  }, [pause]);

  // Stop recognition on unmount (also covers StrictMode double-mount).
  useEffect(() => () => providerRef.current?.stop(), []);

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
    stopAndFlush,
    historySince,
    activeProvider: () => providerRef.current,
  };
}
