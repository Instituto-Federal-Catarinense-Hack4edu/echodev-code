"use client";

import { publicEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the Python API with the user's Supabase access token and a timeout (pitfall 18). */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 120_000, ...rest } = init;
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${publicEnv().NEXT_PUBLIC_API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
    const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    if (!res.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail;
      throw new ApiError(res.status, typeof detail === "string" ? detail : `HTTP ${res.status}`);
    }
    return body as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(504, "timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Wakes up the API host (free tiers sleep) so it is ready when the lesson ends. */
export function wakeApi(): void {
  try {
    void fetch(`${publicEnv().NEXT_PUBLIC_API_URL}/health`).catch(() => undefined);
  } catch {
    /* env missing */
  }
}
