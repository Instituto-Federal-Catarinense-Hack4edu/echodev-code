"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, MIN_PASSWORD, passwordProblem } from "@/lib/auth-errors";
import { t } from "@/lib/i18n/pt-BR";
import { getSupabase } from "@/lib/supabase/client";

/** Reached from the reset e-mail: the callback already turned the link into a session. */
export function ResetPassword() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void getSupabase()
      .auth.getUser()
      .then(({ data }) => setHasSession(!!data.user));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authErrorMessage(err));
    setDone(true);
  }

  if (hasSession === null) return <p className="text-muted-foreground">{t.common.loading}</p>;
  if (!hasSession)
    return (
      <p>
        {t.auth.resetExpired}{" "}
        <Link className="underline underline-offset-4" href="/entrar">
          {t.auth.backToLogin}
        </Link>
      </p>
    );
  if (done)
    return (
      <div className="space-y-3">
        <p role="status">{t.auth.passwordChanged}</p>
        <Link className="underline underline-offset-4" href="/professor">
          {t.auth.continue}
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="new-password">{t.auth.newPassword}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-confirm">{t.auth.confirmPassword}</Label>
        <Input
          id="new-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11"
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? t.auth.sending : t.auth.savePassword}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
