import { z } from "zod";

export const LangSchema = z.enum(["pt", "en", "es"]);
export type Lang = z.infer<typeof LangSchema>;

export const DepthSchema = z.enum(["curta", "exemplo", "passos"]);
export type Depth = z.infer<typeof DepthSchema>;

export const TermCategorySchema = z.enum(["conceitos", "git", "web", "ferramentas"]);

const FullExplanationSchema = z.object({
  short: z.string().min(1),
  example: z.string().min(1),
  steps: z.array(z.string().min(1)).min(2),
});

const PartialExplanationSchema = z.object({
  /** How the term is written in this language; used to highlight it in translated captions. */
  names: z.array(z.string().min(1)).optional(),
  short: z.string().min(1),
  example: z.string().min(1).optional(),
  steps: z.array(z.string().min(1)).optional(),
  literal: z.string().min(1).optional(),
});

export const TermSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  canonical: z.string().min(1),
  /** Common speech-recognition misspellings; replaced by `canonical`. */
  variants: z.array(z.string().min(1)),
  /** Legit inflections (plural etc.); highlighted but kept as spoken. */
  forms: z.array(z.string().min(1)).optional(),
  /** false for ordinary Portuguese words: never approximate-matched (only exact). */
  fuzzy: z.boolean().optional(),
  category: TermCategorySchema,
  figurative: z.boolean().optional(),
  literalMeaning: z.string().optional(),
  explanations: z.object({
    pt: FullExplanationSchema,
    en: PartialExplanationSchema.optional(),
    es: PartialExplanationSchema.optional(),
  }),
  reviewed: z.boolean(),
});
export type Term = z.infer<typeof TermSchema>;

export const PackSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  terms: z.array(TermSchema),
});
export type Pack = z.infer<typeof PackSchema>;
