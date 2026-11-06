import { z } from "zod";

// NEXT_PUBLIC_* must be referenced literally so Next inlines them in the client bundle.
const raw = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_EMULATORS: process.env.NEXT_PUBLIC_FIREBASE_EMULATORS,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_GOOGLE_LOGIN: process.env.NEXT_PUBLIC_GOOGLE_LOGIN,
};

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const PublicEnvSchema = z.object({
  // Firebase web config (public by design; access is controlled by firestore.rules).
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(10),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(3),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(3),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(5),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  /** Use the local emulators (firebase emulators:start) instead of the real project. */
  NEXT_PUBLIC_FIREBASE_EMULATORS: flag,
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
  NEXT_PUBLIC_GOOGLE_LOGIN: flag,
});
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let cached: PublicEnv | null = null;

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

export function hasFirebaseEnv(): boolean {
  return PublicEnvSchema.safeParse(raw).success;
}
