import { createFinalDeduper, type SttHandlers, type SttProvider } from "./types";

type RecognitionCtor = new () => SpeechRecognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FATAL = new Set(["not-allowed", "service-not-allowed"]);
const BACKOFF_START_MS = 250;
const BACKOFF_MAX_MS = 3000;
const MAX_CONSECUTIVE_ERRORS = 8;

/**
 * Web Speech API (Chrome/Edge). Recognition stops by itself after silence, so we
 * restart on `onend` while active, with exponential backoff and an error limit.
 * Uses the system default microphone (the API cannot pick a device).
 */
export class WebSpeechProvider implements SttProvider {
  readonly name = "webspeech";
  private rec: SpeechRecognition | null = null;
  private handlers: SttHandlers | null = null;
  private active = false;
  private backoff = BACKOFF_START_MS;
  private errors = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dedupe = createFinalDeduper();

  constructor(private readonly lang = "pt-BR") {}

  isSupported(): boolean {
    return getCtor() !== null;
  }

  start(handlers: SttHandlers): void {
    this.handlers = handlers;
    if (this.active) return;
    const Ctor = getCtor();
    if (!Ctor) {
      handlers.onError?.({ kind: "unsupported", code: "unsupported", fatal: true });
      handlers.onStatus?.("error");
      return;
    }
    this.active = true;
    this.errors = 0;
    this.backoff = BACKOFF_START_MS;
    this.dedupe = createFinalDeduper();

    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.handlers?.onStatus?.("listening");
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      this.errors = 0;
      this.backoff = BACKOFF_START_MS;
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const clean = this.dedupe(text);
          if (clean) this.handlers?.onFinal(clean);
        } else {
          interim += text;
        }
      }
      this.handlers?.onPartial?.(interim.trim());
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (FATAL.has(ev.error)) {
        this.active = false;
        this.handlers?.onError?.({ kind: "permission", code: ev.error, fatal: true });
        this.handlers?.onStatus?.("error");
        return;
      }
      // "no-speech" is normal during pauses; only count real failures.
      if (ev.error !== "no-speech") this.errors++;
      if (this.errors >= MAX_CONSECUTIVE_ERRORS) {
        this.active = false;
        this.handlers?.onError?.({ kind: "too-many-errors", code: ev.error, fatal: true });
        this.handlers?.onStatus?.("error");
        return;
      }
      this.handlers?.onError?.({ kind: "transient", code: ev.error, fatal: false });
    };
    rec.onend = () => {
      // A recognizer replaced by a newer start() must never restart itself.
      if (this.rec !== rec) return;
      if (!this.active) {
        this.handlers?.onStatus?.("stopped");
        return;
      }
      this.handlers?.onStatus?.("restarting");
      const wait = this.backoff;
      this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
      this.timer = setTimeout(() => {
        this.timer = null;
        if (!this.active || this.rec !== rec) return;
        try {
          rec.start();
        } catch {
          // InvalidStateError if already started; onend will fire again.
        }
      }, wait);
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    this.handlers?.onPartial?.("");
    this.handlers?.onStatus?.("stopped");
  }
}
