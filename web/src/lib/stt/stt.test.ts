import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSttProvider } from "./fake";
import { createFinalDeduper } from "./types";
import { createWpmMeter } from "./wpm";

describe("createFinalDeduper", () => {
  it("drops repeated and empty finals", () => {
    const d = createFinalDeduper();
    expect(d("  Olá  turma ")).toBe("Olá turma");
    expect(d("olá turma")).toBeNull();
    expect(d("   ")).toBeNull();
    expect(d("outra frase")).toBe("outra frase");
  });
});

describe("createWpmMeter", () => {
  it("computes words per minute over the window", () => {
    const meter = createWpmMeter(60_000, 10_000);
    expect(meter("um dois três quatro cinco", 0)).toBe(30); // 5 words / min span 10 s
    expect(meter("seis sete oito nove dez", 20_000)).toBe(30); // 10 words / 20 s
  });
});

describe("FakeSttProvider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const script = {
    title: "t",
    utterances: [
      { text: "primeira frase", pauseMs: 100 },
      { text: "primeira frase", pauseMs: 100 },
      { text: "segunda frase", pauseMs: 100 },
    ],
  };

  it("emits partials, dedupes finals and stops at the end", () => {
    const stt = new FakeSttProvider({ script, msPerWord: 10 });
    const finals: string[] = [];
    const partials: string[] = [];
    const statuses: string[] = [];
    stt.start({
      onFinal: (t) => finals.push(t),
      onPartial: (t) => partials.push(t),
      onStatus: (s) => statuses.push(s),
    });
    stt.start({ onFinal: (t) => finals.push("DUP " + t) }); // idempotent
    vi.runAllTimers();
    expect(finals).toEqual(["primeira frase", "segunda frase"]);
    expect(partials).toContain("primeira");
    expect(statuses.at(-1)).toBe("stopped");
  });

  it("stop prevents further callbacks and start resumes", () => {
    const stt = new FakeSttProvider({ script, msPerWord: 10 });
    const finals: string[] = [];
    stt.start({ onFinal: (t) => finals.push(t) });
    vi.advanceTimersByTime(500);
    stt.stop();
    const count = finals.length;
    vi.runAllTimers();
    expect(finals.length).toBe(count);
  });
});
