/** Rolling words-per-minute over the last `windowMs` of final sentences. */
export function createWpmMeter(windowMs = 60_000, minSpanMs = 10_000) {
  const entries: { at: number; words: number }[] = [];
  return (text: string, now: number = Date.now()): number => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    entries.push({ at: now, words });
    while (entries.length && now - entries[0].at > windowMs) entries.shift();
    const total = entries.reduce((s, e) => s + e.words, 0);
    // Span covers the time spoken since the oldest sentence started (estimated).
    const span = Math.max(now - entries[0].at, minSpanMs);
    return Math.round((total / span) * 60_000);
  };
}
