"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { LoadingState, Notice, Spinner } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authErrorMessage, MIN_PASSWORD, passwordProblem } from "@/lib/auth-errors";
import { t } from "@/lib/i18n/pt-BR";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Opened from the reset e-mail when the Firebase template's action URL points here
 * (…/redefinir-senha?mode=resetPassword&oobCode=…). Without it, Firebase's own page is used.
 */
export function ResetPassword() {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oob = params.get("mode") === "resetPassword" ? params.get("oobCode") : null;
    if (!oob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is browser-only
      setCode(null);
      return;
    }
    void verifyPasswordResetCode(getFirebaseAuth(), oob)
      .then((mail) => {
        setEmail(mail);
        setCode(oob);
      })
      .catch(() => setCode(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(getFirebaseAuth(), code, password);
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err as { code?: string }));
    } finally {
      setBusy(false);
    }
  }

  if (code === undefined) return <LoadingState text={t.common.loading} />;
  if (code === null)
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
        <Notice tone="success">{t.auth.passwordChangedLogin}</Notice>
        <Link className={buttonVariants()} href="/entrar">
          {t.auth.submitLogin}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      {email && <p className="text-sm text-muted-foreground">{t.auth.resetFor(email)}</p>}
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
