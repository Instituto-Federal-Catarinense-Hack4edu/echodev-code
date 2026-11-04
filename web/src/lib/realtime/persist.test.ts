import { describe, expect, it } from "vitest";
import { persistWithRenumber } from "./persist";
import type { UtteranceMessage } from "./schemas";

const msg = (seq: number): UtteranceMessage => ({ seq, text: "x", terms: [], wpm: 0, sentAt: 0 });

describe("persistWithRenumber", () => {
  it("stores as-is when the seq is free", async () => {
    const stored: number[] = [];
    const out = await persistWithRenumber(msg(5), async (m) => (stored.push(m.seq), "ok"));
    expect(out.seq).toBe(5);
    expect(stored).toEqual([5]);
  });

  it("moves past the highest stored seq when another tab took it", async () => {
    const taken = new Set([5, 6, 7]);
    const out = await persistWithRenumber(
      msg(5),
      async (m) => (taken.has(m.seq) ? "duplicate" : (taken.add(m.seq), "ok")),
      async () => Math.max(...taken),
    );
    expect(out.seq).toBe(8);
  });

  it("gives up after a few attempts instead of looping forever", async () => {
    await expect(persistWithRenumber(msg(1), async () => "duplicate", async () => 1)).rejects.toThrow(
      "seq conflict",
    );
  });
});
