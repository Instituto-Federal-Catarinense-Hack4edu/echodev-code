"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { roleHome } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase/client";

export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = getSupabase();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
      router.replace(roleHome(p?.role === "professor" ? "professor" : "estudante"));
    });
  }, [router]);
  return null;
}
