import demoLesson from "@/content/demo/aula-demo.json";
import { createFinalDeduper, type SttHandlers, type SttProvider } from "./types";

export interface FakeScript {
  title: string;
  utterances: { text: string; pauseMs: number }[];
}

export interface FakeOptions {
  script?: FakeScript;
  /** Milliseconds per word while "speaking" (interims). ~150 wpm = 400 ms. */
  msPerWord?: number;
  /** Multiplies every delay (tests use 0). */
  speed?: number;
  loop?: boolean;
}

/** Replays a scripted lesson with realistic delays (tests, rehearsal, offline plan B). */
export class FakeSttProvider implements SttProvider {
  readonly name = "fake";
  private timers: ReturnType<typeof setTimeout>[] = [];
  private active = false;
  private readonly script: FakeScript;
  private readonly msPerWord: number;
  private readonly speed: number;
  private readonly loop: boolean;
  /** Index of the next sentence; kept across stop/start so "pause" resumes. */
  private index = 0;

  constructor(opts: FakeOptions = {}) {
    this.script = opts.script ?? (demoLesson as FakeScript);
    this.msPerWord = opts.msPerWord ?? 400;
    this.speed = opts.speed ?? 1;
    this.loop = opts.loop ?? false;
  }

  isSupported(): boolean {
    return true;
  }

  start(handlers: SttHandlers): void {
    if (this.active) return;
    this.active = true;
    const dedupe = createFinalDeduper();
    handlers.onStatus?.("listening");

    const later = (ms: number, fn: () => void) => {
      this.timers.push(setTimeout(fn, ms * this.speed));
    };

    const speak = () => {
      if (!this.active) return;
      if (this.index >= this.script.utterances.length) {
        if (!this.loop) {
          this.active = false;
          handlers.onStatus?.("stopped");
          return;
        }
        this.index = 0;
      }
      const u = this.script.utterances[this.index];
      const words = u.text.split(/\s+/);
      words.forEach((_, w) => {
        later(this.msPerWord * (w + 1), () => {
          if (this.active) handlers.onPartial?.(words.slice(0, w + 1).join(" "));
        });
      });
      later(this.msPerWord * words.length + 150, () => {
        if (!this.active) return;
        handlers.onPartial?.("");
        const clean = dedupe(u.text);
        if (clean) handlers.onFinal(clean);
        this.index++;
        later(u.pauseMs, speak);
      });
    };
    later(300, speak);
  }

  stop(): void {
    this.active = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Restart from the first sentence. */
  reset(): void {
    this.stop();
    this.index = 0;
  }
}
