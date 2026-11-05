"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
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

  if (hasSession === null) return <LoadingState text={t.common.loading} />;
  if (!hasSession)
    return (
      <div className="space-y-4">
        <Notice tone="warning">{t.auth.resetExpired}</Notice>
        <Link className={buttonVariants({ variant: "outline" })} href="/entrar">
          {t.auth.backToLogin}
        </Link>
      </div>
    );
  if (done)
    return (
      <div className="space-y-4">
        <Notice tone="success">{t.auth.passwordChanged}</Notice>
        <Link className={buttonVariants()} href="/professor">
          {t.auth.continue}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">{t.auth.newPassword}</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="new-password-rule"
        />
        <p id="new-password-rule" className="text-xs text-muted-foreground">
          {t.auth.errors.shortPassword(MIN_PASSWORD)}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-confirm">{t.auth.confirmPassword}</Label>
        <PasswordInput
          id="new-confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner className="text-current" />}
        {busy ? t.auth.sending : t.auth.savePassword}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
