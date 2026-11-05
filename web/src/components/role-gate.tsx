"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { roleHome, type Role } from "@/lib/roles";
import { useProfile } from "@/lib/supabase/use-profile";
import { useT } from "@/lib/i18n/context";

export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const t = useT();
  const { user, profile, loading } = useProfile();

  if (loading) return <p className="p-6 text-muted-foreground">{t.common.loading}</p>;
  if (!profile) return <p className="p-6">{t.roles.noProfile}</p>;
  if (profile.role === role) return <>{children}</>;

  const otherIsTeacher = profile.role === "professor";
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-6">
      <h1 className="text-2xl font-bold">{role === "professor" ? t.roles.teacherOnly : t.roles.studentOnly}</h1>
      <p>{otherIsTeacher ? t.roles.youAreTeacher(user?.email ?? "") : t.roles.youAreStudent(user?.email ?? "")}</p>
      <Link href={roleHome(profile.role)} className={buttonVariants()}>
        {otherIsTeacher ? t.roles.goTeacher : t.roles.goStudent}
      </Link>
    </main>
  );
}
