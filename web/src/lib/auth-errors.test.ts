import { describe, expect, it } from "vitest";
import { authErrorMessage, EMAIL_NOT_VERIFIED, passwordProblem } from "./auth-errors";

describe("auth messages", () => {
  it("maps Firebase codes to clear messages", () => {
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toMatch(/E-mail ou senha incorretos/);
    expect(authErrorMessage({ code: EMAIL_NOT_VERIFIED })).toMatch(/confirm/i);
    expect(authErrorMessage({ code: "auth/email-already-in-use" })).toMatch(/já existe/i);
    expect(authErrorMessage({ code: "auth/too-many-requests" })).toMatch(/Muitas tentativas/);
    expect(authErrorMessage({ code: "auth/expired-action-code" })).toMatch(/expirou/);
    expect(authErrorMessage({ code: "algo/novo" })).toMatch(/Não foi possível/);
    expect(authErrorMessage(null)).toMatch(/Não foi possível/);
  });

  it("checks password length and confirmation", () => {
    expect(passwordProblem("curta")).toMatch(/8/);
    expect(passwordProblem("senhaforte1", "outra")).toMatch(/não são iguais/);
    expect(passwordProblem("senhaforte1", "senhaforte1")).toBeNull();
  });
});
