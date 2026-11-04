import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSpeechProvider } from "./webspeech";

/** Minimal stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  starts = 0;
  onstart: (() => void) | null = null;
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.starts++;
    this.onstart?.();
  }
  abort() {}
  final(text: string) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  }
}

describe("WebSpeechProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("restarts after silence with backoff", () => {
    const p = new WebSpeechProvider();
    p.start({ onFinal: () => {} });
    const rec = FakeRecognition.instances[0];
    rec.onend?.();
    vi.advanceTimersByTime(300);
    expect(rec.starts).toBe(2);
  });

  it("an old recognizer never restarts after pause + resume (no duplicate captions)", () => {
    const finals: string[] = [];
    const p = new WebSpeechProvider();
    p.start({ onFinal: (t) => finals.push(t) });
    const first = FakeRecognition.instances[0];
    p.stop();
    p.start({ onFinal: (t) => finals.push(t) });
    const second = FakeRecognition.instances[1];
    first.onend?.(); // late onend from the stopped recognizer
    vi.advanceTimersByTime(5000);
    expect(first.starts).toBe(1);
    first.final("frase velha");
    second.final("frase nova");
    expect(finals).toEqual(["frase nova"]);
  });

  it("permission errors are fatal and stop restarting", () => {
    const errors: string[] = [];
    const p = new WebSpeechProvider();
    p.start({ onFinal: () => {}, onError: (e) => errors.push(e.kind) });
    const rec = FakeRecognition.instances[0];
    rec.onerror?.({ error: "not-allowed" });
    rec.onend?.();
    vi.advanceTimersByTime(5000);
    expect(errors).toEqual(["permission"]);
    expect(rec.starts).toBe(1);
  });
});
