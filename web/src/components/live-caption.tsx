"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { getTerm } from "@/lib/terms/pack";
import type { Lang } from "@/lib/terms/schemas";
import { spansInTranslation } from "@/lib/terms/translated-spans";
import { useT } from "@/lib/i18n/context";

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
      const v = Number(localStorage.getItem(FONT_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted pref after mount
      if (v >= 0 && v < SIZES.length) setSizeIdx(v);
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
        <span className="mr-auto text-sm text-muted-foreground">{t.student.fontSize}</span>
        <Button variant="outline" size="icon" aria-label={t.student.smaller} onClick={() => changeSize(-1)}>
          <Minus />
        </Button>
        <Button variant="outline" size="icon" aria-label={t.student.larger} onClick={() => changeSize(1)}>
          <Plus />
        </Button>
      </div>
      {untranslated && (
        <p role="status" className="border-b bg-muted px-4 py-2 text-sm">
          {t.student.noTranslation}
        </p>
      )}
      <div
        ref={scroller}
        onScroll={onScroll}
        aria-live="polite"
        aria-relevant="additions"
        className="caption-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4"
        style={{ fontSize: SIZES[sizeIdx], lineHeight: 1.45 }}
      >
        {items.length === 0 ? (
          <p className="text-muted-foreground">{t.student.waiting}</p>
        ) : (
          items.map((m) =>
            wantsSpanish && m.es ? (
              <TranslatedLine key={m.seq} message={m} text={m.es} onTermClick={onTermClick} />
            ) : (
              <p key={m.seq} className="mb-3">
                <CaptionText text={m.text} terms={m.terms} onTermClick={onTermClick} />
              </p>
            ),
          )
        )}
      </div>
      {!follow && (
        <Button
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
          onClick={() => {
            setFollow(true);
            scrollToEnd();
          }}
        >
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
}: {
  message: UtteranceMessage;
  text: string;
  onTermClick: (termId: string) => void;
}) {
  const t = useT();
  const { spans, missing } = spansInTranslation(
    text,
    message.terms.map((s) => s.termId),
    "es",
  );
  return (
    <p className="mb-3" lang="es">
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