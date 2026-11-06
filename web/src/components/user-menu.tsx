"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { GraduationCap, LayoutGrid, LogIn, LogOut, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { hasFirebaseEnv } from "@/lib/env";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (!hasFirebaseEnv()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no auth without Firebase
      setUser(null);
      return;
    }
    // Fires once with the restored session and again on every sign-in / sign-out.
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      // An unconfirmed sign-up is not a session yet (same as before).
      const active = u && u.emailVerified ? u : null;
      setUser(active);
      if (!active) return setIsTeacher(false);
      void getDoc(doc(getDb(), "profiles", active.uid))
        .then((p) => setIsTeacher(p.data()?.role === "professor"))
        .catch(() => setIsTeacher(false));
    });
  }, []);

  if (user === undefined) return <span className="inline-block h-11 w-24 animate-pulse rounded-xl bg-muted" aria-hidden />;

  if (!user)
    return (
      <Link href="/entrar" className={buttonVariants({ variant: "outline" })}>
        <LogIn aria-hidden />
        {t.auth.signIn}
      </Link>
    );

  const areaHref = isTeacher ? "/professor" : "/aluno";
  const navLink = (href: string, active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
      active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <nav aria-label={t.student.account} className="flex items-center gap-1 text-sm">
      <Link className={navLink(areaHref, pathname.startsWith(areaHref))} href={areaHref}>
        {isTeacher ? <LayoutGrid aria-hidden className="size-4" /> : <GraduationCap aria-hidden className="size-4" />}
        <span className="hidden sm:inline">{isTeacher ? t.lessons.title : t.student_area.title}</span>
        <span className="sr-only sm:hidden">{isTeacher ? t.lessons.title : t.student_area.title}</span>
      </Link>
      <Link className={navLink("/conta", pathname.startsWith("/conta"))} href="/conta" title={t.auth.signedInAs(user.email ?? "")}>
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        >
          {initial || <UserRound className="size-4" />}
        </span>
        <span className="hidden md:inline">{t.student.account}</span>
        <span className="sr-only md:hidden">{t.student.account}</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.auth.signOut}
        title={t.auth.signOut}
        className="text-muted-foreground hover:text-foreground"
        onClick={async () => {
          await signOut(getFirebaseAuth());
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut aria-hidden />
      </Button>
    </nav>
  );
}
