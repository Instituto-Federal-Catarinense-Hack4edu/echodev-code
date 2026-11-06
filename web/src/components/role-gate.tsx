"use client";

import Link from "next/link";
import { ArrowRight, UserX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LoadingState, MessageCard } from "@/components/states";
import { roleHome, type Role } from "@/lib/roles";
import { useProfile } from "@/lib/firebase/use-profile";
import { useT } from "@/lib/i18n/context";

export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const t = useT();
  const { user, profile, loading } = useProfile();

  if (loading) return <LoadingState text={t.common.loading} />;
  if (!profile) return <MessageCard icon={UserX} tone="warning" title={t.roles.noProfile} />;
  if (profile.role === role) return <>{children}</>;

  const otherIsTeacher = profile.role === "professor";
  return (
    <MessageCard
      icon={UserX}
      tone="warning"
      title={role === "professor" ? t.roles.teacherOnly : t.roles.studentOnly}
      action={
        <Link href={roleHome(profile.role)} className={buttonVariants()}>
          {otherIsTeacher ? t.roles.goTeacher : t.roles.goStudent}
          <ArrowRight aria-hidden />
        </Link>
      }
    >
      {otherIsTeacher ? t.roles.youAreTeacher(user?.email ?? "") : t.roles.youAreStudent(user?.email ?? "")}
    </MessageCard>
  );
}
