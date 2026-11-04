"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { REQUIRED_PURPOSES, type Purpose } from "@/components/consent-flow";
import { apiFetch } from "@/lib/api/client";
import { getSupabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/use-profile";
import { t } from "@/lib/i18n/pt-BR";

const ALL: Purpose[] = ["termos_uso", "tratamento_dados", "doacao_lexico", "doacao_sinais"];

export function Account() {
  const router = useRouter();
  const { user, profile, loading } = useProfile();
  const isTeacher = profile?.role === "professor";
  const [active, setActive] = useState<Record<string, string>>({}); // purpose -> consent id
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
    if (active[purpose]) {
      await supabase.from("consents").update({ revoked_at: new Date().toISOString() }).eq("id", active[purpose]);
    } else {
      await supabase.from("consents").insert({ user_id: user.id, purpose });
    }
    await load();
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

  if (loading) return <p className="text-muted-foreground">{t.common.loading}</p>;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.account.consents}</h2>
        <ul className="space-y-3">
          {ALL.map((p) => (
            <li key={p} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="mr-auto">
                <p className="font-medium">{t.consent.purposes[p].title}</p>
                <p className="text-sm text-muted-foreground">
                  {active[p] ? t.account.granted : t.account.revoked}
                  {active[p] && REQUIRED_PURPOSES.includes(p) ? ` · ${t.account.revokeRequiredWarning}` : ""}
                </p>
              </div>
              <Button variant="outline" onClick={() => toggle(p)}>
                {active[p] ? t.account.revoke : t.account.grant}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive p-4">
        <h2 className="text-lg font-semibold">{t.account.deleteTitle}</h2>
        <p>{t.account.deleteBody}</p>
        {isTeacher && <p className="font-medium text-destructive">{t.account.deleteTeacherWarning}</p>}
        <Button variant="destructive" onClick={deleteAll} disabled={deleting}>
          {deleting ? t.account.deleting : t.account.deleteButton}
        </Button>
        {error && <p className="text-destructive">{error}</p>}
      </section>

      <Button
        variant="outline"
        onClick={async () => {
          await getSupabase().auth.signOut();
          router.replace("/");
        }}
      >
        {t.auth.signOut}
      </Button>
    </div>
  );
}
