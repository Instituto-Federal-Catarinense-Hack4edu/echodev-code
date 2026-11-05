import { t } from "@/lib/i18n/pt-BR";

export const MIN_PASSWORD = 8;

/** Our own code for a sign-in whose e-mail was never confirmed (Firebase allows it). */
export const EMAIL_NOT_VERIFIED = "echodev/email-not-verified";

/** Maps Firebase Auth error codes (FirebaseError.code) to clear messages. */
export function authErrorMessage(error: { code?: string } | null | undefined): string {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return t.auth.errors.invalidCredentials;
    case EMAIL_NOT_VERIFIED:
      return t.auth.errors.emailNotConfirmed;
    case "auth/email-already-in-use":
      return t.auth.errors.alreadyExists;
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return t.auth.errors.weakPassword;
    case "auth/too-many-requests":
      return t.auth.rateLimited;
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return t.auth.errors.signupDisabled;
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return t.auth.resetExpired;
  }
  return t.auth.errors.generic;
}

export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD) return t.auth.errors.shortPassword(MIN_PASSWORD);
  if (confirm !== undefined && password !== confirm) return t.auth.errors.passwordMismatch;
  return null;
}
