import { t } from "@/lib/i18n/pt-BR";

export const MIN_PASSWORD = 8;

/** Maps Supabase Auth error codes to clear Portuguese messages. */
export function authErrorMessage(error: { code?: string; status?: number; message?: string } | null): string {
  if (!error) return t.auth.errors.generic;
  switch (error.code) {
    case "invalid_credentials":
      return t.auth.errors.invalidCredentials;
    case "email_not_confirmed":
      return t.auth.errors.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return t.auth.errors.alreadyExists;
    case "weak_password":
      return t.auth.errors.weakPassword;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t.auth.rateLimited;
    case "same_password":
      return t.auth.errors.samePassword;
    case "signup_disabled":
      return t.auth.errors.signupDisabled;
  }
  if (error.status === 429) return t.auth.rateLimited;
  return t.auth.errors.generic;
}

export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD) return t.auth.errors.shortPassword(MIN_PASSWORD);
  if (confirm !== undefined && password !== confirm) return t.auth.errors.passwordMismatch;
  return null;
}
