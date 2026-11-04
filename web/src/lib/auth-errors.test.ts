import { describe, expect, it } from "vitest";
import { authErrorMessage, passwordProblem } from "./auth-errors";

describe("auth messages", () => {
  it("maps Supabase codes to clear messages", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/E-mail ou senha incorretos/);
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirm/i);
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(/já existe/i);
    expect(authErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/);
    expect(authErrorMessage({ code: "algo_novo" })).toMatch(/Não foi possível/);
  });

  it("checks password length and confirmation", () => {
    expect(passwordProblem("curta")).toMatch(/8/);
    expect(passwordProblem("senhaforte1", "outra")).toMatch(/não são iguais/);
    expect(passwordProblem("senhaforte1", "senhaforte1")).toBeNull();
  });
});
