"use client";

import { getDoc, Timestamp, type DocumentReference, type DocumentSnapshot } from "firebase/firestore";

/** Firestore Timestamps become ISO strings, so screens keep working with plain dates. */
export function isoOf(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : null;
}

/** A document's fields with every Timestamp converted to ISO strings, plus its id. */
export function plain<T>(snap: DocumentSnapshot): (T & { id: string }) | null {
  if (!snap.exists()) return null;
  const out: Record<string, unknown> = { id: snap.id };
  for (const [k, v] of Object.entries(snap.data())) out[k] = v instanceof Timestamp ? isoOf(v) : v;
  return out as T & { id: string };
}

/**
 * Reads one document; a missing document or one the rules hide both come back as null
 * (the old `.maybeSingle()` behavior).
 */
export async function getPlain<T>(ref: DocumentReference): Promise<(T & { id: string }) | null> {
  try {
    return plain<T>(await getDoc(ref));
  } catch (e) {
    if ((e as { code?: string }).code === "permission-denied") return null;
    throw e;
  }
}
