"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { getTerm } from "@/lib/terms/pack";
import type { Lang } from "@/lib/terms/schemas";
import { spansInTranslation } from "@/lib/terms/translated-spans";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface Props {
  items: readonly UtteranceMessage[];
  onTermClick: (termId: string) => void;
  lang?: Lang;
}

const SIZES = [18, 22, 26, 32, 40];
const FONT_KEY = "echodev:font-size";

export function LiveCaption({ items, onTermClick, lang = "pt" }: Props) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [seenCount, setSeenCount] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(2);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_KEY);
      // Number(null) is 0: without a saved value keep the default size.
      const v = saved === null ? NaN : Number(saved);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted pref after mount
      if (Number.isInteger(v) && v >= 0 && v < SIZES.length) setSizeIdx(v);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeSize = (d: number) => {
    setSizeIdx((i) => {
      const n = Math.max(0, Math.min(SIZES.length - 1, i + d));
      try {
        localStorage.setItem(FONT_KEY, String(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  };

  const scrollToEnd = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (follow) {
      scrollToEnd();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- track what the student has seen
      setSeenCount(items.length);
    }
  }, [items, follow, scrollToEnd, sizeIdx]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setFollow(atBottom);
  };

  const unseen = Math.max(0, items.length - seenCount);
  const wantsSpanish = lang === "es";
  const untranslated = wantsSpanish && items.length > 0 && !items.at(-1)?.es;
  const lastSeq = items.at(-1)?.seq;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b bg-card/50 px-3 py-1.5 sm:px-4">
        <span className="mr-auto text-sm text-muted-foreground">{t.student.fontSize}</span>
        <span aria-hidden className="flex items-end gap-1" title={t.student.fontLevel(sizeIdx + 1, SIZES.length)}>
          {SIZES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-1.5 rounded-full transition-colors",
                i <= sizeIdx ? "bg-primary" : "bg-foreground/15",
              )}
              style={{ height: 6 + i * 3 }}
            />
          ))}
        </span>
        <span className="sr-only" aria-live="polite">
          {t.student.fontLevel(sizeIdx + 1, SIZES.length)}
        </span>
        <div className="flex items-center rounded-xl border bg-card p-0.5 shadow-xs">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.student.smaller}
            disabled={sizeIdx === 0}
            onClick={() => changeSize(-1)}
            className="rounded-lg text-sm font-bold"
          >
            A<span className="text-[0.7em]">−</span>
          </Button>
          <span aria-hidden className="h-6 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.student.larger}
            disabled={sizeIdx === SIZES.length - 1}
            onClick={() => changeSize(1)}
            className="rounded-lg text-lg font-bold"
          >
            A<span className="text-[0.6em]">+</span>
          </Button>
        </div>
      </div>
      {untranslated && (
        <p role="status" className="flex items-center gap-2 border-b bg-warning-soft px-4 py-2 text-sm">
          <Info aria-hidden className="size-4 shrink-0 text-warning" />
          {t.student.noTranslation}
        </p>
      )}
      <div
        ref={scroller}
        onScroll={onScroll}
        aria-live="polite"
        aria-relevant="additions"
        className="caption-scroll nice-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6"
        style={{ fontSize: SIZES[sizeIdx], lineHeight: 1.5 }}
      >
        <div className="mx-auto max-w-3xl">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
              <span className="typing-dots text-[1.4em] text-primary" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <p>{t.student.waiting}</p>
            </div>
          ) : (
            items.map((m) => {
              const newest = m.seq === lastSeq;
              const lineClass = cn(
                "animate-rise mb-2 rounded-2xl border-l-4 px-4 py-2 transition-colors",
                newest ? "border-primary bg-card shadow-[var(--shadow-soft)]" : "border-transparent",
              );
              return wantsSpanish && m.es ? (
                <TranslatedLine key={m.seq} className={lineClass} message={m} text={m.es} onTermClick={onTermClick} />
              ) : (
                <p key={m.seq} className={lineClass}>
                  <CaptionText text={m.text} terms={m.terms} onTermClick={onTermClick} />
                </p>
              );
            })
          )}
        </div>
      </div>
      {!follow && (
        <Button
          className="animate-rise absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full px-5 shadow-[var(--shadow-lift)]"
          onClick={() => {
            setFollow(true);
            scrollToEnd();
          }}
        >
          <ArrowDown aria-hidden />
          {t.student.backToLive(unseen)}
        </Button>
      )}
    </div>
  );
}

function TranslatedLine({
  message,
  text,
  onTermClick,
  className,
}: {
  message: UtteranceMessage;
  text: string;
  onTermClick: (termId: string) => void;
  className?: string;
}) {
  const t = useT();
  const { spans, missing } = spansInTranslation(
    text,
    message.terms.map((s) => s.termId),
    "es",
  );
  return (
    <p className={className} lang="es">
      <CaptionText text={text} terms={spans} onTermClick={onTermClick} />
      {missing.length > 0 && (
        <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle text-[0.7em]">
          <span className="text-muted-foreground">{t.student.termsInSentence}</span>
          {missing.map((id) => (
            <button key={id} type="button" className="term-highlight" onClick={() => onTermClick(id)}>
              {getTerm(id)?.canonical ?? id}
            </button>
          ))}
        </span>
      )}
    </p>
  );
}
