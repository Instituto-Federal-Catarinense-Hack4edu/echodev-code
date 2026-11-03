import { parseUtterance, type UtteranceMessage } from "./schemas";
import type { FetchSince, RealtimeTransport, TransportStatus } from "./types";

type Envelope =
  | { kind: "utterance"; payload: unknown }
  | { kind: "history-request"; requestId: string; afterSeq: number }
  | { kind: "history-response"; requestId: string; payload: unknown[] };

/**
 * BroadcastChannel between tabs of the same browser. Used in Phase 1 and as the
 * offline demo mode. The teacher tab can answer history requests so a student tab
 * opened late (or after a gap) recovers missed sentences, like the DB backfill.
 */
export class LocalTransport implements RealtimeTransport {
  private channel: BroadcastChannel;
  private _status: TransportStatus = "connecting";
  private statusHandlers = new Set<(s: TransportStatus) => void>();
  private msgHandlers = new Set<(m: UtteranceMessage) => void>();
  private pending = new Map<string, (msgs: UtteranceMessage[]) => void>();
  private historyProvider: ((afterSeq: number) => UtteranceMessage[]) | null = null;

  constructor(lessonId: string) {
    this.channel = new BroadcastChannel(`echodev:lesson:${lessonId}`);
    this.channel.onmessage = (ev: MessageEvent<Envelope>) => this.onEnvelope(ev.data);
    queueMicrotask(() => this.setStatus("connected"));
  }

  get status(): TransportStatus {
    return this._status;
  }

  private setStatus(s: TransportStatus) {
    this._status = s;
    for (const h of this.statusHandlers) h(s);
  }

  private onEnvelope(env: Envelope) {
    if (!env || typeof env !== "object") return;
    if (env.kind === "utterance") {
      const msg = parseUtterance(env.payload);
      if (msg) for (const h of this.msgHandlers) h(msg);
    } else if (env.kind === "history-request" && this.historyProvider) {
      this.channel.postMessage({
        kind: "history-response",
        requestId: env.requestId,
        payload: this.historyProvider(env.afterSeq),
      } satisfies Envelope);
    } else if (env.kind === "history-response") {
      const resolve = this.pending.get(env.requestId);
      if (!resolve) return;
      this.pending.delete(env.requestId);
      resolve(env.payload.map(parseUtterance).filter((m): m is UtteranceMessage => m !== null));
    }
  }

  async publish(msg: UtteranceMessage): Promise<void> {
    this.channel.postMessage({ kind: "utterance", payload: msg } satisfies Envelope);
  }

  subscribe(handler: (msg: UtteranceMessage) => void): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }

  onStatus(handler: (s: TransportStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** Teacher side: answer students' history requests. */
  serveHistory(provider: (afterSeq: number) => UtteranceMessage[]): void {
    this.historyProvider = provider;
  }

  /** Student side: ask the teacher tab for missed sentences (empty if nobody answers). */
  fetchSince: FetchSince = (afterSeq) =>
    new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve([]);
      }, 800);
      this.pending.set(requestId, (msgs) => {
        clearTimeout(timer);
        resolve(msgs);
      });
      this.channel.postMessage({ kind: "history-request", requestId, afterSeq } satisfies Envelope);
    });

  close(): void {
    this.channel.close();
    for (const resolve of this.pending.values()) resolve([]);
    this.pending.clear();
    this.msgHandlers.clear();
    this.setStatus("disconnected");
    this.statusHandlers.clear();
  }
}
