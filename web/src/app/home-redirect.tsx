"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasFirebaseEnv } from "@/lib/env";
import { roleHome } from "@/lib/roles";
import { currentUser } from "@/lib/firebase/client";
import { loadProfile } from "@/lib/firebase/use-profile";

export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!hasFirebaseEnv()) return;
    void currentUser().then(async (u) => {
      if (!u || !u.emailVerified) return;
      const p = await loadProfile(u.uid).catch(() => null);
      if (p) router.replace(roleHome(p.role === "professor" ? "professor" : "estudante"));
    });
  }, [router]);
  return null;
}
