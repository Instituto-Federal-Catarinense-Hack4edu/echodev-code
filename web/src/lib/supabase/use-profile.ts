"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";

export interface Profile {
  user_id: string;
  role: "professor" | "estudante";
  depth_pref: "curta" | "exemplo" | "passos";
  lang_pref: "pt" | "en" | "es";
}

/** Loads the signed-in user and own profile; redirects to /entrar when logged out. */
export function useProfile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        const here = window.location.pathname + window.location.search;
        router.replace(`/entrar?next=${encodeURIComponent(here)}`);
        return;
      }
      setUser(data.user);
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id,role,depth_pref,lang_pref")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile((p as Profile | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { user, profile, setProfile, loading };
}
