"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { ArrowLeft, ArrowRight, KeyRound, LogOut, Mail, UserRoundCheck } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { Notice, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, EMAIL_NOT_VERIFIED, MIN_PASSWORD, passwordProblem } from "@/lib/auth-errors";
import { hasFirebaseEnv, publicEnv } from "@/lib/env";
import { currentUser, getFirebaseAuth } from "@/lib/firebase/client";
import { loadProfile, NotTeacherError, toAppUser, type AppUser } from "@/lib/firebase/use-profile";
import { t } from "@/lib/i18n/pt-BR";
import { areaOf, destinationFor, roleHome, type Role } from "@/lib/roles";
import { safeNext } from "@/lib/safe-next";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "reset";
type NoticeState = { kind: "error" | "ok"; text: string } | null;

export function LoginForm() {
  const router = useRouter();
  const [next, setNext] = useState("/");
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("estudante");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [current, setCurrent] = useState<AppUser | null | undefined>(undefined);
  const configured = hasFirebaseEnv();
  const env = configured ? publicEnv() : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = safeNext(params.get("next"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is browser-only
    setNext(target);
    // The button the person came from ("Sou professor" on the home page) picks the role.
    setRole(areaOf(target) ?? "estudante");
    if (params.get("erro") === "link") setNotice({ kind: "error", text: t.auth.callbackError });
    if (params.get("modo") === "criar") setMode("signup");
    if (configured)
      void currentUser().then((u) => setCurrent(u && u.emailVerified ? toAppUser(u) : null));
  }, [configured]);

  if (!configured || !env)
    return <Notice tone="warning">{t.auth.notConfigured}</Notice>;

  /** Where to go after signing in with the chosen role (keeps `next` when it matches). */
  const roleNext = areaOf(next) === role ? next : roleHome(role);

  /** Where the links in Firebase e-mails send the user back to. */
  const backToLogin = (to: string) => ({
    url: `${window.location.origin}/entrar?next=${encodeURIComponent(to)}`,
  });

  function switchMode(m: Mode) {
    setMode(m);
    setNotice(null);
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    const mail = email.trim().toLowerCase();
    setNotice(null);

    if (mode === "signup") {
      const problem = passwordProblem(password, confirm);
      if (problem) return setNotice({ kind: "error", text: problem });
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { user } = await signInWithEmailAndPassword(auth, mail, password);
        // Firebase signs in unconfirmed accounts; EchoDev waits for the confirmation link.
        if (!user.emailVerified) {
          await firebaseSignOut(auth);
          throw { code: EMAIL_NOT_VERIFIED };
        }
        await goToArea(user.uid, role);
      } else if (mode === "signup") {
        const { user } = await createUserWithEmailAndPassword(auth, mail, password);
        // The confirmation link returns to the login with the same role selected.
        await sendEmailVerification(user, backToLogin(roleNext));
        await firebaseSignOut(auth);
        setNotice({ kind: "ok", text: t.auth.confirmSent(mail) });
      } else {
        await sendPasswordResetEmail(auth, mail, backToLogin("/"));
        setNotice({ kind: "ok", text: t.auth.resetSent(mail) });
      }
    } catch (err) {
      if (err instanceof NotTeacherError) {
        await refuseTeacher();
        return;
      }
      // Reset never says whether the address exists.
      if (mode === "reset" && (err as { code?: string }).code === "auth/user-not-found")
        setNotice({ kind: "ok", text: t.auth.resetSent(mail) });
      else setNotice({ kind: "error", text: authErrorMessage(err as { code?: string }) });
    } finally {
      setBusy(false);
    }
  }

  /** Throws NotTeacherError when `intent` is "professor" and the account is not a teacher's. */
  async function roleOf(userId: string | undefined, intent?: Role): Promise<Role> {
    if (!userId) return "estudante";
    const p = await loadProfile(userId, intent).catch((e: unknown) => {
      if (e instanceof NotTeacherError) throw e;
      return null;
    });
    return p?.role === "professor" ? "professor" : "estudante";
  }

  /** With `intent` (the role chosen on this screen) a non-teacher choosing "Professor" is refused. */
  async function goToArea(userId: string | undefined, intent?: Role) {
    router.replace(destinationFor(await roleOf(userId, intent), intent ? roleNext : next));
    router.refresh();
  }

  async function refuseTeacher() {
    await firebaseSignOut(getFirebaseAuth());
    setNotice({ kind: "error", text: t.auth.errors.notTeacher });
  }

  async function signOut() {
    await firebaseSignOut(getFirebaseAuth());
    setCurrent(null);
    router.refresh();
  }

  async function google() {
    setNotice(null);
    try {
      const { user } = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await goToArea(user.uid, role);
    } catch (err) {
      if (err instanceof NotTeacherError) {
        await refuseTeacher();
        return;
      }
      if ((err as { code?: string }).code !== "auth/popup-closed-by-user")
        setNotice({ kind: "error", text: authErrorMessage(err as { code?: string }) });
    }
  }

  if (current) {
    return (
      <div className="space-y-4">
        <Notice tone="success" icon={UserRoundCheck}>
          {t.auth.alreadyIn(current.email ?? "")}
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void goToArea(current.id)}>
            {t.auth.continue}
            <ArrowRight aria-hidden />
          </Button>
          <Button variant="outline" onClick={signOut}>
            <LogOut aria-hidden />
            {t.auth.signOut}
          </Button>
        </div>
      </div>
    );
  }

  const submitLabel = { login: t.auth.submitLogin, signup: t.auth.submitSignup, reset: t.auth.submitReset }[mode];

  return (
    <div className="space-y-5">
      {mode !== "reset" && (
        <div role="tablist" aria-label={t.auth.title} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-semibold transition-all",
                mode === m
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "login" ? t.auth.tabLogin : t.auth.tabSignup}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        {mode === "reset" && (
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound aria-hidden className="size-5 text-primary" />
              {t.auth.forgot}
            </p>
            <p className="text-muted-foreground">{t.auth.resetIntro}</p>
          </div>
        )}
        {mode === "signup" && <p className="text-sm text-muted-foreground">{t.auth.signupIntro}</p>}

        {mode !== "reset" && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t.auth.roleLabel}</legend>
            <div role="radiogroup" aria-label={t.auth.roleLabel} className="grid grid-cols-2 gap-2">
              {(["estudante", "professor"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => {
                    setRole(r);
                    setNotice(null);
                  }}
                  className={cn(
                    "min-h-11 rounded-lg border text-sm font-semibold transition-all",
                    role === r
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "professor" ? t.auth.roleTeacher : t.auth.roleStudent}
                </button>
              ))}
            </div>
            {role === "professor" && <p className="text-xs text-muted-foreground">{t.auth.teacherHint}</p>}
          </fieldset>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.email}</Label>
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {mode !== "reset" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              {mode === "login" && (
                <button
                  type="button"
                  className="min-h-8 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => switchMode("reset")}
                >
                  {t.auth.forgot}
                </button>
              )}
            </div>
            <PasswordInput
              id="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === "signup" ? "password-rule" : undefined}
            />
            {mode === "signup" && (
              <p id="password-rule" className="text-xs text-muted-foreground">
                {t.auth.errors.shortPassword(MIN_PASSWORD)}
              </p>
            )}
          </div>
        )}

        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t.auth.confirmPassword}</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Spinner className="text-current" />}
          {busy ? t.auth.sending : submitLabel}
        </Button>
      </form>

      {notice && <Notice tone={notice.kind === "error" ? "error" : "success"}>{notice.text}</Notice>}

      {mode === "reset" && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => switchMode("login")}
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.auth.backToLogin}
        </button>
      )}

      {env.NEXT_PUBLIC_GOOGLE_LOGIN && mode !== "reset" && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span aria-hidden className="h-px flex-1 bg-border" />
            {t.auth.or}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            {t.auth.google}
          </Button>
        </>
      )}

      <p className="border-t pt-4 text-sm text-muted-foreground">
        {t.auth.teacherNote}{" "}
        <Link className="font-medium text-foreground underline underline-offset-4" href="/">
          {t.common.back}
        </Link>
      </p>
    </div>
  );
}
