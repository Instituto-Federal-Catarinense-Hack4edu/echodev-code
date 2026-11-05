import type { TermSpan } from "@/lib/realtime/schemas";
import { getTerm } from "./pack";
import type { Lang } from "./schemas";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds the sentence's terms inside its translation. Terms that cannot be located are
 * returned in `missing`, so the student can still open them.
 */
export function spansInTranslation(
  translated: string,
  termIds: string[],
  lang: Exclude<Lang, "pt">,
): { spans: TermSpan[]; missing: string[] } {
  const spans: TermSpan[] = [];
  const missing: string[] = [];
  const overlaps = (start: number, end: number) => spans.some((s) => start < s.end && end > s.start);

  for (const id of [...new Set(termIds)]) {
    const term = getTerm(id);
    if (!term) continue;
    const names = [...(term.explanations[lang]?.names ?? []), term.canonical, ...(term.forms ?? [])].sort(
      (a, b) => b.length - a.length,
    );
    let found: TermSpan | null = null;
    for (const name of names) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_.])${escape(name)}(?![\\p{L}\\p{N}_])`, "giu");
      for (const m of translated.matchAll(re)) {
        const start = m.index;
        const end = start + m[0].length;
        if (!overlaps(start, end)) {
          found = { termId: id, start, end };
          break;
        }
      }
      if (found) break;
    }
    if (found) spans.push(found);
    else missing.push(id);
  }
  return { spans: spans.sort((a, b) => a.start - b.start), missing };
}
