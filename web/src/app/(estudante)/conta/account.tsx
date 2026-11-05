"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PURPOSE_ICONS, REQUIRED_PURPOSES, type Purpose } from "@/components/consent-flow";
import { SectionTitle } from "@/components/page-header";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { apiFetch } from "@/lib/api/client";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

const ALL: Purpose[] = ["termos_uso", "tratamento_dados", "doacao_lexico", "doacao_sinais"];

export function Account() {
  const router = useRouter();
  const { user, profile, loading } = useProfile();
  const isTeacher = profile?.role === "professor";
  const [active, setActive] = useState<Record<string, string>>({}); // purpose -> consent id
  const [pending, setPending] = useState<Purpose | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("consents")
      .select("id,purpose")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    setActive(Object.fromEntries((data ?? []).map((r) => [r.purpose, r.id])));
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  async function toggle(purpose: Purpose) {
    if (!user) return;
    const supabase = getSupabase();
    setPending(purpose);
    try {
      if (active[purpose]) {
        await supabase.from("consents").update({ revoked_at: new Date().toISOString() }).eq("id", active[purpose]);
      } else {
        await supabase.from("consents").insert({ user_id: user.id, purpose });
      }
      await load();
    } finally {
      setPending(null);
    }
  }

  async function deleteAll() {
    if (!window.confirm(isTeacher ? t.account.deleteConfirmTeacher : t.account.deleteConfirm)) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch("/me", { method: "DELETE" });
      await getSupabase().auth.signOut();
      window.alert(t.account.deleted);
      router.replace("/");
    } catch {
      setError(t.account.deleteError);
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState text={t.common.loading} />;

  return (
    <div className="space-y-6">
      {user?.email && (
        <div className="surface flex flex-wrap items-center gap-4 p-5">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
          >
            {user.email.charAt(0).toUpperCase()}
          </span>
          <p className="mr-auto min-w-0 flex-1 basis-48 font-medium break-all">{t.auth.signedInAs(user.email)}</p>
          <Button
            variant="outline"
            onClick={async () => {
              await getSupabase().auth.signOut();
              router.replace("/");
            }}
          >
            <LogOut aria-hidden />
            {t.auth.signOut}
          </Button>
        </div>
      )}

      <section className="surface space-y-4 p-5" aria-labelledby="consents-h">
        <SectionTitle icon={ShieldCheck} id="consents-h">
          {t.account.consents}
        </SectionTitle>
        <ul className="divide-y">
          {ALL.map((p) => {
            const Icon = PURPOSE_ICONS[p];
            const on = !!active[p];
            return (
              <li key={p} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <div className="mr-auto min-w-0 flex-1 basis-48 space-y-1">
                  <p className="font-medium">{t.consent.purposes[p].title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={on ? "success" : "secondary"}>{on ? t.account.granted : t.account.revoked}</Badge>
                    {on && REQUIRED_PURPOSES.includes(p) && (
                      <span className="text-muted-foreground">{t.account.revokeRequiredWarning}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant={on ? "outline" : "default"}
                  disabled={pending !== null}
                  onClick={() => toggle(p)}
                  className={cn(on && "hover:border-destructive/40 hover:text-destructive")}
                >
                  {pending === p && <Spinner className="text-current" />}
                  {on ? t.account.revoke : t.account.grant}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="space-y-4 rounded-[calc(var(--radius)*1.8)] border-2 border-destructive/30 bg-danger-soft/40 p-5"
        aria-labelledby="delete-h"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-destructive">
            <AlertTriangle aria-hidden className="size-4.5" />
          </span>
          <h2 id="delete-h" className="text-base font-semibold">
            {t.account.deleteTitle}
          </h2>
        </div>
        <p className="text-sm leading-relaxed">{t.account.deleteBody}</p>
        {isTeacher && <Notice tone="error" live={false}>{t.account.deleteTeacherWarning}</Notice>}
        <Button variant="destructive" onClick={deleteAll} disabled={deleting}>
          {deleting ? <Spinner className="text-current" /> : <Trash2 aria-hidden />}
          {deleting ? t.account.deleting : t.account.deleteButton}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </section>
    </div>
  );
}
