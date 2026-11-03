/** No ambiguous characters (no I, L, O, 0, 1). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function generateLessonCode(random: (n: number) => Uint32Array = randomValues): string {
  const values = random(CODE_LENGTH);
  let out = "";
  for (const v of values) out += CODE_ALPHABET[v % CODE_ALPHABET.length];
  return out;
}

function randomValues(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n));
}

/** Normalizes what a student types ("abc 234" -> "ABC234"). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
