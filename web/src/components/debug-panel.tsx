"use client";

import type { TransportStatus } from "@/lib/realtime/types";
import { t } from "@/lib/i18n/pt-BR";

/** Shown with ?debug=1. Latency uses sentAt from another clock: indicative only. */
export function DebugPanel(props: { latency: number | null; seq: number; status: TransportStatus }) {
  return (
    <dl className="grid grid-cols-3 gap-2 border-b bg-muted/60 px-4 py-2 font-mono text-xs" aria-label={t.debug.title}>
      <div>
        <dt className="text-muted-foreground">{t.debug.latency}</dt>
        <dd>{props.latency === null ? "–" : `${props.latency} ms`}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t.debug.seq}</dt>
        <dd>{props.seq}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t.debug.connection}</dt>
        <dd>{props.status}</dd>
      </div>
    </dl>
  );
}
