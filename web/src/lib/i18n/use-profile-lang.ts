"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { fire } from "@/lib/supabase/fire";
import type { Profile } from "@/lib/supabase/use-profile";
import type { Lang } from "@/lib/terms/schemas";
import { setStudentLang, useStudentLang } from "./student-lang";

/** The student's language, loaded from the profile once and saved back on every change. */
export function useProfileLang(profile: Profile | null, setProfile: (p: Profile) => void) {
  const lang = useStudentLang();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || syncedFor.current === profile.user_id) return;
    syncedFor.current = profile.user_id;
    setStudentLang(profile.lang_pref);
  }, [profile]);

  const change = useCallback(
    (next: Lang) => {
      setStudentLang(next);
      if (!profile || profile.lang_pref === next) return;
      setProfile({ ...profile, lang_pref: next });
      fire(getSupabase().from("profiles").update({ lang_pref: next }).eq("user_id", profile.user_id), "save lang");
    },
    [profile, setProfile],
  );

  return [lang, change] as const;
}
