import { z } from "zod";

export const TermSpanSchema = z.object({
  termId: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
export type TermSpan = z.infer<typeof TermSpanSchema>;

/** One final sentence published on the lesson channel. Spans index the corrected text. */
export const UtteranceMessageSchema = z
  .object({
    seq: z.number().int().positive(),
    text: z.string().max(5000),
    /** Spanish translation made in the teacher's browser, when enabled. */
    es: z.string().max(5000).optional(),
    terms: z.array(TermSpanSchema),
    wpm: z.number().int().nonnegative(),
    sentAt: z.number().int().nonnegative(),
  })
  .refine((m) => m.terms.every((s) => s.start < s.end && s.end <= m.text.length), {
    message: "term span out of bounds",
  });
export type UtteranceMessage = z.infer<typeof UtteranceMessageSchema>;

export const ControlMessageSchema = z.object({
  type: z.literal("lesson_ended"),
  at: z.number().int().nonnegative(),
});
export type ControlMessage = z.infer<typeof ControlMessageSchema>;

export function parseControl(data: unknown): ControlMessage | null {
  const r = ControlMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}

export function parseUtterance(data: unknown): UtteranceMessage | null {
  const r = UtteranceMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}
