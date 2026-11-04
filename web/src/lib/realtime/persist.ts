import type { UtteranceMessage } from "./schemas";

export type PersistFn = (msg: UtteranceMessage) => Promise<"ok" | "duplicate">;

export const MAX_RENUMBER = 3;

/**
 * Stores a sentence; if its seq is already taken (second teacher tab, stale reload), moves
 * it past the highest stored seq and retries. Returns the message as actually stored.
 */
export async function persistWithRenumber(
  msg: UtteranceMessage,
  persist: PersistFn,
  currentMaxSeq?: () => Promise<number>,
): Promise<UtteranceMessage> {
  let current = msg;
  for (let attempt = 0; ; attempt++) {
    if ((await persist(current)) === "ok") return current;
    if (attempt >= MAX_RENUMBER) throw new Error("seq conflict");
    const stored = (await currentMaxSeq?.()) ?? current.seq;
    current = { ...current, seq: Math.max(stored, current.seq) + 1 };
  }
}
