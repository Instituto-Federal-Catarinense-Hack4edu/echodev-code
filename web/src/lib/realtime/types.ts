import type { UtteranceMessage } from "./schemas";

export type TransportStatus = "connecting" | "connected" | "disconnected" | "error";

export interface RealtimeTransport {
  readonly status: TransportStatus;
  publish(msg: UtteranceMessage): Promise<void>;
  /** Returns an unsubscribe function. Invalid messages are dropped. */
  subscribe(handler: (msg: UtteranceMessage) => void): () => void;
  /** Fires on every status change; "connected" also fires after a reconnection. */
  onStatus(handler: (status: TransportStatus) => void): () => void;
  close(): void;
}

/** Fetches every utterance with seq > afterSeq, in order (paginated by the implementation). */
export type FetchSince = (afterSeq: number) => Promise<UtteranceMessage[]>;
