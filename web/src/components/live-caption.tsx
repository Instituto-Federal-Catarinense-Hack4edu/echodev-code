"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptionText } from "@/components/caption-text";
import type { UtteranceMessage } from "@/lib/realtime/schemas";
import { t } from "@/lib/i18n/pt-BR";

interface Props {
  items: readonly UtteranceMessage[];
  onTermClick: (termId: string) => void;
}

const SIZES = [18, 22, 26, 32, 40];
const FONT_KEY = "echodev:font-size";

export function LiveCaption({ items, onTermClick }: Props) {
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
          items.map((m) => (
            <p key={m.seq} className="mb-3">
              <CaptionText text={m.text} terms={m.terms} onTermClick={onTermClick} />
            </p>
          ))
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
