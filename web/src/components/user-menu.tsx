"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button, buttonVariants } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/pt-BR";

export function UserMenu() {
  const router = useRouter();
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

  if (user === undefined) return <span className="min-h-11" aria-hidden />;

  if (!user)
    return (
      <Link href="/entrar" className={buttonVariants({ variant: "outline" })}>
        {t.auth.signIn}
      </Link>
    );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{t.auth.signedInAs(user.email ?? "")}</span>
      <Link
        className="inline-flex min-h-11 items-center px-2 underline underline-offset-4"
        href={isTeacher ? "/professor" : "/aluno"}
      >
        {isTeacher ? t.lessons.title : t.student_area.title}
      </Link>
      <Link className="inline-flex min-h-11 items-center px-2 underline underline-offset-4" href="/conta">
        {t.student.account}
      </Link>
      <Button
        variant="outline"
        onClick={async () => {
          await getSupabase().auth.signOut();
          router.replace("/");
          router.refresh();
        }}
      >
        {t.auth.signOut}
      </Button>
    </div>
  );
}
