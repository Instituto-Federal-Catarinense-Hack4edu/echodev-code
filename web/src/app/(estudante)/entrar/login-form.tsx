"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSupabaseEnv, publicEnv } from "@/lib/env";
import { t } from "@/lib/i18n/pt-BR";
import { safeNext } from "@/lib/safe-next";
import { getSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [next, setNext] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "rate">("idle");
  const [callbackError, setCallbackError] = useState(false);
  const configured = hasSupabaseEnv();
  const env = configured ? publicEnv() : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is browser-only
    setNext(safeNext(params.get("next")));
    setCallbackError(params.get("erro") === "link");
  }, []);

  if (!configured || !env) return <p className="text-destructive">{t.auth.notConfigured}</p>;

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) setState(error.status === 429 ? "rate" : "error");
    else setState("sent");
  }

  async function google() {
    await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setState("error");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {callbackError && <p className="text-destructive">{t.auth.callbackError}</p>}
      {state === "sent" ? (
        <p role="status" className="rounded-lg border p-4">
          {t.auth.linkSent(email)}
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <p className="text-muted-foreground">{t.auth.intro}</p>
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
          <Button type="submit" className="w-full" disabled={state === "sending"}>
            {state === "sending" ? t.auth.sending : t.auth.sendLink}
          </Button>
        </form>
      )}
      {state === "error" && <p className="text-destructive">{t.auth.error}</p>}
      {state === "rate" && <p className="text-destructive">{t.auth.rateLimited}</p>}

      {env.NEXT_PUBLIC_GOOGLE_LOGIN && (
        <>
          <p className="text-center text-sm text-muted-foreground">{t.auth.or}</p>
          <Button variant="outline" className="w-full" onClick={google}>
            {t.auth.google}
          </Button>
        </>
      )}

      {env.NEXT_PUBLIC_DEV_LOGIN && (
        <form onSubmit={devLogin} className="space-y-3 rounded-lg border border-dashed p-4">
          <h2 className="font-semibold">{t.auth.devTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.auth.devHint}</p>
          <Label htmlFor="dev-email">{t.auth.email}</Label>
          <Input
            id="dev-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
          <Label htmlFor="dev-password">{t.auth.password}</Label>
          <Input
            id="dev-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <Button type="submit" variant="secondary" className="w-full">
            {t.auth.devSubmit}
          </Button>
        </form>
      )}
    </div>
  );
}
