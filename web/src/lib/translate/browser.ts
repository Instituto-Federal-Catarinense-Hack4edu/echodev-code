/**
 * Chrome's built-in Translator API (Chrome 138+, desktop only). Translation runs on this
 * computer: the teacher's speech is never sent to another server for it.
 */

export type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface ChromeTranslator {
  translate(text: string): Promise<string>;
  destroy?: () => void;
}

interface DownloadMonitor {
  addEventListener(type: "downloadprogress", listener: (e: { loaded: number }) => void): void;
}

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorApi {
  availability(options: TranslatorOptions): Promise<Availability>;
  create(options: TranslatorOptions & { monitor?: (m: DownloadMonitor) => void }): Promise<ChromeTranslator>;
}

export type TranslateFn = (text: string) => Promise<string>;

const PT_ES: TranslatorOptions = { sourceLanguage: "pt", targetLanguage: "es" };
const TIMEOUT_MS = 4000;
const AVAILABILITY_TIMEOUT_MS = 5000;

function api(): TranslatorApi | null {
  return (globalThis as { Translator?: TranslatorApi }).Translator ?? null;
}

export async function esAvailability(): Promise<Availability | "unsupported"> {
  const a = api();
  if (!a) return "unsupported";
  try {
    // Some Chromium builds never settle this promise; treat silence as "not available".
    return await withTimeout(a.availability(PT_ES), AVAILABILITY_TIMEOUT_MS);
  } catch {
    return "unavailable";
  }
}

/** Must run inside a click when the language pack still has to be downloaded. */
export async function createEsTranslator(onProgress?: (fraction: number) => void): Promise<TranslateFn> {
  const a = api();
  if (!a) throw new Error("unsupported");
  const translator = await a.create({
    ...PT_ES,
    monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded)),
  });
  return (text) => withTimeout(translator.translate(text), TIMEOUT_MS);
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
