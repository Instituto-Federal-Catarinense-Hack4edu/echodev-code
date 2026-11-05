"use client";

import { useEffect, useState } from "react";
import { CaptionClient } from "./client-state";
import type { UtteranceMessage } from "./schemas";
import type { FetchSince, RealtimeTransport, TransportStatus } from "./types";

export function useCaptionClient(
  transport: RealtimeTransport | null,
  fetchSince: FetchSince | null,
) {
  const [items, setItems] = useState<readonly UtteranceMessage[]>([]);
  const [status, setStatus] = useState<TransportStatus>("connecting");
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  useEffect(() => {
    if (!transport || !fetchSince) return;
    const client = new CaptionClient({
      transport,
      fetchSince,
      onChange: (it) => setItems([...it]),
      onStatus: setStatus,
      onMessage: (m) => setLastLatency(Date.now() - m.sentAt),
    });
    client.start();
    return () => client.stop();
  }, [transport, fetchSince]);

  return { items, status, lastLatency };
}
