/**
 * Masks swear words before a sentence leaves the teacher's browser (caption, DB, summary,
 * LLM). Whole-word, accent- and case-insensitive. Words with a common innocent meaning
 * (e.g. "pica" from "picar", "bicha" = queue in pt-PT) are left out on purpose.
 */
export const MASK = "***";

const WORDS = [
  // pt-BR
  "porra", "porras", "caralho", "caralhos", "merda", "merdas", "bosta", "bostas",
  "puta", "putas", "puto", "putos", "putaria", "putaquepariu",
  "foda", "fodas", "foder", "fodeu", "fodido", "fodida", "fodidos", "fodase", "fodasse",
  "fuder", "fudeu", "fudido", "fudida",
  "cacete", "buceta", "bucetas", "boceta", "bocetas", "piroca", "pirocas",
  "cu", "cuzao", "cuzinho", "arrombado", "arrombada", "arrombados",
  "viado", "viados", "desgracado", "desgracada",
  "babaca", "babacas", "otario", "otaria", "otarios",
  // English (programming classes mix languages)
  "fuck", "fucking", "fucked", "motherfucker", "shit", "bullshit", "bitch", "asshole",
];
const BLOCKED = new Set(WORDS);

const WORD_RE = /[\p{L}\p{N}_]+/gu;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export interface CensorResult {
  text: string;
  masked: number;
}

export function censor(text: string): CensorResult {
  let masked = 0;
  let out = text.replace(WORD_RE, (word) => {
    if (!BLOCKED.has(normalize(word))) return word;
    masked++;
    return MASK;
  });
  // "foda-se" -> "***" (drop the dangling "-se" of a masked word).
  out = out.replace(/\*\*\*-se\b/giu, MASK);
  return { text: out, masked };
}
