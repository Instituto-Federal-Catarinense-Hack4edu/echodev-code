import type { ControlMessage, UtteranceMessage } from "./schemas";

export type TransportStatus = "connecting" | "connected" | "disconnected" | "error";

export interface RealtimeTransport {
  readonly status: TransportStatus;
  publish(msg: UtteranceMessage): Promise<void>;
  /** Returns an unsubscribe function. Invalid messages are dropped. */
  subscribe(handler: (msg: UtteranceMessage) => void): () => void;
  /** Fires on every status change; "connected" also fires after a reconnection. */
  onStatus(handler: (status: TransportStatus) => void): () => void;
  /** Lesson-level signals (teacher only sends; enforced by RLS on the real channel). */
  publishControl(msg: ControlMessage): Promise<void>;
  onControl(handler: (msg: ControlMessage) => void): () => void;
  close(): void;
}

/** Fetches every utterance with seq > afterSeq, in order (paginated by the implementation). */
export type FetchSince = (afterSeq: number) => Promise<UtteranceMessage[]>;
