"use client";

import { Fragment } from "react";
import type { TermSpan } from "@/lib/realtime/schemas";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  terms: TermSpan[];
  onTermClick?: (termId: string) => void;
  className?: string;
}

export function CaptionText({ text, terms, onTermClick, className }: Props) {
  const t = useT();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...terms].sort((a, b) => a.start - b.start);
  sorted.forEach((s, i) => {
    if (s.start < cursor) return;
    if (s.start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, s.start)}</Fragment>);
    const word = text.slice(s.start, s.end);
    parts.push(
      onTermClick ? (
        <button
          key={`s${i}`}
          type="button"
          onClick={() => onTermClick(s.termId)}
          aria-label={t.student.termAria(word)}
          className="term-highlight"
        >
          {word}
        </button>
      ) : (
        <mark key={`s${i}`} className="term-highlight">
          {word}
        </mark>
      ),
    );
    cursor = s.end;
  });
  if (cursor < text.length) parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>);
  return <span className={cn(className)}>{parts}</span>;
}
