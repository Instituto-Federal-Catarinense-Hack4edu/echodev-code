import { describe, expect, it } from "vitest";
import { CaptionClient, CaptionStore } from "./client-state";
import { LocalTransport } from "./local";
import type { UtteranceMessage } from "./schemas";
import { parseUtterance } from "./schemas";
import type { RealtimeTransport, TransportStatus } from "./types";

const msg = (seq: number, text = `frase ${seq}`): UtteranceMessage => ({
  seq,
  text,
  terms: [],
  wpm: 120,
  sentAt: 1_000 + seq,
});

class FakeTransport implements RealtimeTransport {
  status: TransportStatus = "connecting";
  private h = new Set<(m: UtteranceMessage) => void>();
  private s = new Set<(s: TransportStatus) => void>();
  async publish(m: UtteranceMessage) {
    for (const f of this.h) f(m);
  }
  subscribe(f: (m: UtteranceMessage) => void) {
    this.h.add(f);
    return () => this.h.delete(f);
  }
  onStatus(f: (s: TransportStatus) => void) {
    this.s.add(f);
    return () => this.s.delete(f);
  }
  setStatus(st: TransportStatus) {
    this.status = st;
    for (const f of this.s) f(st);
  }
  async publishControl() {}
  onControl() {
    return () => {};
  }
  close() {}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("UtteranceMessage schema", () => {
  it("rejects spans outside the text", () => {
    expect(parseUtterance({ ...msg(1, "abc"), terms: [{ termId: "x", start: 1, end: 9 }] })).toBe(
      null,
    );
    expect(parseUtterance({ seq: "1" })).toBe(null);
    expect(parseUtterance(msg(1))).not.toBe(null);
  });
});

describe("CaptionStore", () => {
  it("ignores duplicates", () => {
    const s = new CaptionStore();
    s.ingest(msg(1));
    expect(s.ingest(msg(1)).added).toBe(false);
    expect(s.items).toHaveLength(1);
  });

  it("detects a gap and closes it after merge", () => {
    const s = new CaptionStore();
    s.ingest(msg(1));
    s.ingest(msg(2));
    expect(s.ingest(msg(4)).gap).toBe(true);
    expect(s.lastSeq).toBe(2);
    expect(s.merge([msg(3), msg(4)])).toBe(1);
    expect(s.lastSeq).toBe(4);
    expect(s.items.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(s.hasGap()).toBe(false);
  });

  it("orders out-of-order arrivals by seq", () => {
    const s = new CaptionStore();
    s.merge([msg(3), msg(1), msg(2)]);
    expect(s.items.map((m) => m.seq)).toEqual([1, 2, 3]);
  });
});

describe("CaptionClient", () => {
  it("backfills on connect and on gaps, idempotently", async () => {
    const server = [msg(1), msg(2), msg(3), msg(4), msg(5)];
    const calls: number[] = [];
    const t = new FakeTransport();
    let last: readonly UtteranceMessage[] = [];
    const client = new CaptionClient({
      transport: t,
      fetchSince: async (after) => {
        calls.push(after);
        return server.filter((m) => m.seq > after);
      },
      onChange: (items) => (last = items),
    });
    client.start();
    server.length = 2; // only 2 exist when we connect
    t.setStatus("connected");
    await flush();
    expect(last.map((m) => m.seq)).toEqual([1, 2]);

    server.push(msg(3), msg(4), msg(5));
    await t.publish(msg(5)); // 3 and 4 were lost
    await flush();
    await flush();
    expect(last.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5]);

    await t.publish(msg(5)); // duplicate live message
    t.setStatus("disconnected");
    t.setStatus("connected"); // reconnect triggers another (empty) backfill
    await flush();
    expect(last.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([0, 2, 5]);
    client.stop();
  });
});

describe("LocalTransport", () => {
  it("delivers messages between instances and serves history", async () => {
    const teacher = new LocalTransport("test-lesson");
    const student = new LocalTransport("test-lesson");
    const got: UtteranceMessage[] = [];
    student.subscribe((m) => got.push(m));
    const history = [msg(1), msg(2), msg(3)];
    teacher.serveHistory((after) => history.filter((m) => m.seq > after));

    await teacher.publish(msg(4));
    await new Promise((r) => setTimeout(r, 30));
    expect(got.map((m) => m.seq)).toEqual([4]);

    const missed = await student.fetchSince(1);
    expect(missed.map((m) => m.seq)).toEqual([2, 3]);
    teacher.close();
    student.close();
  });

  it("delivers the lesson-ended signal and drops malformed control messages", async () => {
    const teacher = new LocalTransport("test-end");
    const student = new LocalTransport("test-end");
    const got: string[] = [];
    student.onControl((m) => got.push(m.type));
    await teacher.publishControl({ type: "lesson_ended", at: 1 });
    // A malformed control payload must be ignored.
    new BroadcastChannel("echodev:lesson:test-end").postMessage({ kind: "control", payload: { type: "x" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(got).toEqual(["lesson_ended"]);
    teacher.close();
    student.close();
  });
});
