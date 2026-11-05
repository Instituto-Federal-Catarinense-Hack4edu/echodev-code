import { createFinalDeduper, type SttErrorKind, type SttHandlers, type SttProvider } from "./types";

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
/** If the browser does not start listening in this time, stop waiting and explain why. */
export const START_TIMEOUT_MS = 8000;
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
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private session = 0;
  private dedupe = createFinalDeduper();

  constructor(private readonly lang = "pt-BR") {}

  isSupported(): boolean {
    return getCtor() !== null;
  }

  private fail(kind: SttErrorKind, code: string) {
    this.active = false;
    this.clearWatchdog();
    this.handlers?.onError?.({ kind, code, fatal: true });
    this.handlers?.onStatus?.("error");
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
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
    const session = ++this.session;
    void this.preflight().then((problem) => {
      if (session !== this.session || !this.active) return; // stopped meanwhile
      if (problem) this.fail(problem.kind, problem.code);
      else this.open(Ctor);
    });
  }

  /**
   * Asks for the microphone directly first: it shows the browser's permission question
   * clearly and tells apart "denied", "no microphone" and "microphone busy". The stream is
   * closed right away so it never competes with recognition.
   */
  private async preflight(): Promise<{ kind: SttErrorKind; code: string } | null> {
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!media?.getUserMedia) return null;
    try {
      const stream = await media.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      return null;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "Error";
      if (name === "NotAllowedError" || name === "SecurityError") return { kind: "permission", code: name };
      if (name === "NotFoundError" || name === "OverconstrainedError") return { kind: "no-microphone", code: name };
      if (name === "NotReadableError" || name === "AbortError") return { kind: "mic-busy", code: name };
      return null; // unknown: let recognition try and report its own error
    }
  }

  private open(Ctor: RecognitionCtor): void {
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.clearWatchdog();
      this.handlers?.onStatus?.("listening");
    };
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
        this.fail("permission", ev.error);
        return;
      }
      if (ev.error === "audio-capture") {
        this.fail("no-microphone", ev.error);
        return;
      }
      // "no-speech" is normal during pauses; only count real failures.
      if (ev.error !== "no-speech") this.errors++;
      if (this.errors >= MAX_CONSECUTIVE_ERRORS) {
        this.fail("too-many-errors", ev.error);
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
    // Some browsers expose the API but never start (no speech service): don't wait forever.
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (this.rec !== rec || !this.active) return;
      this.detach(rec);
      this.fail("no-response", "timeout");
    }, START_TIMEOUT_MS);
    try {
      rec.start();
    } catch (e) {
      this.detach(rec);
      this.fail("no-response", e instanceof DOMException ? e.name : "start-failed");
    }
  }

  private detach(rec: SpeechRecognition) {
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    if (this.rec === rec) this.rec = null;
  }

  stop(): void {
    this.active = false;
    this.session++;
    this.clearWatchdog();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const rec = this.rec;
    this.rec = null;
    if (rec) this.detach(rec);
    this.handlers?.onPartial?.("");
    this.handlers?.onStatus?.("stopped");
  }
}
