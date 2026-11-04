import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SttErrorKind } from "./types";
import { START_TIMEOUT_MS, WebSpeechProvider } from "./webspeech";

/** Minimal stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static silent = false; // simulates a browser that never starts listening
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  starts = 0;
  aborted = false;
  onstart: (() => void) | null = null;
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.starts++;
    if (!FakeRecognition.silent) this.onstart?.();
  }
  abort() {
    this.aborted = true;
  }
  final(text: string) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  }
}

function stubMic(result: "ok" | string) {
  const getUserMedia = vi.fn(async () => {
    if (result !== "ok") throw new DOMException("x", result);
    return { getTracks: () => [{ stop: vi.fn() }] };
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  return getUserMedia;
}

async function startAndFlush(p: WebSpeechProvider, h: Parameters<WebSpeechProvider["start"]>[0]) {
  p.start(h);
  await vi.advanceTimersByTimeAsync(0); // let the microphone pre-check resolve
}

describe("WebSpeechProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    FakeRecognition.silent = false;
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    stubMic("ok");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checks the microphone, then starts listening", async () => {
    const statuses: string[] = [];
    await startAndFlush(new WebSpeechProvider(), { onFinal: () => {}, onStatus: (s) => statuses.push(s) });
    expect(statuses).toContain("listening");
  });

  it("restarts after silence with backoff", async () => {
    const p = new WebSpeechProvider();
    await startAndFlush(p, { onFinal: () => {} });
    const rec = FakeRecognition.instances[0];
    rec.onend?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(rec.starts).toBe(2);
  });

  it("an old recognizer never restarts after pause + resume (no duplicate captions)", async () => {
    const finals: string[] = [];
    const p = new WebSpeechProvider();
    await startAndFlush(p, { onFinal: (t) => finals.push(t) });
    const first = FakeRecognition.instances[0];
    p.stop();
    await startAndFlush(p, { onFinal: (t) => finals.push(t) });
    const second = FakeRecognition.instances[1];
    first.onend?.(); // late onend from the stopped recognizer
    await vi.advanceTimersByTimeAsync(5000);
    expect(first.starts).toBe(1);
    first.final("frase velha");
    second.final("frase nova");
    expect(finals).toEqual(["frase nova"]);
  });

  it.each([
    ["NotAllowedError", "permission"],
    ["NotFoundError", "no-microphone"],
    ["NotReadableError", "mic-busy"],
  ] as const)("microphone %s becomes a clear '%s' error, without starting recognition", async (name, kind) => {
    stubMic(name);
    const errors: SttErrorKind[] = [];
    await startAndFlush(new WebSpeechProvider(), { onFinal: () => {}, onError: (e) => errors.push(e.kind) });
    expect(errors).toEqual([kind]);
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("stops waiting when the browser never starts listening", async () => {
    FakeRecognition.silent = true;
    const errors: SttErrorKind[] = [];
    const statuses: string[] = [];
    await startAndFlush(new WebSpeechProvider(), {
      onFinal: () => {},
      onError: (e) => errors.push(e.kind),
      onStatus: (s) => statuses.push(s),
    });
    await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 10);
    expect(errors).toEqual(["no-response"]);
    expect(statuses.at(-1)).toBe("error");
    expect(FakeRecognition.instances[0].aborted).toBe(true);
  });

  it("no microphone reported by the recognizer is fatal (no silent retry loop)", async () => {
    const errors: SttErrorKind[] = [];
    await startAndFlush(new WebSpeechProvider(), { onFinal: () => {}, onError: (e) => errors.push(e.kind) });
    const rec = FakeRecognition.instances[0];
    rec.onerror?.({ error: "audio-capture" });
    rec.onend?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(errors).toEqual(["no-microphone"]);
    expect(rec.starts).toBe(1);
  });

  it("permission errors from the recognizer are fatal and stop restarting", async () => {
    const errors: SttErrorKind[] = [];
    await startAndFlush(new WebSpeechProvider(), { onFinal: () => {}, onError: (e) => errors.push(e.kind) });
    const rec = FakeRecognition.instances[0];
    rec.onerror?.({ error: "not-allowed" });
    rec.onend?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(errors).toEqual(["permission"]);
    expect(rec.starts).toBe(1);
  });

  it("stopping during the microphone check cancels the start", async () => {
    const p = new WebSpeechProvider();
    p.start({ onFinal: () => {} });
    p.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecognition.instances).toHaveLength(0);
  });
});
