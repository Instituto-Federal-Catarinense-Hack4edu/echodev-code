"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
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
  onDepthChange: (d: Depth) => void;
  onLangChange: (l: Lang) => void;
  onTermOpen?: (termId: string, depth: Depth) => void;
  onFeedback?: (termId: string, kind: FeedbackKind, depth: Depth) => void;
  headerExtra?: React.ReactNode;
  reviewHref?: string | null;
  debug?: boolean;
}

export function StudentView(props: Props) {
  const { items, status, lastLatency } = useCaptionClient(props.transport, props.fetchSince);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  useWakeLock(!props.reviewHref);

  const statusText =
    status === "connected"
      ? t.student.connected
      : status === "connecting"
        ? t.student.connecting
        : t.student.disconnected;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Link href="/" aria-label={t.brand.home} className="inline-flex min-h-11 items-center">
          <BrandMark />
        </Link>
        <h1 className="mr-auto text-base font-semibold">{props.title}</h1>
        {!props.reviewHref && (
          <span
            className={`text-sm ${status === "connected" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}
            aria-live="polite"
          >
            {statusText}
          </span>
        )}
        {props.headerExtra}
      </header>
      {props.reviewHref && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground"
        >
          <p className="mr-auto font-semibold">{t.student.ended}</p>
          <Link href={props.reviewHref} className={buttonVariants({ variant: "secondary" })}>
            {t.student.review}
          </Link>
        </div>
      )}
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
        onFeedback={props.onFeedback}
      />
    </div>
  );
}
