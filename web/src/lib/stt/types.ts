export type SttStatus = "idle" | "listening" | "restarting" | "stopped" | "error";

export type SttErrorKind =
  | "unsupported"
  | "permission" // not-allowed / service-not-allowed (fatal)
  | "too-many-errors" // restart limit hit (fatal)
  | "transient"; // no-speech / network / aborted (auto-restart)

export interface SttError {
  kind: SttErrorKind;
  code: string;
  fatal: boolean;
}

export interface SttHandlers {
  /** Interim text (teacher screen only, never published). */
  onPartial?: (text: string) => void;
  /** Final sentence, already deduplicated. */
  onFinal: (text: string) => void;
  onStatus?: (status: SttStatus) => void;
  onError?: (error: SttError) => void;
}

export interface SttProvider {
  readonly name: string;
  isSupported(): boolean;
  /** Idempotent: calling start twice does not create two recognizers. */
  start(handlers: SttHandlers): void;
  /** Idempotent; after stop no more callbacks fire. */
  stop(): void;
}

/** Drops a final identical to the previous one (Android repeats finals). */
export function createFinalDeduper() {
  let last = "";
  return (text: string): string | null => {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (key === last) return null;
    last = key;
    return clean;
  };
}
