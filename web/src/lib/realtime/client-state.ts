import type { UtteranceMessage } from "./schemas";
import type { FetchSince, RealtimeTransport, TransportStatus } from "./types";

/**
 * Ordered, idempotent store of sentences keyed by seq.
 * `lastSeq` is the highest seq such that every seq in 1..lastSeq is present.
 */
export class CaptionStore {
  private bySeq = new Map<number, UtteranceMessage>();
  private _lastSeq = 0;
  private sorted: UtteranceMessage[] = [];

  get lastSeq(): number {
    return this._lastSeq;
  }

  get items(): readonly UtteranceMessage[] {
    return this.sorted;
  }

  /** Adds one message. Returns true when a gap (missing seq) exists after this insert. */
  ingest(msg: UtteranceMessage): { added: boolean; gap: boolean } {
    const added = this.insert(msg);
    if (added) this.rebuild();
    return { added, gap: this.hasGap() };
  }

  /** Merges many messages (backfill). Returns how many were new. */
  merge(msgs: UtteranceMessage[]): number {
    let n = 0;
    for (const m of msgs) if (this.insert(m)) n++;
    if (n) this.rebuild();
    return n;
  }

  hasGap(): boolean {
    return this.sorted.length > 0 && this.sorted[this.sorted.length - 1].seq > this._lastSeq;
  }

  private insert(msg: UtteranceMessage): boolean {
    if (this.bySeq.has(msg.seq)) return false;
    this.bySeq.set(msg.seq, msg);
    return true;
  }

  private rebuild() {
    this.sorted = [...this.bySeq.values()].sort((a, b) => a.seq - b.seq);
    while (this.bySeq.has(this._lastSeq + 1)) this._lastSeq++;
  }
}

export interface CaptionClientOptions {
  transport: RealtimeTransport;
  fetchSince: FetchSince;
  onChange: (items: readonly UtteranceMessage[]) => void;
  onStatus?: (status: TransportStatus) => void;
  onMessage?: (msg: UtteranceMessage) => void;
  /**
   * Safety net: also backfill every N ms. A gap is only noticed when a later message
   * arrives, so a lost *last* sentence (or a dead teacher channel) would otherwise go unseen.
   */
  pollMs?: number;
}

export const DEFAULT_POLL_MS = 20_000;

/**
 * Student-side client: live messages + backfill on (re)connect and on gaps.
 * Backfill is single-flight; a request arriving while one runs schedules one more.
 */
export class CaptionClient {
  readonly store = new CaptionStore();
  private unsubs: (() => void)[] = [];
  private inFlight: Promise<void> | null = null;
  private again = false;
  private stopped = false;

  constructor(private readonly opts: CaptionClientOptions) {}

  start(): void {
    this.stopped = false;
    const { transport } = this.opts;
    this.unsubs.push(
      transport.subscribe((msg) => {
        const { added, gap } = this.store.ingest(msg);
        if (added) {
          this.opts.onMessage?.(msg);
          this.emit();
        }
        if (gap) void this.backfill();
      }),
      transport.onStatus((s) => {
        this.opts.onStatus?.(s);
        if (s === "connected") void this.backfill();
      }),
    );
    this.opts.onStatus?.(transport.status);
    if (transport.status === "connected") void this.backfill();
    const pollMs = this.opts.pollMs ?? DEFAULT_POLL_MS;
    if (pollMs > 0) {
      const timer = setInterval(() => void this.backfill(), pollMs);
      this.unsubs.push(() => clearInterval(timer));
    }
  }

  stop(): void {
    this.stopped = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  backfill(): Promise<void> {
    if (this.inFlight) {
      this.again = true;
      return this.inFlight;
    }
    this.inFlight = (async () => {
      do {
        this.again = false;
        try {
          const msgs = await this.opts.fetchSince(this.store.lastSeq);
          if (!this.stopped && this.store.merge(msgs) > 0) this.emit();
        } catch {
          // Network failure: the next reconnect or gap retries.
        }
      } while (this.again && !this.stopped);
    })().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private emit() {
    this.opts.onChange(this.store.items);
  }
}
