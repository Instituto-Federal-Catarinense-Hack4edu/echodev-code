"use client";

import { useState } from "react";
import { LiveCaption } from "@/components/live-caption";
import { TermSheet, type FeedbackKind } from "@/components/term-sheet";
import { DebugPanel } from "@/components/debug-panel";
import type { Depth, Lang } from "@/lib/terms/schemas";
import type { FetchSince, RealtimeTransport } from "@/lib/realtime/types";
import { useCaptionClient } from "@/lib/realtime/use-caption-client";
import { useWakeLock } from "@/lib/use-wake-lock";
import { t } from "@/lib/i18n/pt-BR";

interface Props {
  transport: RealtimeTransport | null;
  fetchSince: FetchSince | null;
  title: string;
  depth: Depth;
  lang: Lang;
  literalMode?: boolean;
  onDepthChange: (d: Depth) => void;
  onLangChange: (l: Lang) => void;
  onTermOpen?: (termId: string, depth: Depth) => void;
  onFeedback?: (termId: string, kind: FeedbackKind, depth: Depth) => void;
  headerExtra?: React.ReactNode;
  debug?: boolean;
}

export function StudentView(props: Props) {
  const { items, status, lastLatency } = useCaptionClient(props.transport, props.fetchSince);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  useWakeLock(true);

  const statusText =
    status === "connected"
      ? t.student.connected
      : status === "connecting"
        ? t.student.connecting
        : t.student.disconnected;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <h1 className="mr-auto text-base font-semibold">{props.title}</h1>
        <span
          className={`text-sm ${status === "connected" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}
          aria-live="polite"
        >
          {statusText}
        </span>
        {props.headerExtra}
      </header>
      {props.debug && (
        <DebugPanel latency={lastLatency} seq={items.at(-1)?.seq ?? 0} status={status} />
      )}
      <LiveCaption
        items={items}
        onTermClick={(id) => {
          setOpenTerm(id);
          props.onTermOpen?.(id, props.depth);
        }}
      />
      <TermSheet
        termId={openTerm}
        onClose={() => setOpenTerm(null)}
        depth={props.depth}
        lang={props.lang}
        onDepthChange={props.onDepthChange}
        onLangChange={props.onLangChange}
        literalMode={props.literalMode}
        onFeedback={props.onFeedback}
      />
    </div>
  );
}
