import { createMatcher, normalize, type MatchableTerm } from "./matcher";
import { censor } from "@/lib/text/profanity";

/**
 * A teacher correction ("the recognizer wrote X, it is term Y") becomes a dictionary variant
 * for every lesson of every teacher, so it must never be a common word.
 */
const COMMON = new Set(
  (
    "que com para por pela pelo pelas pelos uma uns umas isso isto esse essa esses essas este esta " +
    "estes estas aquele aquela aqui ali agora entao depois antes tambem quando onde como mais menos " +
    "muito muita pouco tudo nada cada ser ter vai vou foi era sao tem tinha fazer faz fiz feito ver " +
    "olha bom boa sim nao porque pois mas nem seu sua meu minha nosso nossa voce voces eles elas ele " +
    "ela gente turma aula aluno alunos professor exemplo codigo coisa vez vezes dia hoje ontem amanha " +
    "certo errado assim ainda sempre nunca entre sobre ate sem dois tres primeiro segundo"
  ).split(" "),
);

export type CorrectionProblem = "too_short" | "common_word" | "profanity" | "other_term" | null;

/** Why a heard phrase cannot become a variant of `termId` (null = acceptable). */
export function correctionProblem(heard: string, termId: string, terms: MatchableTerm[]): CorrectionProblem {
  const words = normalize(heard).match(/[\p{L}\p{N}_]+/gu) ?? [];
  const joined = words.join("");
  if (joined.length < 3) return "too_short";
  if (censor(heard).masked > 0) return "profanity";
  if (words.length === 1 && COMMON.has(words[0])) return "common_word";
  if (words.every((w) => COMMON.has(w) || w.length < 3)) return "common_word";
  // Already recognized (exactly) as a different term: the correction would fight the pack.
  const exact = createMatcher(terms.map((t) => ({ ...t, fuzzy: false }))).match(heard);
  const whole = exact.terms.length === 1 && exact.terms[0].start === 0 && exact.terms[0].end === exact.text.length;
  if (whole && exact.terms[0].termId !== termId) return "other_term";
  return null;
}
