"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, PartyPopper } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { LiveCaption } from "@/components/live-caption";
import { StatusPill } from "@/components/status-pill";
import { TermSheet, type FeedbackKind } from "@/components/term-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { DebugPanel } from "@/components/debug-panel";
import type { Depth, Lang } from "@/lib/terms/schemas";
import type { FetchSince, RealtimeTransport } from "@/lib/realtime/types";
import { useCaptionClient } from "@/lib/realtime/use-caption-client";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

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
  const t = useT();
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
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card/80 px-3 py-1.5 backdrop-blur-md sm:px-4">
        <Link
          href="/"
          aria-label={t.brand.home}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-opacity hover:opacity-80"
        >
          <BrandMark className="size-8" />
        </Link>
        <h1 className="mr-auto min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">{props.title}</h1>
        {!props.reviewHref && (
          <StatusPill
            live
            tone={status === "connected" ? "ok" : status === "connecting" ? "busy" : "warn"}
            className={cn(status === "connected" && "max-sm:px-2")}
          >
            <span className={cn(status === "connected" && "max-sm:sr-only")}>{statusText}</span>
          </StatusPill>
        )}
        <div className="flex items-center gap-1">
          {props.headerExtra}
          <ThemeToggle />
        </div>
      </header>
      {props.reviewHref && (
        <div
          role="status"
          className="animate-rise flex flex-wrap items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground"
        >
          <PartyPopper aria-hidden className="size-5 shrink-0" />
          <p className="mr-auto flex-1 basis-56 font-semibold">{t.student.ended}</p>
          <Link href={props.reviewHref} className={buttonVariants({ variant: "secondary" })}>
            {t.student.review}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      )}
      {props.debug && (
        <DebugPanel latency={lastLatency} seq={items.at(-1)?.seq ?? 0} status={status} />
      )}
      <LiveCaption
        items={items}
        lang={props.lang}
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
