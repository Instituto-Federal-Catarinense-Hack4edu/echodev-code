"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { GraduationCap, LayoutGrid, LogIn, LogOut, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no auth without Supabase
      setUser(null);
      return;
    }
    const supabase = getSupabase();
    const load = async (u: User | null) => {
      setUser(u);
      if (!u) return setIsTeacher(false);
      const { data } = await supabase.from("profiles").select("role").eq("user_id", u.id).maybeSingle();
      setIsTeacher(data?.role === "professor");
    };
    void supabase.auth.getUser().then(({ data }) => load(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
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
          await getSupabase().auth.signOut();
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut aria-hidden />
      </Button>
    </nav>
  );
}
