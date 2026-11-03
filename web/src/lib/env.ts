import { z } from "zod";

// NEXT_PUBLIC_* must be referenced literally so Next inlines them in the client bundle.
const raw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_DEV_LOGIN: process.env.NEXT_PUBLIC_DEV_LOGIN,
};

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
  NEXT_PUBLIC_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let cached: PublicEnv | null = null;

/** Validated public env. Throws a clear message when Supabase is not configured. */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const r = PublicEnvSchema.safeParse(raw);
  if (!r.success) {
    throw new Error(
      `Variáveis de ambiente inválidas em web/.env.local: ${r.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}. Veja web/.env.example.`,
    );
  }
  cached = r.data;
  return cached;
}

/** True when Supabase vars are present (the offline demo works without them). */
export function hasSupabaseEnv(): boolean {
  return PublicEnvSchema.safeParse(raw).success;
}
