"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { apiFetch } from "@/lib/api/client";
import { currentUser, getDb } from "./client";

export interface Profile {
  user_id: string;
  role: "professor" | "estudante";
  depth_pref: "curta" | "exemplo" | "passos";
  lang_pref: "pt" | "en" | "es";
  /** Own random pseudonym (memberships and term events use it, never the user id). */
  pseudonym_id: string;
}

/** The parts of the Firebase user the screens need. */
export interface AppUser {
  id: string;
  email: string | null;
}

export const toAppUser = (u: User): AppUser => ({ id: u.uid, email: u.email });

/**
 * Reads the caller's profile; on the first login asks the API to create it (the role comes
 * from the teacher allowlist, which the browser cannot read). Null if it cannot be created.
 */
export async function loadProfile(uid: string): Promise<Profile | null> {
  const ref = doc(getDb(), "profiles", uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    try {
      await apiFetch("/me/profile", { method: "POST" });
    } catch {
      return null;
    }
    snap = await getDoc(ref);
  }
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    user_id: uid,
    role: d.role,
    depth_pref: d.depth_pref,
    lang_pref: d.lang_pref,
    pseudonym_id: d.pseudonym_id,
  };
}

export function useProfile() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await currentUser();
      if (cancelled) return;
      if (!u) {
        const here = window.location.pathname + window.location.search;
        router.replace(`/entrar?next=${encodeURIComponent(here)}`);
        return;
      }
      setUser(toAppUser(u));
      const p = await loadProfile(u.uid).catch(() => null);
      if (cancelled) return;
      setProfile(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { user, profile, setProfile, loading };
}
